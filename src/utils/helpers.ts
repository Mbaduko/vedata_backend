import { Response } from 'express';

interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface SendResponseOptions {
  statusCode?: number;
  data?: unknown;
  message?: string | null;
  meta?: PaginationMeta | null;
}

export const sendResponse = (res: Response, options: SendResponseOptions): void => {
  const { statusCode = 200, data = null, message = null, meta = null } = options;
  const body: Record<string, unknown> = {
    status: statusCode < 400 ? 'success' : 'fail',
  };
  if (message) body.message = message;
  if (data !== null) body.data = data;
  if (meta) body.meta = meta;
  res.status(statusCode).json(body);
};

export const parsePagination = (query: Record<string, string>): PaginationParams => {
  const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

export const buildMeta = (total: number, page: number, limit: number): PaginationMeta => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
  hasNext: page * limit < total,
  hasPrev: page > 1,
});

export const parseSort = (
  query: Record<string, string>,
  allowedFields: string[],
  defaultField: string = 'createdAt',
  defaultOrder: 'asc' | 'desc' = 'desc',
): Record<string, 'asc' | 'desc'> => {
  const field = allowedFields.includes(query.sortBy) ? query.sortBy : defaultField;
  const order = (['asc', 'desc'].includes(query.sortOrder) ? query.sortOrder : defaultOrder) as 'asc' | 'desc';
  return { [field]: order };
};

/**
 * Build Prisma where clause from a search string across multiple fields.
 */
export const buildSearchWhere = (
  search: string | undefined | string[],
  fields: string[],
): Record<string, unknown> => {
  const q = Array.isArray(search) ? search[0] : search;
  if (!q || q.trim().length === 0) return {};
  return {
    OR: fields.map((field) => ({
      [field]: { contains: q.trim(), mode: 'insensitive' },
    })),
  };
};
