import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import config from '../config';
import { AppError } from '../utils/AppError';

interface PrismaError extends Error {
  code?: string;
  meta?: { target?: string[] };
}

export const errorHandler: ErrorRequestHandler = (
  err: Error | AppError | PrismaError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  let error = err;
  let statusCode = 500;
  let status = 'error';
  let message = err.message;
  let details: unknown = null;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    status = err.status;
    message = err.message;
    details = err.details;
  }

  // Prisma known request errors
  const prismaErr = err as PrismaError;
  if (prismaErr.code === 'P2002') {
    const field = prismaErr.meta?.target?.[0] || 'field';
    statusCode = 409;
    status = 'fail';
    message = `Duplicate value for ${field}. Already exists.`;
  }

  if (prismaErr.code === 'P2025') {
    statusCode = 404;
    status = 'fail';
    message = 'Record not found.';
  }

  if (prismaErr.code === 'P2003') {
    statusCode = 400;
    status = 'fail';
    message = 'Referenced record not found.';
  }

  // Development: send full error details
  if (config.env === 'development') {
    res.status(statusCode).json({
      status,
      error: err,
      message,
      details,
      stack: err.stack,
    });
    return;
  }

  // Production: send sanitized response
  if (statusCode < 500) {
    res.status(statusCode).json({
      status,
      message,
      details,
    });
    return;
  }

  // Programming or unknown errors
  console.error('💥 UNEXPECTED ERROR:', err);
  res.status(500).json({
    status: 'error',
    message: 'Something went wrong. Please try again later.',
  });
};
