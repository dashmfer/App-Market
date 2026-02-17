import { NextRequest, NextResponse } from "next/server";
import { getAuthToken, revokeSession, revokeAllUserSessions } from "@/lib/auth";
import { validateCsrfRequest, csrfError } from "@/lib/csrf";
import { withRateLimitAsync } from "@/lib/rate-limit";

/**
 * POST /api/auth/logout
 *
 * Server-side session revocation. Call this BEFORE NextAuth's client-side
 * signOut() to ensure the JWT is immediately invalidated across all
 * serverless instances (not just the local cookie).
 *
 * Query params:
 *   ?all=true  — revoke ALL sessions for this user (e.g. "sign out everywhere")
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Validate CSRF token
    const csrfValidation = validateCsrfRequest(request);
    if (!csrfValidation.valid) {
      return csrfError(csrfValidation.error || "CSRF validation failed");
    }

    // SECURITY: Rate limit logout attempts
    const rateLimitResult = await (withRateLimitAsync("auth", "logout"))(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: 429, headers: rateLimitResult.headers }
      );
    }

    const token = await getAuthToken(request);
    if (!token?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userId = token.id as string;
    const sessionId = token.sessionId as string | undefined;
    const revokeAll = new URL(request.url).searchParams.get("all") === "true";

    if (revokeAll) {
      const count = await revokeAllUserSessions(userId, "user_logout_all");
      return NextResponse.json({ success: true, revokedSessions: count });
    }

    if (sessionId) {
      await revokeSession(sessionId, "user_logout");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Logout] Error revoking session:", error);
    return NextResponse.json(
      { error: "Failed to revoke session" },
      { status: 500 }
    );
  }
}
