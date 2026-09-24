import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { sendResponse, parsePagination, buildMeta } from '../utils/helpers';
import { getParam } from '../utils/types';

export const getAuditLog = catchAsync(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query as Record<string, string>);

  const where: Record<string, unknown> = {};
  const q = req.query as Record<string, string>;

  if (q.search) {
    where.OR = [
      { user: { name: { contains: q.search, mode: 'insensitive' } } },
      { action: { contains: q.search, mode: 'insensitive' } },
      { entity: { contains: q.search, mode: 'insensitive' } },
      { entityId: { contains: q.search, mode: 'insensitive' } },
    ];
  }

  if (q.entity) where.entity = q.entity;
  if (q.action) where.action = { contains: q.action, mode: 'insensitive' };
  if (q.zoneId) where.zoneId = q.zoneId;
  if (q.userId) where.userId = q.userId;

  if (q.from || q.to) {
    where.timestamp = {};
    if (q.from) (where.timestamp as Record<string, Date>).gte = new Date(q.from);
    if (q.to) (where.timestamp as Record<string, Date>).lte = new Date(q.to);
  }

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true } } },
      orderBy: { timestamp: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  sendResponse(res, { data: entries, meta: buildMeta(total, page, limit) });
});

export const getAuditEntry = catchAsync(async (req: Request, res: Response) => {
  const entry = await prisma.auditLog.findUnique({
    where: { id: getParam(req, 'id') },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  if (!entry) throw new AppError('Audit entry not found.', 404);

  sendResponse(res, { data: entry });
});
