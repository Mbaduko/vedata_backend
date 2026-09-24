import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { sendResponse, parsePagination, buildMeta } from '../utils/helpers';
import { getParam } from '../utils/types';
import { AuthenticatedRequest } from '../middleware/auth';

export const getVaccinations = catchAsync(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query as Record<string, string>);

  const where: Record<string, string> = {};
  const q = req.query as Record<string, string>;
  if (q.animalId) where.animalId = q.animalId;
  if (q.vaccineId) where.vaccineId = q.vaccineId;

  const [vaccinations, total] = await Promise.all([
    prisma.vaccination.findMany({
      where,
      include: {
        animal: { select: { id: true, tagNumber: true, species: { select: { name: true } } } },
        vaccine: { select: { id: true, name: true, disease: { select: { name: true } } } },
        administeredBy: { select: { id: true, name: true } },
      },
      orderBy: { dateAdministered: 'desc' },
      skip,
      take: limit,
    }),
    prisma.vaccination.count({ where }),
  ]);

  sendResponse(res, { data: vaccinations, meta: buildMeta(total, page, limit) });
});

export const getDueVaccinations = catchAsync(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const now = new Date();

  let zoneFilter: Record<string, unknown> = {};
  if (authReq.user.role !== 'superadmin') {
    zoneFilter = { zoneId: { in: authReq.user.zoneRoles.map((zr) => zr.zoneId) } };
  }

  const animals = await prisma.animal.findMany({
    where: { ...zoneFilter, healthStatus: { not: 'deceased' } },
    select: { id: true },
  });

  const animalIds = animals.map((a) => a.id);

  const dueVaccinations = await prisma.vaccination.findMany({
    where: {
      animalId: { in: animalIds },
      nextDueDate: { not: null },
    },
    include: {
      animal: {
        include: {
          species: { select: { name: true } },
          owner: { select: { id: true, name: true } },
        },
      },
      vaccine: { select: { id: true, name: true, disease: { select: { name: true } } } },
    },
    orderBy: { nextDueDate: 'asc' },
  });

  const result = dueVaccinations.map((vac) => {
    const dueDate = new Date(vac.nextDueDate!);
    const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      ...vac,
      isOverdue: diffDays < 0,
      daysOverdue: diffDays < 0 ? Math.abs(diffDays) : 0,
      daysUntilDue: diffDays >= 0 ? diffDays : 0,
      status: diffDays < 0 ? 'overdue' : diffDays <= 14 ? 'due_soon' : 'upcoming',
    };
  });

  result.sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  sendResponse(res, { data: result });
});

export const getVaccination = catchAsync(async (req: Request, res: Response) => {
  const vaccination = await prisma.vaccination.findUnique({
    where: { id: getParam(req, 'id') },
    include: {
      animal: {
        include: {
          species: { select: { name: true } },
          owner: { select: { id: true, name: true, phone: true } },
        },
      },
      vaccine: { select: { id: true, name: true, disease: { select: { name: true } } } },
      administeredBy: { select: { id: true, name: true } },
    },
  });

  if (!vaccination) throw new AppError('Vaccination not found.', 404);

  sendResponse(res, { data: vaccination });
});

export const recordVaccination = catchAsync(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { animalId, vaccineId, doseNumber, dateAdministered, batchNumber, photoEvidenceUrl, gpsLat, gpsLng } = req.body as {
    animalId: string;
    vaccineId: string;
    doseNumber: number;
    dateAdministered: string;
    batchNumber: string;
    photoEvidenceUrl?: string;
    gpsLat?: number;
    gpsLng?: number;
  };

  const animal = await prisma.animal.findUnique({ where: { id: animalId } });
  if (!animal) throw new AppError('Animal not found.', 404);
  if (animal.healthStatus === 'deceased') throw new AppError('Cannot vaccinate a deceased animal.', 400);

  const vaccine = await prisma.vaccine.findUnique({ where: { id: vaccineId } });
  if (!vaccine) throw new AppError('Vaccine not found.', 404);

  let nextDueDate: Date | null = null;
  const nextSchedule = await prisma.vaccineSchedule.findFirst({
    where: { vaccineId, doseNumber: doseNumber + 1 },
  });
  if (nextSchedule) {
    const base = new Date(dateAdministered);
    base.setDate(base.getDate() + nextSchedule.intervalDaysFromPrevious);
    nextDueDate = base;
  }

  let editableUntil: Date | null = null;
  if (authReq.user.role === 'technician') {
    const zone = await prisma.zone.findUnique({ where: { id: animal.zoneId } });
    const graceHours = zone?.technicianGracePeriodHours || 24;
    editableUntil = new Date(Date.now() + graceHours * 60 * 60 * 1000);
  }

  const vaccination = await prisma.vaccination.create({
    data: {
      animalId,
      vaccineId,
      doseNumber,
      dateAdministered: new Date(dateAdministered),
      batchNumber,
      administeredByUserId: authReq.user.id,
      nextDueDate,
      photoEvidenceUrl: photoEvidenceUrl || null,
      gpsLat: gpsLat || null,
      gpsLng: gpsLng || null,
      editableUntil,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: authReq.user.id,
      action: 'vaccination.record',
      entity: 'vaccination',
      entityId: vaccination.id,
      zoneId: animal.zoneId,
    },
  });

  sendResponse(res, { statusCode: 201, data: vaccination, message: 'Vaccination recorded.' });
});

export const updateVaccination = catchAsync(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;

  const vaccination = await prisma.vaccination.findUnique({ where: { id: getParam(req, 'id') } });
  if (!vaccination) throw new AppError('Vaccination not found.', 404);

  if (authReq.user.role === 'technician') {
    if (vaccination.administeredByUserId !== authReq.user.id) {
      throw new AppError('You can only edit your own records.', 403);
    }
    if (vaccination.editableUntil && new Date() > vaccination.editableUntil) {
      throw new AppError('Grace period expired. Ask a vet to edit.', 403);
    }
  }

  const { dateAdministered, batchNumber, doseNumber } = req.body as {
    dateAdministered?: string;
    batchNumber?: string;
    doseNumber?: number;
  };

  const updated = await prisma.vaccination.update({
    where: { id: getParam(req, 'id') },
    data: {
      ...(dateAdministered && { dateAdministered: new Date(dateAdministered) }),
      ...(batchNumber && { batchNumber }),
      ...(doseNumber && { doseNumber }),
    },
  });

  sendResponse(res, { data: updated, message: 'Vaccination updated.' });
});
