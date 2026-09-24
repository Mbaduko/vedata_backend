import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { sendResponse, parsePagination, buildMeta } from '../utils/helpers';
import { getParam } from '../utils/types';
import { AuthenticatedRequest } from '../middleware/auth';

export const getOwners = catchAsync(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query as Record<string, string>);

  const where: Record<string, unknown> = {};
  const search = (req.query as Record<string, string>).search;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { nid: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const zoneId = (req.query as Record<string, string>).zoneId;
  if (zoneId) where.zoneId = zoneId;

  const [owners, total] = await Promise.all([
    prisma.owner.findMany({
      where,
      include: {
        zone: { select: { id: true, name: true } },
        _count: { select: { animals: true } },
      },
      orderBy: { name: 'asc' },
      skip,
      take: limit,
    }),
    prisma.owner.count({ where }),
  ]);

  sendResponse(res, { data: owners, meta: buildMeta(total, page, limit) });
});

export const getOwner = catchAsync(async (req: Request, res: Response) => {
  const owner = await prisma.owner.findUnique({
    where: { id: getParam(req, 'id') },
    include: {
      zone: { select: { id: true, name: true } },
      animals: {
        include: {
          species: { select: { id: true, name: true } },
          breed: { select: { id: true, name: true } },
        },
        orderBy: { registeredAt: 'desc' },
      },
    },
  });

  if (!owner) throw new AppError('Owner not found.', 404);

  sendResponse(res, { data: owner });
});

export const createOwner = catchAsync(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { nid, name, phone, email, address, zoneId } = req.body as {
    nid: string;
    name: string;
    phone: string;
    email?: string;
    address?: string;
    zoneId: string;
  };

  const existing = await prisma.owner.findUnique({ where: { nid } });
  if (existing) {
    throw new AppError('An owner with this National ID already exists.', 409);
  }

  const owner = await prisma.owner.create({
    data: { nid, name, phone, email: email || null, address: address || null, zoneId },
  });

  await prisma.auditLog.create({
    data: {
      userId: authReq.user.id,
      action: 'owner.create',
      entity: 'owner',
      entityId: owner.id,
      zoneId,
    },
  });

  sendResponse(res, { statusCode: 201, data: owner, message: 'Owner created.' });
});

export const updateOwner = catchAsync(async (req: Request, res: Response) => {
  const owner = await prisma.owner.findUnique({ where: { id: getParam(req, 'id') } });
  if (!owner) throw new AppError('Owner not found.', 404);

  const { name, phone, email, address } = req.body as {
    name?: string;
    phone?: string;
    email?: string | null;
    address?: string | null;
  };

  const updated = await prisma.owner.update({
    where: { id: getParam(req, 'id') },
    data: {
      ...(name && { name }),
      ...(phone && { phone }),
      ...(email !== undefined && { email: email || null }),
      ...(address !== undefined && { address: address || null }),
    },
  });

  sendResponse(res, { data: updated, message: 'Owner updated.' });
});
