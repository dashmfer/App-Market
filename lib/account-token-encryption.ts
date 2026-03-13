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
        // SECURITY: In production, refuse to store tokens unencrypted.
        // Silently falling through to plaintext storage is a data breach risk.
        if (process.env.NODE_ENV === "production") {
          console.error("[Token Encryption] CRITICAL: Encryption failed, refusing to store plaintext:", { field, error });
          throw new Error(`Encryption failed for ${field} — refusing to store unencrypted token in production`);
        }
        // In development, log warning and continue (allows dev without ENCRYPTION_SECRET)
        console.error("[Token Encryption] WARNING: Failed to encrypt field (dev only):", { field, error });
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
        // SECURITY: In production, fail loudly on decryption failure.
        // Returning raw ciphertext could expose garbled data to downstream consumers.
        if (process.env.NODE_ENV === "production") {
          console.error("[Token Encryption] CRITICAL: Decryption failed:", { field, error });
          throw new Error(`Decryption failed for ${field} — possible key mismatch or data corruption`);
        }
        // In development, log and return raw value for backward compatibility
        console.error("[Token Encryption] WARNING: Decryption failed (dev only):", { field, error });
      }
    }
  }
  return decrypted as T;
}
