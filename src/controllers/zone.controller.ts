import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { sendResponse } from '../utils/helpers';
import { getParam } from '../utils/types';
import { AuthenticatedRequest } from '../middleware/auth';

export const getZones = catchAsync(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;

  const zones = await prisma.zone.findMany({
    where: authReq.user.role === 'superadmin' ? {} : {
      id: { in: authReq.user.zoneRoles.map((zr) => zr.zoneId) },
    },
    include: { parentZone: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  });

  sendResponse(res, { data: zones });
});

export const getZoneTree = catchAsync(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;

  const zones = await prisma.zone.findMany({
    where: authReq.user.role === 'superadmin'
      ? { status: 'active' }
      : { status: 'active', id: { in: authReq.user.zoneRoles.map((zr) => zr.zoneId) } },
    include: {
      leadVet: { select: { id: true, name: true } },
      _count: { select: { animals: true, childZones: true } },
    },
    orderBy: { name: 'asc' },
  });

  sendResponse(res, { data: zones });
});

export const getZone = catchAsync(async (req: Request, res: Response) => {
  const zone = await prisma.zone.findUnique({
    where: { id: getParam(req, 'id') },
    include: {
      parentZone: { select: { id: true, name: true } },
      leadVet: { select: { id: true, name: true, email: true } },
      userZoneRoles: {
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      },
      _count: { select: { animals: true, childZones: true } },
    },
  });

  if (!zone) throw new AppError('Zone not found.', 404);

  sendResponse(res, { data: zone });
});

export const createZone = catchAsync(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { name, label, parentZoneId, technicianGracePeriodHours, inviteExpiryHours } = req.body as {
    name: string;
    label?: string;
    parentZoneId?: string;
    technicianGracePeriodHours?: number;
    inviteExpiryHours?: number;
  };

  if (parentZoneId) {
    const parent = await prisma.zone.findUnique({ where: { id: parentZoneId } });
    if (!parent) throw new AppError('Parent zone not found.', 404);
  }

  const zone = await prisma.zone.create({
    data: {
      name,
      label: label || 'Zone',
      parentZoneId: parentZoneId || null,
      technicianGracePeriodHours: technicianGracePeriodHours || 24,
      inviteExpiryHours: inviteExpiryHours || 168,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: authReq.user.id,
      action: 'zone.create',
      entity: 'zone',
      entityId: zone.id,
      zoneId: zone.id,
    },
  });

  sendResponse(res, { statusCode: 201, data: zone, message: 'Zone created.' });
});

export const updateZone = catchAsync(async (req: Request, res: Response) => {
  const { name, label, technicianGracePeriodHours, inviteExpiryHours } = req.body as {
    name?: string;
    label?: string;
    technicianGracePeriodHours?: number;
    inviteExpiryHours?: number;
  };

  const zone = await prisma.zone.findUnique({ where: { id: getParam(req, 'id') } });
  if (!zone) throw new AppError('Zone not found.', 404);

  const updated = await prisma.zone.update({
    where: { id: getParam(req, 'id') },
    data: {
      ...(name && { name }),
      ...(label && { label }),
      ...(technicianGracePeriodHours && { technicianGracePeriodHours }),
      ...(inviteExpiryHours && { inviteExpiryHours }),
    },
  });

  sendResponse(res, { data: updated, message: 'Zone updated.' });
});

export const moveZone = catchAsync(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { newParentId } = req.body as { newParentId?: string };
  const zoneId = getParam(req, 'id');

  const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
  if (!zone) throw new AppError('Zone not found.', 404);

  // Prevent circular references
  if (newParentId) {
    const target = await prisma.zone.findUnique({ where: { id: newParentId } });
    if (!target) throw new AppError('Target zone not found.', 404);

    let current = target;
    while (current.parentZoneId) {
      if (current.parentZoneId === zoneId) {
        throw new AppError('Cannot move a zone under one of its own descendants.', 400);
      }
      current = (await prisma.zone.findUnique({ where: { id: current.parentZoneId } }))!;
    }
  }

  // Compute impact summary
  const descendants = await prisma.zone.findMany({ where: { parentZoneId: zoneId } });
  const descendantIds = [zoneId, ...descendants.map((d) => d.id)];

  const animalCount = await prisma.animal.count({ where: { zoneId: { in: descendantIds } } });
  const userCount = await prisma.userZoneRole.count({ where: { zoneId: { in: descendantIds } } });

  const updated = await prisma.zone.update({
    where: { id: zoneId },
    data: { parentZoneId: newParentId || null },
  });

  await prisma.auditLog.create({
    data: {
      userId: authReq.user.id,
      action: 'zone.move',
      entity: 'zone',
      entityId: zoneId,
      zoneId,
      metadata: {
        newParentId: newParentId || null,
        impact: { subZones: descendants.length, animals: animalCount, users: userCount },
      },
    },
  });

  sendResponse(res, {
    data: { zone: updated, impact: { subZones: descendants.length, animals: animalCount, users: userCount } },
    message: 'Zone moved.',
  });
});

export const archiveZone = catchAsync(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;

  const zone = await prisma.zone.findUnique({ where: { id: getParam(req, 'id') } });
  if (!zone) throw new AppError('Zone not found.', 404);

  const updated = await prisma.zone.update({
    where: { id: getParam(req, 'id') },
    data: { status: 'archived' },
  });

  await prisma.auditLog.create({
    data: {
      userId: authReq.user.id,
      action: 'zone.archive',
      entity: 'zone',
      entityId: getParam(req, 'id'),
      zoneId: getParam(req, 'id'),
    },
  });

  sendResponse(res, { data: updated, message: 'Zone archived.' });
});
