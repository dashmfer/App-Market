import { NextRequest, NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { withRateLimitAsync } from "@/lib/rate-limit";

const nextAuthHandler = NextAuth(authOptions);

// Wrap POST with rate limiting to prevent brute-force auth attacks
async function rateLimitedPost(req: NextRequest, ctx: any) {
  const rateLimitResult = await (withRateLimitAsync("auth", "nextauth-signin"))(req);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many authentication attempts. Please try again later." },
      { status: 429 }
    );
  }
  return nextAuthHandler(req, ctx);
}

export { nextAuthHandler as GET, rateLimitedPost as POST };
