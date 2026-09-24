import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import config from '../config';
import { prisma } from '../utils/prisma';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { sendResponse } from '../utils/helpers';
import { AuthenticatedRequest } from '../middleware/auth';

const signToken = (userId: string): string =>
  jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: config.jwtExpiresIn } as SignOptions);

const signRefreshToken = (userId: string): string =>
  jwt.sign({ sub: userId }, config.jwtRefreshSecret, { expiresIn: config.jwtRefreshExpiresIn } as SignOptions);

const createSendTokens = (userId: string, res: Response) => {
  const accessToken = signToken(userId);
  const refreshToken = signRefreshToken(userId);

  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  return { accessToken, refreshToken };
};

export const register = catchAsync(async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body as {
    name: string;
    email: string;
    password: string;
    role?: string;
  };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError('Email already registered.', 409);
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: role || 'technician',
    },
    select: { id: true, name: true, email: true, role: true },
  });

  const tokens = createSendTokens(user.id, res);

  sendResponse(res, {
    statusCode: 201,
    data: { user, ...tokens },
    message: 'Registration successful.',
  });
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError('Invalid email or password.', 401);
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new AppError('Invalid email or password.', 401);
  }

  if (user.status !== 'active') {
    throw new AppError('Account suspended. Contact your administrator.', 403);
  }

  const tokens = createSendTokens(user.id, res);

  sendResponse(res, {
    data: {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      ...tokens,
    },
    message: 'Login successful.',
  });
});

export const refreshToken = catchAsync(async (req: Request, res: Response) => {
  const { refresh_token } = req.cookies;
  if (!refresh_token) {
    throw new AppError('No refresh token provided.', 401);
  }

  let decoded: { sub: string };
  try {
    decoded = jwt.verify(refresh_token, config.jwtRefreshSecret) as { sub: string };
  } catch {
    throw new AppError('Invalid or expired refresh token.', 401);
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
  if (!user || user.status !== 'active') {
    throw new AppError('User not found or suspended.', 401);
  }

  const tokens = createSendTokens(user.id, res);

  sendResponse(res, {
    data: tokens,
    message: 'Token refreshed.',
  });
});

export const logout = catchAsync(async (req: Request, res: Response) => {
  res.cookie('access_token', '', { maxAge: 0 });
  res.cookie('refresh_token', '', { maxAge: 0 });

  sendResponse(res, { message: 'Logged out successfully.' });
});

export const getMe = catchAsync(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { getUserPermissions, getDashboardPermissions } = require('../utils/permissions');
  
  const permissions = getUserPermissions(authReq.user);
  const dashboardPerms = getDashboardPermissions(authReq.user);

  sendResponse(res, {
    data: {
      id: authReq.user.id,
      name: authReq.user.name,
      email: authReq.user.email,
      role: authReq.user.role,
      zoneRoles: authReq.user.zoneRoles.map((zr) => ({
        id: zr.id,
        zoneId: zr.zoneId,
        zoneName: zr.zone.name,
        role: zr.role,
        isLead: zr.isLead,
        status: zr.status,
      })),
      permissions,
      dashboardPermissions: dashboardPerms,
    },
  });
});
