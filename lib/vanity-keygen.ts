/**
 * Vanity Address Generator for PATO Token Mints
 *
 * Generates Solana keypairs whose public key (base58) ends with a specific suffix.
 * Used to brand all PATO tokens with addresses ending in 'app'.
 *
 * Performance:
 * - 3 characters ("app"): ~seconds per keypair
 * - 4 characters: ~minutes
 * - 5+ characters: use GPU grinder instead
 */

import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

/**
 * Generate a Solana keypair whose base58 public key ends with the given suffix.
 *
 * @param suffix - The desired suffix (case-sensitive, base58 chars only)
 * @param maxAttempts - Maximum grinding attempts before giving up
 * @returns A Keypair with the matching vanity address
 * @throws Error if suffix not found within maxAttempts
 */
export function grindVanityKeypair(
  suffix: string,
  maxAttempts: number = 10_000_000
): Keypair {
  // Validate suffix is valid base58
  const base58Chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  for (const char of suffix) {
    if (!base58Chars.includes(char)) {
      throw new Error(
        `Invalid base58 character in suffix: '${char}'. Valid: ${base58Chars}`
      );
    }
  }

  for (let i = 0; i < maxAttempts; i++) {
    const keypair = Keypair.generate();
    const address = keypair.publicKey.toBase58();

    if (address.endsWith(suffix)) {
      return keypair;
    }
  }

  throw new Error(
    `Could not find vanity address ending in '${suffix}' after ${maxAttempts} attempts`
  );
}

/**
 * Generate multiple vanity keypairs (for pre-grinding a pool).
 *
 * @param suffix - The desired suffix
 * @param count - How many keypairs to generate
 * @param maxAttemptsPerKey - Max attempts per keypair
 * @returns Array of matching Keypairs
 */
export function grindVanityKeypairBatch(
  suffix: string,
  count: number,
  maxAttemptsPerKey: number = 10_000_000
): Keypair[] {
  const keypairs: Keypair[] = [];
  for (let i = 0; i < count; i++) {
    keypairs.push(grindVanityKeypair(suffix, maxAttemptsPerKey));
  }
  return keypairs;
}

/**
 * Serialize a Keypair to a base58 string (for encrypted storage in DB).
 */
export function serializeKeypair(keypair: Keypair): string {
  return bs58.encode(keypair.secretKey);
}

/**
 * Deserialize a Keypair from a base58 string.
 */
export function deserializeKeypair(serialized: string): Keypair {
  return Keypair.fromSecretKey(bs58.decode(serialized));
}

/**
 * Verify that a keypair's public key ends with the expected suffix.
 */
export function verifyVanitySuffix(
  keypair: Keypair,
  suffix: string
): boolean {
  return keypair.publicKey.toBase58().endsWith(suffix);
}
