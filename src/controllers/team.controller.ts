import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { sendResponse } from '../utils/helpers';
import { getParam } from '../utils/types';
import { AuthenticatedRequest } from '../middleware/auth';

export const getTechnicians = catchAsync(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const myZoneIds = authReq.user.zoneRoles.filter((zr) => zr.isLead).map((zr) => zr.zoneId);

  if (myZoneIds.length === 0) {
    sendResponse(res, { data: [] });
    return;
  }

  const technicians = await prisma.user.findMany({
    where: {
      role: 'technician',
      zoneRoles: { some: { zoneId: { in: myZoneIds } } },
    },
    include: {
      zoneRoles: {
        where: { zoneId: { in: myZoneIds } },
        include: { zone: { select: { id: true, name: true } } },
      },
      _count: {
        select: { enteredAnimals: true, administeredVaccinations: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  sendResponse(res, { data: technicians });
});

export const getTechnician = catchAsync(async (req: Request, res: Response) => {
  const tech = await prisma.user.findUnique({
    where: { id: getParam(req, 'id'), role: 'technician' },
    include: {
      zoneRoles: { include: { zone: { select: { id: true, name: true } } } },
      _count: { select: { enteredAnimals: true, administeredVaccinations: true } },
    },
  });

  if (!tech) throw new AppError('Technician not found.', 404);

  const [recentAnimals, recentVaccinations] = await Promise.all([
    prisma.animal.findMany({
      where: { enteredByUserId: tech.id },
      orderBy: { registeredAt: 'desc' },
      take: 10,
      select: { id: true, tagNumber: true, registeredAt: true, editableUntil: true },
    }),
    prisma.vaccination.findMany({
      where: { administeredByUserId: tech.id },
      orderBy: { dateAdministered: 'desc' },
      take: 10,
      select: { id: true, dateAdministered: true, editableUntil: true },
    }),
  ]);

  sendResponse(res, {
    data: {
      ...tech,
      recentActivity: { animals: recentAnimals, vaccinations: recentVaccinations },
    },
  });
});

export const inviteTechnician = catchAsync(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { email, zoneId, contractStart, contractEnd, inviteExpiryHours } = req.body as {
    email: string;
    zoneId: string;
    contractStart: string;
    contractEnd: string;
    inviteExpiryHours?: number;
  };

  const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
  if (!zone) throw new AppError('Zone not found.', 404);

  const invitation = await prisma.invitation.create({
    data: {
      email,
      invitedByUserId: authReq.user.id,
      zoneId,
      expiresAt: new Date(Date.now() + (inviteExpiryHours || 168) * 60 * 60 * 1000),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: authReq.user.id,
      action: 'technician.invite',
      entity: 'invitation',
      entityId: invitation.id,
      zoneId,
    },
  });

  sendResponse(res, {
    statusCode: 201,
    data: invitation,
    message: `Invitation sent to ${email}. Link expires in ${inviteExpiryHours || 168} hours.`,
  });
});

export const extendContract = catchAsync(async (req: Request, res: Response) => {
  const { contractEnd } = req.body as { contractEnd: string };

  const assignment = await prisma.userZoneRole.findFirst({
    where: { userId: getParam(req, 'id'), role: 'technician' },
  });

  if (!assignment) throw new AppError('Technician assignment not found.', 404);

  const updated = await prisma.userZoneRole.update({
    where: { id: assignment.id },
    data: { contractEnd: new Date(contractEnd), status: 'active' },
  });

  sendResponse(res, { data: updated, message: 'Contract extended.' });
});
