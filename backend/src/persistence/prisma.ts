import '../config/load-root-env.js';
import { PrismaClient } from '@prisma/client';

// Singleton Prisma client for backend use.
// Instantiated once; callers import this instance directly.
export const prisma = new PrismaClient();
