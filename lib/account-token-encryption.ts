/**
 * Middleware for encrypting/decrypting OAuth tokens in the Account model.
 * Tokens are encrypted at rest using AES-256-GCM via lib/encryption.ts.
 * AAD (Additional Authenticated Data) binds ciphertexts to their account,
 * preventing cross-record swap attacks.
 */

import { encrypt, decrypt, looksEncrypted } from "./encryption";

const TOKEN_FIELDS = ["refresh_token", "access_token", "id_token"] as const;

/**
 * Encrypt OAuth tokens before storing in the database.
 * @param aad - Account identifier (e.g., providerAccountId) to bind ciphertext to this record.
 */
export function encryptAccountTokens<T extends Record<string, any>>(data: T, aad?: string): T {
  const encrypted: Record<string, any> = { ...data };
  for (const field of TOKEN_FIELDS) {
    if (encrypted[field] && typeof encrypted[field] === "string") {
      try {
        // Don't double-encrypt
        if (!looksEncrypted(encrypted[field])) {
          encrypted[field] = encrypt(encrypted[field], aad);
        }
      } catch (error) {
        // SECURITY: Log structured warning for monitoring — token will be stored in plaintext
        console.error("[Token Encryption] SECURITY WARNING: Failed to encrypt field:", { field, error });
        if (process.env.NODE_ENV === "production") {
          console.error(`[Token Encryption] ALERT: ${field} stored UNENCRYPTED — investigate immediately`);
        }
      }
    }
  }
  return encrypted as T;
}

/**
 * Decrypt OAuth tokens after reading from the database.
 * @param aad - Must match the AAD used during encryption, or decryption will fail.
 */
export function decryptAccountTokens<T extends Record<string, any>>(data: T, aad?: string): T {
  const decrypted: Record<string, any> = { ...data };
  for (const field of TOKEN_FIELDS) {
    if (decrypted[field] && typeof decrypted[field] === "string") {
      try {
        if (looksEncrypted(decrypted[field])) {
          decrypted[field] = decrypt(decrypted[field], aad);
        }
      } catch (error) {
        // SECURITY: Log structured warning — may indicate key rotation issue or corruption
        console.error("[Token Encryption] SECURITY WARNING: Failed to decrypt field:", { field, error });
        if (process.env.NODE_ENV === "production") {
          console.error(`[Token Encryption] ALERT: ${field} decryption failed — possible key mismatch or corruption`);
        }
        // Return the raw value if decryption fails (may be unencrypted legacy data)
      }
    }
  }
  return decrypted as T;
}
