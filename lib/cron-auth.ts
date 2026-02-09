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
