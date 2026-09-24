import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { sendResponse } from '../utils/helpers';
import { getParam } from '../utils/types';
import { AuthenticatedRequest } from '../middleware/auth';

export const getDiseases = catchAsync(async (req: Request, res: Response) => {
  const diseases = await prisma.disease.findMany({
    include: {
      species: { include: { species: { select: { id: true, name: true } } } },
      vaccines: {
        include: { schedules: { orderBy: { doseNumber: 'asc' } } },
      },
    },
    orderBy: { name: 'asc' },
  });

  sendResponse(res, { data: diseases });
});

export const createDisease = catchAsync(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { name, applicableSpeciesIds } = req.body as { name: string; applicableSpeciesIds: string[] };

  const disease = await prisma.disease.create({
    data: {
      name,
      species: { create: applicableSpeciesIds.map((speciesId) => ({ speciesId })) },
    },
    include: { species: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: authReq.user.id,
      action: 'config.disease_create',
      entity: 'disease',
      entityId: disease.id,
    },
  });

  sendResponse(res, { statusCode: 201, data: disease, message: 'Disease created.' });
});

export const updateDisease = catchAsync(async (req: Request, res: Response) => {
  const disease = await prisma.disease.findUnique({ where: { id: getParam(req, 'id') } });
  if (!disease) throw new AppError('Disease not found.', 404);

  const { name, applicableSpeciesIds } = req.body as { name?: string; applicableSpeciesIds?: string[] };

  if (applicableSpeciesIds) {
    await prisma.diseaseSpecies.deleteMany({ where: { diseaseId: getParam(req, 'id') } });
    await prisma.diseaseSpecies.createMany({
      data: applicableSpeciesIds.map((speciesId) => ({ diseaseId: getParam(req, 'id'), speciesId })),
    });
  }

  const updated = await prisma.disease.update({
    where: { id: getParam(req, 'id') },
    data: name ? { name } : {},
    include: { species: { include: { species: { select: { id: true, name: true } } } } },
  });

  sendResponse(res, { data: updated, message: 'Disease updated.' });
});

export const getVaccines = catchAsync(async (req: Request, res: Response) => {
  const vaccines = await prisma.vaccine.findMany({
    where: { diseaseId: getParam(req, 'diseaseId') },
    include: { schedules: { orderBy: { doseNumber: 'asc' } } },
  });

  sendResponse(res, { data: vaccines });
});

export const createVaccine = catchAsync(async (req: Request, res: Response) => {
  const { name, manufacturer } = req.body as { name: string; manufacturer?: string };
  const diseaseId = getParam(req, 'diseaseId');

  const disease = await prisma.disease.findUnique({ where: { id: diseaseId } });
  if (!disease) throw new AppError('Disease not found.', 404);

  const vaccine = await prisma.vaccine.create({
    data: { name, diseaseId, manufacturer: manufacturer || null },
  });

  sendResponse(res, { statusCode: 201, data: vaccine, message: 'Vaccine created.' });
});

export const updateVaccine = catchAsync(async (req: Request, res: Response) => {
  const vaccine = await prisma.vaccine.findUnique({ where: { id: getParam(req, 'vaccineId') } });
  if (!vaccine) throw new AppError('Vaccine not found.', 404);

  const { name, manufacturer } = req.body as { name?: string; manufacturer?: string };
  const updated = await prisma.vaccine.update({
    where: { id: getParam(req, 'vaccineId') },
    data: {
      ...(name && { name }),
      ...(manufacturer !== undefined && { manufacturer: manufacturer || null }),
    },
  });

  sendResponse(res, { data: updated, message: 'Vaccine updated.' });
});

export const getSchedules = catchAsync(async (req: Request, res: Response) => {
  const schedules = await prisma.vaccineSchedule.findMany({
    where: { vaccineId: getParam(req, 'vaccineId') },
    orderBy: { doseNumber: 'asc' },
  });

  sendResponse(res, { data: schedules });
});

export const createSchedule = catchAsync(async (req: Request, res: Response) => {
  const { doseNumber, intervalDaysFromPrevious, isRecurring, recurrenceIntervalDays } = req.body as {
    doseNumber: number;
    intervalDaysFromPrevious?: number;
    isRecurring?: boolean;
    recurrenceIntervalDays?: number;
  };
  const vaccineId = getParam(req, 'vaccineId');

  const vaccine = await prisma.vaccine.findUnique({ where: { id: vaccineId } });
  if (!vaccine) throw new AppError('Vaccine not found.', 404);

  const schedule = await prisma.vaccineSchedule.create({
    data: {
      vaccineId,
      doseNumber,
      intervalDaysFromPrevious: intervalDaysFromPrevious || 0,
      isRecurring: isRecurring || false,
      recurrenceIntervalDays: recurrenceIntervalDays || null,
    },
  });

  sendResponse(res, { statusCode: 201, data: schedule, message: 'Schedule created.' });
});

export const deleteSchedule = catchAsync(async (req: Request, res: Response) => {
  const schedule = await prisma.vaccineSchedule.findUnique({ where: { id: getParam(req, 'scheduleId') } });
  if (!schedule) throw new AppError('Schedule not found.', 404);

  await prisma.vaccineSchedule.delete({ where: { id: getParam(req, 'scheduleId') } });

  sendResponse(res, { message: 'Schedule deleted.' });
});
