/**
 * Middleware for encrypting/decrypting OAuth tokens in the Account model.
 * Tokens are encrypted at rest using AES-256-GCM via lib/encryption.ts.
 */

import { encrypt, decrypt, looksEncrypted } from "./encryption";

const TOKEN_FIELDS = ["refresh_token", "access_token", "id_token"] as const;

/**
 * Encrypt OAuth tokens before storing in the database
 */
export function encryptAccountTokens<T extends Record<string, any>>(data: T): T {
  const encrypted: Record<string, any> = { ...data };
  for (const field of TOKEN_FIELDS) {
    if (encrypted[field] && typeof encrypted[field] === "string") {
      try {
        // Don't double-encrypt
        if (!looksEncrypted(encrypted[field])) {
          encrypted[field] = encrypt(encrypted[field]);
        }
      } catch (error) {
        console.error(`[Token Encryption] Failed to encrypt ${field}:`, error);
        // Continue without encryption rather than breaking auth
      }
    }
  }
  return encrypted as T;
}

/**
 * Decrypt OAuth tokens after reading from the database
 */
export function decryptAccountTokens<T extends Record<string, any>>(data: T): T {
  const decrypted: Record<string, any> = { ...data };
  for (const field of TOKEN_FIELDS) {
    if (decrypted[field] && typeof decrypted[field] === "string") {
      try {
        if (looksEncrypted(decrypted[field])) {
          decrypted[field] = decrypt(decrypted[field]);
        }
      } catch (error) {
        console.error(`[Token Encryption] Failed to decrypt ${field}:`, error);
        // Return the raw value if decryption fails (may be unencrypted legacy data)
      }
    }
  }
  return decrypted as T;
}
