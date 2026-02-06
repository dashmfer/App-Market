import { PrismaClient } from "@prisma/client";
import { accountEncryptionMiddleware } from "./db-middleware";

declare global {
  var prisma: PrismaClient | undefined;
}

// Use singleton pattern in both development AND production
// This prevents connection exhaustion in serverless environments
export const prisma = globalThis.prisma || new PrismaClient();

// Register middleware for automatic OAuth token encryption/decryption
// Only register once (when creating a new client, not reusing from globalThis)
if (!globalThis.prisma) {
  prisma.$use(accountEncryptionMiddleware());
}

// Always store in globalThis to reuse connections
globalThis.prisma = prisma;

export default prisma;
