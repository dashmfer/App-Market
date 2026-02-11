/**
 * SECURITY [M5]: Edge-compatible session revocation check.
 *
 * This module is safe to import from Next.js middleware (Edge Runtime).
 * It ONLY depends on @upstash/redis (HTTP-based, Edge-compatible) and
 * has NO Prisma or other Node.js-only dependencies.
 *
 * The full Prisma-backed checks live in lib/auth.ts and are used by
 * API route handlers as defense-in-depth.
 */

import { Redis } from "@upstash/redis";

const SESSION_REVOKE_PREFIX = "revoked:session:";
const USER_REVOKE_PREFIX = "revoked:user:";

// Create a dedicated Edge-safe Redis client (separate from rate-limit.ts
// to avoid pulling @upstash/ratelimit and in-memory fallback into the Edge bundle)
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

/**
 * Edge-compatible revocation check using Redis only.
 * Called from middleware (Edge Runtime) where Prisma is unavailable.
 * Returns true if the session is NOT revoked (i.e. still valid).
 */
export async function isSessionNotRevokedEdge(
  sessionId: string,
  userId?: string,
  iat?: number
): Promise<boolean> {
  if (!redis) return true; // If Redis is unavailable, let API-level checks handle it

  // Check individual session revocation
  const revoked = await redis.get(`${SESSION_REVOKE_PREFIX}${sessionId}`);
  if (revoked) return false;

  // Check user-wide timestamp revocation (M7)
  if (userId && iat) {
    const revokedAtStr = await redis.get(`${USER_REVOKE_PREFIX}${userId}`);
    if (revokedAtStr) {
      const revokedAtMs = parseInt(revokedAtStr as string, 10);
      if (iat <= Math.floor(revokedAtMs / 1000)) return false;
    }
  }

  return true;
}
