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

  // SECURITY: Pad both buffers to the same length to prevent length-leaking timing attacks.
  // A length pre-check before timingSafeEqual leaks secret length via timing.
  const maxLen = Math.max(authHeader.length, expected.length);
  const paddedAuth = Buffer.alloc(maxLen);
  const paddedExpected = Buffer.alloc(maxLen);
  Buffer.from(authHeader).copy(paddedAuth);
  Buffer.from(expected).copy(paddedExpected);

  try {
    const match = timingSafeEqual(paddedAuth, paddedExpected);
    return match && authHeader.length === expected.length;
  } catch {
    return false;
  }
}
