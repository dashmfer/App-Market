import { NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import { encrypt } from "@/lib/encryption";
import crypto from "crypto";

// Force dynamic rendering for this route
export const dynamic = "force-dynamic";

// Twitter OAuth 2.0 with PKCE
const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID;
const TWITTER_REDIRECT_URI = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/auth/twitter/callback`;

// Generate code verifier and challenge for PKCE
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated
    const token = await getAuthToken(request);
    if (!token?.id) {
      return NextResponse.json(
        { error: "You must be logged in to connect Twitter" },
        { status: 401 }
      );
    }

    if (!TWITTER_CLIENT_ID) {
      return NextResponse.json(
        { error: "Twitter OAuth is not configured" },
        { status: 500 }
      );
    }

    // Generate PKCE values
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = crypto.randomBytes(16).toString("hex");

    // Store verifier and state in a cookie (encrypted in production)
    const oauthData = JSON.stringify({
      codeVerifier,
      state,
      userId: token.id,
    });

    // Build Twitter OAuth URL
    const params = new URLSearchParams({
      response_type: "code",
      client_id: TWITTER_CLIENT_ID,
      redirect_uri: TWITTER_REDIRECT_URI,
      scope: "tweet.read users.read",
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    const authUrl = `https://twitter.com/i/oauth2/authorize?${params.toString()}`;

    // Create response with redirect
    const response = NextResponse.redirect(authUrl);

    // Set cookie with OAuth data (expires in 10 minutes)
    response.cookies.set("twitter_oauth_data", encrypt(oauthData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Twitter connect error:", error);
    return NextResponse.json(
      { error: "Failed to initiate Twitter connection" },
      { status: 500 }
    );
  }
}
