import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { catchAsync } from '../utils/catchAsync';
import { sendResponse } from '../utils/helpers';
import { prisma } from '../utils/prisma';
import {
  getUserPermissions,
  getDashboardPermissions,
  getUserZoneIds,
  Permission,
} from '../utils/permissions';

/**
 * Get dashboard data based on user permissions
 */
export const getDashboard = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const permissions = getUserPermissions(user);
  const dashboardPerms = getDashboardPermissions(user);

  // Build dashboard data based on role
  const dashboardData: any = {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: permissions,
    },
    permissions: dashboardPerms,
    metrics: {},
    recentActivity: [],
    widgets: [],
  };

  // System-wide metrics (Superadmin only)
  if (dashboardPerms.canViewSystemDashboard) {
    const [totalZones, totalUsers, totalAnimals, totalVaccinations, recentAudit] = await Promise.all([
      prisma.zone.count({ where: { status: 'active' } }),
      prisma.user.count({ where: { status: 'active' } }),
      prisma.animal.count(),
      prisma.vaccination.count(),
      prisma.auditLog.findMany({
        take: 10,
        orderBy: { timestamp: 'desc' },
        include: {
          user: { select: { name: true, role: true } },
          zone: { select: { name: true } },
        },
      }),
    ]);

    dashboardData.metrics.system = {
      totalZones,
      totalUsers,
      totalAnimals,
      totalVaccinations,
    };

    dashboardData.recentActivity = recentAudit.map((entry) => ({
      id: entry.id,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      user: entry.user.name,
      userRole: entry.user.role,
      zone: entry.zone?.name,
      timestamp: entry.timestamp,
    }));

    dashboardData.widgets.push('system-metrics', 'recent-audit', 'zone-overview');
  }

  // Zone-level metrics (Vet and Superadmin)
  if (dashboardPerms.canViewZoneDashboard) {
    const zoneIds = getUserZoneIds(user);
    const zoneFilter = zoneIds.length > 0 ? { id: { in: zoneIds } } : {};

    const [zones, animalsInZones, vaccinationsInZones, ownersInZones] = await Promise.all([
      prisma.zone.findMany({
        where: { ...zoneFilter, status: 'active' },
        include: {
          leadVet: { select: { name: true } },
          _count: {
            select: {
              animals: true,
              owners: true,
            },
          },
        },
        take: 10,
      }),
      prisma.animal.count({
        where: zoneIds.length > 0 ? { zoneId: { in: zoneIds } } : {},
      }),
      prisma.vaccination.count({
        where: zoneIds.length > 0
          ? { animal: { zoneId: { in: zoneIds } } }
          : {},
      }),
      prisma.owner.count({
        where: zoneIds.length > 0 ? { zoneId: { in: zoneIds } } : {},
      }),
    ]);

    dashboardData.metrics.zone = {
      totalAnimals: animalsInZones,
      totalVaccinations: vaccinationsInZones,
      totalOwners: ownersInZones,
      zonesManaged: zones.length,
    };

    dashboardData.zones = zones.map((zone) => ({
      id: zone.id,
      name: zone.name,
      label: zone.label,
      leadVet: zone.leadVet?.name,
      animalCount: zone._count.animals,
      ownerCount: zone._count.owners,
    }));

    // Due vaccinations
    const dueVaccinations = await prisma.vaccination.findMany({
      where: {
        nextDueDate: {
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Next 30 days
        },
        ...(zoneIds.length > 0 ? { animal: { zoneId: { in: zoneIds } } } : {}),
      },
      include: {
        animal: {
          include: {
            species: true,
            owner: true,
            zone: true,
          },
        },
        vaccine: {
          include: {
            disease: true,
          },
        },
      },
      orderBy: { nextDueDate: 'asc' },
      take: 10,
    });

    dashboardData.dueVaccinations = dueVaccinations.map((vac) => ({
      id: vac.id,
      animalTag: vac.animal.tagNumber,
      animalSpecies: vac.animal.species.name,
      ownerName: vac.animal.owner.name,
      ownerPhone: vac.animal.owner.phone,
      zone: vac.animal.zone.name,
      disease: vac.vaccine.disease.name,
      vaccine: vac.vaccine.name,
      doseNumber: vac.doseNumber,
      nextDueDate: vac.nextDueDate,
      isDue: vac.nextDueDate && new Date(vac.nextDueDate) <= new Date(),
    }));

    dashboardData.widgets.push('zone-metrics', 'due-vaccinations', 'zone-list');

    // Team activity (if has team management permission)
    if (dashboardPerms.canManageTeam) {
      const teamMembers = await prisma.userZoneRole.findMany({
        where: {
          ...(zoneIds.length > 0 ? { zoneId: { in: zoneIds } } : {}),
          role: 'technician',
          status: 'active',
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          zone: {
            select: {
              name: true,
            },
          },
        },
        take: 10,
      });

      dashboardData.teamMembers = teamMembers.map((tm) => ({
        id: tm.user.id,
        name: tm.user.name,
        email: tm.user.email,
        zone: tm.zone.name,
        contractStart: tm.contractStart,
        contractEnd: tm.contractEnd,
      }));

      dashboardData.widgets.push('team-activity');
    }
  }

  // Personal metrics (All roles)
  if (dashboardPerms.canViewPersonalDashboard) {
    const [animalsRegistered, vaccinationsRecorded, recentEntries] = await Promise.all([
      prisma.animal.count({
        where: { enteredByUserId: user.id },
      }),
      prisma.vaccination.count({
        where: { administeredByUserId: user.id },
      }),
      prisma.animal.findMany({
        where: { enteredByUserId: user.id },
        include: {
          species: { select: { name: true } },
          owner: { select: { name: true } },
          zone: { select: { name: true } },
        },
        orderBy: { registeredAt: 'desc' },
        take: 5,
      }),
    ]);

    dashboardData.metrics.personal = {
      animalsRegistered,
      vaccinationsRecorded,
    };

    dashboardData.recentEntries = recentEntries.map((animal) => ({
      id: animal.id,
      tagNumber: animal.tagNumber,
      species: animal.species.name,
      owner: animal.owner.name,
      zone: animal.zone.name,
      healthStatus: animal.healthStatus,
      registeredAt: animal.registeredAt,
      editableUntil: animal.editableUntil,
    }));

    dashboardData.widgets.push('my-metrics', 'recent-entries');
  }

  // Quick actions based on permissions
  const quickActions = [];
  if (permissions.includes(Permission.ANIMAL_CREATE)) {
    quickActions.push({ label: 'Register Animal', path: '/animals/register', icon: 'plus' });
  }
  if (permissions.includes(Permission.VACCINATION_CREATE)) {
    quickActions.push({
      label: 'Record Vaccination',
      path: '/vaccinations/record',
      icon: 'syringe',
    });
  }
  if (permissions.includes(Permission.ZONE_CREATE)) {
    quickActions.push({ label: 'Create Zone', path: '/zones/create', icon: 'map-pin' });
  }
  if (permissions.includes(Permission.USER_CREATE)) {
    quickActions.push({ label: 'Add User', path: '/users/create', icon: 'user-plus' });
  }
  if (permissions.includes(Permission.TEAM_INVITE)) {
    quickActions.push({ label: 'Invite Technician', path: '/team/invite', icon: 'user-plus' });
  }

  dashboardData.quickActions = quickActions;

  sendResponse(res, {
    data: dashboardData,
    message: 'Dashboard data retrieved successfully.',
  });
});

/**
 * Get user permissions
 */
export const getPermissions = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const permissions = getUserPermissions(user);
  const dashboardPerms = getDashboardPermissions(user);

  sendResponse(res, {
    data: {
      permissions,
      dashboard: dashboardPerms,
      role: user.role,
      zoneAccess: user.zoneRoles.map((zr) => ({
        zoneId: zr.zoneId,
        zoneName: zr.zone.name,
        role: zr.role,
        isLead: zr.isLead,
      })),
    },
  });
});
