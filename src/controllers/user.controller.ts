import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../utils/prisma';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { sendResponse, parsePagination, buildMeta, buildSearchWhere } from '../utils/helpers';
import { getParam } from '../utils/types';

export const getUsers = catchAsync(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query as Record<string, string>);
  const searchWhere = buildSearchWhere(
    (req.query as Record<string, string>).search,
    ['name', 'email'],
  );

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: searchWhere,
      include: {
        zoneRoles: {
          include: { zone: { select: { id: true, name: true } } },
        },
      },
      orderBy: { name: 'asc' },
      skip,
      take: limit,
    }),
    prisma.user.count({ where: searchWhere }),
  ]);

  const sanitized = users.map(({ password: _, ...user }) => user);

  sendResponse(res, { data: sanitized, meta: buildMeta(total, page, limit) });
});

export const getUser = catchAsync(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: getParam(req, 'id') },
    include: {
      zoneRoles: {
        include: { zone: { select: { id: true, name: true } } },
      },
    },
  });

  if (!user) throw new AppError('User not found.', 404);

  sendResponse(res, { data: user });
});

export const createUser = catchAsync(async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body as {
    name: string;
    email: string;
    password?: string;
    role?: string;
  };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError('Email already registered.', 409);

  const hashedPassword = await bcrypt.hash(password || 'Vedata@123', 12);

  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword, role: role || 'technician' },
    select: { id: true, name: true, email: true, role: true },
  });

  sendResponse(res, { statusCode: 201, data: user, message: 'User created.' });
});

export const updateUser = catchAsync(async (req: Request, res: Response) => {
  const { name, email, role, status } = req.body as {
    name?: string;
    email?: string;
    role?: string;
    status?: string;
  };

  const user = await prisma.user.findUnique({ where: { id: getParam(req, 'id') } });
  if (!user) throw new AppError('User not found.', 404);

  const updated = await prisma.user.update({
    where: { id: getParam(req, 'id') },
    data: {
      ...(name && { name }),
      ...(email && { email }),
      ...(role && { role }),
      ...(status && { status }),
    },
    select: { id: true, name: true, email: true, role: true, status: true },
  });

  sendResponse(res, { data: updated, message: 'User updated.' });
});

export const assignToZone = catchAsync(async (req: Request, res: Response) => {
  const { zoneId, role, isLead, contractStart, contractEnd } = req.body as {
    zoneId: string;
    role: string;
    isLead?: boolean;
    contractStart?: string;
    contractEnd?: string;
  };

  const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
  if (!zone) throw new AppError('Zone not found.', 404);

  if (isLead) {
    await prisma.userZoneRole.updateMany({
      where: { zoneId, isLead: true },
      data: { isLead: false },
    });
  }

  const assignment = await prisma.userZoneRole.upsert({
    where: { userId_zoneId: { userId: getParam(req, 'id'), zoneId } },
    update: { role, isLead: isLead || false, contractStart: contractStart ? new Date(contractStart) : null, contractEnd: contractEnd ? new Date(contractEnd) : null },
    create: { userId: getParam(req, 'id'), zoneId, role, isLead: isLead || false, contractStart: contractStart ? new Date(contractStart) : null, contractEnd: contractEnd ? new Date(contractEnd) : null },
  });

  sendResponse(res, { data: assignment, message: 'User assigned to zone.' });
});
