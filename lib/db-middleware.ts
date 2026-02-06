/**
 * Prisma middleware for automatic OAuth token encryption/decryption.
 * Applied globally to ensure tokens are always encrypted at rest.
 */

import { Prisma } from "@prisma/client";
import { encryptAccountTokens, decryptAccountTokens } from "./account-token-encryption";

export function accountEncryptionMiddleware(): Prisma.Middleware {
  return async (params, next) => {
    // Encrypt tokens before writing to Account table
    if (params.model === "Account") {
      if (params.action === "create" && params.args.data) {
        params.args.data = encryptAccountTokens(params.args.data);
      }
      if (params.action === "update" && params.args.data) {
        params.args.data = encryptAccountTokens(params.args.data);
      }
      if (params.action === "upsert") {
        if (params.args.create) {
          params.args.create = encryptAccountTokens(params.args.create);
        }
        if (params.args.update) {
          params.args.update = encryptAccountTokens(params.args.update);
        }
      }
    }

    const result = await next(params);

    // Decrypt tokens after reading from Account table
    if (params.model === "Account" && result) {
      if (Array.isArray(result)) {
        return result.map(decryptAccountTokens);
      }
      if (typeof result === "object" && result !== null) {
        return decryptAccountTokens(result);
      }
    }

    return result;
  };
}
