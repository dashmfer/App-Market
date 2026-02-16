/**
 * Encryption utilities for sensitive data at rest
 * Uses AES-256-GCM for authenticated encryption
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

/**
 * Derive an encryption key from the master secret
 */
function deriveKey(secret: string, salt: Buffer): Buffer {
  return scryptSync(secret, salt, KEY_LENGTH);
}

/**
 * Get the encryption secret from environment
 */
function getEncryptionSecret(): string {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error(
      "ENCRYPTION_SECRET must be set in environment variables. " +
      "Generate one with: openssl rand -hex 32"
    );
  }
  // SECURITY: Validate minimum key length (256-bit = 64 hex chars or 32 raw bytes)
  if (secret.length < 32) {
    throw new Error(
      "ENCRYPTION_SECRET is too short — must be at least 32 characters. " +
      "Generate one with: openssl rand -hex 32"
    );
  }
  return secret;
}

/**
 * Encrypt a string value
 * Returns base64 encoded string: salt:iv:authTag:encryptedData
 * @param aad - Optional Additional Authenticated Data (e.g., userId or field name)
 *              to bind ciphertext to a specific context, preventing cross-record swaps.
 */
export function encrypt(plaintext: string, aad?: string): string {
  const secret = getEncryptionSecret();
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(secret, salt);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  // SECURITY: AAD binds the ciphertext to a context (e.g., userId, field name).
  // This prevents encrypted values from being swapped between records undetected.
  if (aad) {
    cipher.setAAD(Buffer.from(aad, "utf8"));
  }
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  // Combine salt, iv, authTag, and encrypted data
  const combined = Buffer.concat([
    salt,
    iv,
    authTag,
    Buffer.from(encrypted, "hex"),
  ]);

  return combined.toString("base64");
}

/**
 * Decrypt an encrypted string
 * @param aad - Must match the AAD used during encryption, or decryption will fail.
 */
export function decrypt(encryptedData: string, aad?: string): string {
  const secret = getEncryptionSecret();
  const combined = Buffer.from(encryptedData, "base64");

  // Extract components
  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = combined.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
  );
  const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  const key = deriveKey(secret, salt);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  if (aad) {
    decipher.setAAD(Buffer.from(aad, "utf8"));
  }

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString("utf8");
}

/**
 * Heuristic check if a string might be encrypted data.
 * NOTE: This only checks if the data has the expected minimum length for
 * our encryption format (salt + iv + authTag + data). It does NOT validate
 * that the data was actually encrypted by this system. Use decrypt() which
 * will throw if the data is invalid or tampered with.
 */
export function looksEncrypted(data: string): boolean {
  try {
    const decoded = Buffer.from(data, "base64");
    // Minimum length: salt (32) + iv (16) + authTag (16) + some data
    return decoded.length > SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
}
