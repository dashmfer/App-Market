import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";

/**
 * Verify cron secret using constant-time comparison to prevent timing attacks.
 * Defense-in-depth — middleware also validates, but route handlers should too.
 */
export function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[Cron] CRON_SECRET not configured");
    return false;
  }

  if (!authHeader) {
    return false;
  }

  const expected = `Bearer ${cronSecret}`;

  if (authHeader.length !== expected.length) {
    return false;
  }

  try {
    return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * SECURITY [M10]: Distributed lock for cron jobs via Redis.
 * Prevents duplicate execution when multiple serverless instances
 * receive the same cron trigger simultaneously.
 *
 * Uses Redis SET NX EX (atomic set-if-not-exists with TTL).
 * Returns an unlock function if the lock was acquired, or null if already held.
 */
export async function acquireCronLock(
  jobName: string,
  ttlSeconds: number = 300 // 5 minute default
): Promise<(() => Promise<void>) | null> {
  const { redis } = await import("@/lib/rate-limit");
  if (!redis) {
    // No Redis — allow execution (single instance assumed in dev)
    return async () => {};
  }

  const lockKey = `cron:lock:${jobName}`;
  const lockValue = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Atomic SET NX EX — only succeeds if key doesn't exist
  const result = await redis.set(lockKey, lockValue, { nx: true, ex: ttlSeconds });

  if (result !== "OK") {
    return null; // Lock already held by another instance
  }

  // Return unlock function (only deletes if we still own the lock)
  return async () => {
    try {
      // SECURITY [L1]: Atomic check-and-delete: only deletes if we still own the lock
      await redis.eval(
        `if redis.call("get",KEYS[1]) == ARGV[1] then return redis.call("del",KEYS[1]) else return 0 end`,
        [lockKey],
        [lockValue]
      );
    } catch {
      // Best-effort unlock — lock will expire via TTL anyway
    }
  };
}
