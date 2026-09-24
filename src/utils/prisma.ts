import { PrismaClient } from '@prisma/client';
import config from '../config';

let prisma: PrismaClient;

if (config.env === 'production') {
  prisma = new PrismaClient({
    log: ['error', 'warn'],
  });
} else {
  if (!(globalThis as Record<string, unknown>).__prisma) {
    (globalThis as Record<string, unknown>).__prisma = new PrismaClient({
      log: ['query', 'error', 'warn'],
    });
  }
  prisma = (globalThis as Record<string, unknown>).__prisma as PrismaClient;
}

export { prisma };
