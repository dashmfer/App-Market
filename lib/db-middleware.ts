/**
 * Prisma middleware for automatic OAuth token encryption/decryption.
 * Applied globally to ensure tokens are always encrypted at rest.
 * Uses providerAccountId as AAD to bind ciphertexts to their account record.
 */

import { Prisma } from "@prisma/client";
import { encryptAccountTokens, decryptAccountTokens } from "./account-token-encryption";

/**
 * Extract AAD (providerAccountId) from Prisma middleware params.
 * Falls back to undefined for legacy data that was encrypted without AAD.
 */
function extractAad(params: Prisma.MiddlewareParams, data?: Record<string, any>): string | undefined {
  // For create: providerAccountId is in the data payload
  if (data?.providerAccountId) {
    return `account:${data.providerAccountId}`;
  }
  // For update/upsert: providerAccountId might be in the where clause compound key
  if (params.args?.where?.provider_providerAccountId?.providerAccountId) {
    return `account:${params.args.where.provider_providerAccountId.providerAccountId}`;
  }
  return undefined;
}

export function accountEncryptionMiddleware(): Prisma.Middleware {
  return async (params, next) => {
    // Encrypt tokens before writing to Account table
    if (params.model === "Account") {
      if (params.action === "create" && params.args.data) {
        const aad = extractAad(params, params.args.data);
        params.args.data = encryptAccountTokens(params.args.data, aad);
      }
      if ((params.action === "update" || params.action === "updateMany") && params.args.data) {
        const aad = extractAad(params, params.args.data);
        params.args.data = encryptAccountTokens(params.args.data, aad);
      }
      if (params.action === "upsert") {
        if (params.args.create) {
          const aad = extractAad(params, params.args.create);
          params.args.create = encryptAccountTokens(params.args.create, aad);
        }
        if (params.args.update) {
          const aad = extractAad(params, params.args.update);
          params.args.update = encryptAccountTokens(params.args.update, aad);
        }
      }
    }

    const result = await next(params);

    // Decrypt tokens after reading from Account table
    if (params.model === "Account" && result) {
      if (Array.isArray(result)) {
        return result.map((r: Record<string, any>) =>
          decryptAccountTokens(r, r?.providerAccountId ? `account:${r.providerAccountId}` : undefined)
        );
      }
      if (typeof result === "object" && result !== null) {
        const aad = (result as any)?.providerAccountId
          ? `account:${(result as any).providerAccountId}`
          : undefined;
        return decryptAccountTokens(result, aad);
      }
    }

    return result;
  };
}
