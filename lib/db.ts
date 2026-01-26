import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

// Use singleton pattern in both development AND production
// This prevents connection exhaustion in serverless environments
export const prisma = globalThis.prisma || new PrismaClient();

// Always store in globalThis to reuse connections
globalThis.prisma = prisma;

export default prisma;
