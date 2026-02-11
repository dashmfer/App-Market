import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // SECURITY: Email/password registration is disabled.
  // Authentication is wallet-based (Solana wallet signature).
  return NextResponse.json(
    { error: "Registration is not available. Please sign in with your wallet." },
    { status: 403 }
  );
}
