import { PrismaClient } from "@prisma/client";
import { accountEncryptionMiddleware } from "./db-middleware";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Use singleton pattern in both development AND production
// This prevents connection exhaustion in serverless environments
const prismaClient = globalThis.prisma || new PrismaClient();

// Register middleware for automatic OAuth token encryption/decryption
// Only register once (when creating a new client, not reusing from globalThis)
if (!globalThis.prisma) {
  prismaClient.$use(accountEncryptionMiddleware());
}

// Always store in globalThis to reuse connections
globalThis.prisma = prismaClient;

export { prismaClient as prisma };
export default prismaClient;
