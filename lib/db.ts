import { PrismaClient } from "@prisma/client";
import { accountEncryptionMiddleware } from "./db-middleware";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

// Use singleton pattern in both development AND production
// This prevents connection exhaustion in serverless environments
export const prisma = globalForPrisma.prisma || new PrismaClient();

// Register middleware for automatic OAuth token encryption/decryption
// Only register once (when creating a new client, not reusing from globalThis)
if (!globalForPrisma.prisma) {
  prisma.$use(accountEncryptionMiddleware());
}

// Always store in globalThis to reuse connections
globalForPrisma.prisma = prisma;

export default prisma;
