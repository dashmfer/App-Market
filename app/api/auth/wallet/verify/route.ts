import { NextRequest, NextResponse } from "next/server";
import { verifyWalletSignature } from "@/lib/wallet-verification";
import { withRateLimitAsync, getClientIp } from "@/lib/rate-limit";

/**
 * Wallet signature verification endpoint
 * Used by the signin page for manual wallet authentication
 */
export async function POST(req: NextRequest) {
  try {
    // SECURITY: Rate limit verification attempts
    const identifier = getClientIp(req.headers);
    const rateLimit = await (withRateLimitAsync('auth', 'wallet-verify'))(req, identifier);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: rateLimit.error },
        { status: 429, headers: rateLimit.headers }
      );
    }

    const { publicKey, signature, message } = await req.json();

    // Use shared verification logic (includes message format + replay validation)
    const result = await verifyWalletSignature(publicKey, signature, message);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Verification failed" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: result.user,
    });
  } catch (error) {
    console.error("[Wallet Verify API] Error during verification:", error);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}
