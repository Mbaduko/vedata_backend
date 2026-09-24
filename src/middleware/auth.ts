import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { catchAsync } from '../utils/catchAsync';
import { User, UserZoneRole, Zone } from '@prisma/client';

export interface AuthenticatedUser extends User {
  zoneRoles: (UserZoneRole & { zone: Zone })[];
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

interface JwtPayload {
  sub: string;
  iat: number;
  exp: number;
}

/**
 * Authenticate a request by verifying the JWT in the Authorization header
 * or the access_token cookie.
 */
export const authenticate = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  let token: string | undefined;

  // Check Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  // Check cookie
  else if (req.cookies?.access_token) {
    token = req.cookies.access_token;
  }

  if (!token) {
    return next(new AppError('Not authenticated. Please log in.', 401));
  }

  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
  } catch (err) {
    if ((err as jwt.TokenExpiredError).name === 'TokenExpiredError') {
      return next(new AppError('Token expired. Please log in again.', 401));
    }
    return next(new AppError('Invalid token.', 401));
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.sub },
    include: {
      zoneRoles: {
        where: { status: 'active' },
        include: { zone: true },
      },
    },
  });

  if (!user) {
    return next(new AppError('User no longer exists.', 401));
  }

  if (user.status !== 'active') {
    return next(new AppError('Account suspended. Contact your administrator.', 403));
  }

  (req as AuthenticatedRequest).user = user as AuthenticatedUser;
  next();
});

/**
 * Restrict access to specific roles.
 * Must be used after authenticate.
 */
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      next(new AppError('Not authenticated.', 401));
      return;
    }
    if (!roles.includes(authReq.user.role)) {
      next(new AppError('Insufficient permissions for this action.', 403));
      return;
    }
    next();
  };
};

/**
 * Restrict access to a specific zone.
 * For vets/technicians, checks that they have an active role in the zone.
 * Superadmins can access any zone.
 */
export const authorizeZone = (req: Request, res: Response, next: NextFunction): void => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) {
    next(new AppError('Not authenticated.', 401));
    return;
  }

  // Superadmins can access any zone
  if (authReq.user.role === 'superadmin') {
    next();
    return;
  }

  // Get zone ID from params, body, or query
  const zoneId = (req.params as Record<string, string>).zoneId
    || (req.body as Record<string, string>).zoneId
    || (req.query as Record<string, string>).zoneId;

  if (!zoneId) {
    next();
    return;
  }

  const hasAccess = authReq.user.zoneRoles.some((zr) => zr.zoneId === zoneId);
  if (!hasAccess) {
    next(new AppError('You do not have access to this zone.', 403));
    return;
  }

  next();
};

/**
 * Require specific permission(s) to access a route.
 * Must be used after authenticate.
 */
export const requirePermission = (...permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      next(new AppError('Not authenticated.', 401));
      return;
    }

    // Import permission checker dynamically to avoid circular dependency
    const { hasAnyPermission } = require('../utils/permissions');
    
    const hasAccess = hasAnyPermission(authReq.user, permissions);
    if (!hasAccess) {
      next(new AppError('You do not have permission to perform this action.', 403));
      return;
    }

    next();
  };
};
