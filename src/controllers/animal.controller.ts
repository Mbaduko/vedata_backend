import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { sendResponse, parsePagination, buildMeta, parseSort } from '../utils/helpers';
import { getParam } from '../utils/types';
import { AuthenticatedRequest } from '../middleware/auth';

export const getAnimals = catchAsync(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { page, limit, skip } = parsePagination(req.query as Record<string, string>);

  const where: Record<string, unknown> = {};

  // Scope by user's zones
  if (authReq.user.role === 'technician') {
    where.zoneId = { in: authReq.user.zoneRoles.map((zr) => zr.zoneId) };
  }

  // Search
  const search = (req.query as Record<string, string>).search;
  if (search) {
    where.OR = [
      { tagNumber: { contains: search, mode: 'insensitive' } },
      { owner: { name: { contains: search, mode: 'insensitive' } } },
      { owner: { nid: { contains: search, mode: 'insensitive' } } },
    ];
  }

  // Filters
  const q = req.query as Record<string, string>;
  if (q.speciesId) where.speciesId = q.speciesId;
  if (q.healthStatus) where.healthStatus = q.healthStatus;
  if (q.zoneId) where.zoneId = q.zoneId;
  if (q.ownerId) where.ownerId = q.ownerId;

  const orderBy = parseSort(q, ['registeredAt', 'tagNumber', 'healthStatus'], 'registeredAt', 'desc');

  const [animals, total] = await Promise.all([
    prisma.animal.findMany({
      where,
      include: {
        species: { select: { id: true, name: true } },
        breed: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true, nid: true } },
        zone: { select: { id: true, name: true } },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.animal.count({ where }),
  ]);

  sendResponse(res, { data: animals, meta: buildMeta(total, page, limit) });
});

export const getAnimal = catchAsync(async (req: Request, res: Response) => {
  const animal = await prisma.animal.findUnique({
    where: { id: getParam(req, 'id') },
    include: {
      species: { select: { id: true, name: true } },
      breed: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true, nid: true, phone: true, email: true } },
      zone: { select: { id: true, name: true } },
      enteredBy: { select: { id: true, name: true } },
      vaccinations: {
        orderBy: { dateAdministered: 'desc' },
        include: {
          vaccine: {
            select: { id: true, name: true, disease: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (!animal) throw new AppError('Animal not found.', 404);

  sendResponse(res, { data: animal });
});

export const createAnimal = catchAsync(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { tagNumber, speciesId, breedId, sex, dateOfBirth, ownerId, zoneId, healthStatus } = req.body as {
    tagNumber: string;
    speciesId: string;
    breedId?: string;
    sex: string;
    dateOfBirth: string;
    ownerId: string;
    zoneId: string;
    healthStatus?: string;
  };

  const existingTag = await prisma.animal.findUnique({ where: { tagNumber } });
  if (existingTag) throw new AppError('Tag number already exists.', 409);

  const species = await prisma.species.findUnique({ where: { id: speciesId } });
  if (!species) throw new AppError('Species not found.', 404);

  const owner = await prisma.owner.findUnique({ where: { id: ownerId } });
  if (!owner) throw new AppError('Owner not found.', 404);

  let editableUntil: Date | null = null;
  if (authReq.user.role === 'technician') {
    const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
    const graceHours = zone?.technicianGracePeriodHours || 24;
    editableUntil = new Date(Date.now() + graceHours * 60 * 60 * 1000);
  }

  const animal = await prisma.animal.create({
    data: {
      tagNumber,
      speciesId,
      breedId: breedId || null,
      sex,
      dateOfBirth: new Date(dateOfBirth),
      ownerId,
      zoneId,
      healthStatus: healthStatus || 'healthy',
      enteredByUserId: authReq.user.id,
      editableUntil,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: authReq.user.id,
      action: 'animal.create',
      entity: 'animal',
      entityId: animal.id,
      zoneId,
    },
  });

  sendResponse(res, { statusCode: 201, data: animal, message: 'Animal registered.' });
});

export const updateAnimal = catchAsync(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;

  const animal = await prisma.animal.findUnique({ where: { id: getParam(req, 'id') } });
  if (!animal) throw new AppError('Animal not found.', 404);

  if (authReq.user.role === 'technician') {
    if (animal.enteredByUserId !== authReq.user.id) {
      throw new AppError('You can only edit your own records.', 403);
    }
    if (animal.editableUntil && new Date() > animal.editableUntil) {
      throw new AppError('Grace period expired. Ask a vet to edit.', 403);
    }
  }

  const { speciesId, breedId, sex, dateOfBirth, healthStatus } = req.body as {
    speciesId?: string;
    breedId?: string | null;
    sex?: string;
    dateOfBirth?: string;
    healthStatus?: string;
  };

  const updated = await prisma.animal.update({
    where: { id: getParam(req, 'id') },
    data: {
      ...(speciesId && { speciesId }),
      ...(breedId !== undefined && { breedId: breedId || null }),
      ...(sex && { sex }),
      ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
      ...(healthStatus && { healthStatus }),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: authReq.user.id,
      action: 'animal.update',
      entity: 'animal',
      entityId: getParam(req, 'id'),
      zoneId: animal.zoneId,
    },
  });

  sendResponse(res, { data: updated, message: 'Animal updated.' });
});

export const markDeceased = catchAsync(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { reason, date } = req.body as { reason: string; date: string };

  const animal = await prisma.animal.findUnique({ where: { id: getParam(req, 'id') } });
  if (!animal) throw new AppError('Animal not found.', 404);
  if (animal.healthStatus === 'deceased') throw new AppError('Animal is already deceased.', 400);

  const updated = await prisma.animal.update({
    where: { id: getParam(req, 'id') },
    data: {
      healthStatus: 'deceased',
      deceasedReason: reason,
      deceasedDate: new Date(date),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: authReq.user.id,
      action: 'animal.deceased',
      entity: 'animal',
      entityId: getParam(req, 'id'),
      zoneId: animal.zoneId,
      metadata: { reason, date },
    },
  });

  sendResponse(res, { data: updated, message: 'Animal marked as deceased.' });
});

export const deleteAnimal = catchAsync(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;

  const animal = await prisma.animal.findUnique({ where: { id: getParam(req, 'id') } });
  if (!animal) throw new AppError('Animal not found.', 404);

  await prisma.animal.delete({ where: { id: getParam(req, 'id') } });

  await prisma.auditLog.create({
    data: {
      userId: authReq.user.id,
      action: 'animal.delete',
      entity: 'animal',
      entityId: getParam(req, 'id'),
      zoneId: animal.zoneId,
    },
  });

  sendResponse(res, { message: 'Animal deleted.' });
});
