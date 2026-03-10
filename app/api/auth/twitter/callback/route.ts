import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { getAuthToken } from "@/lib/auth";

// Force dynamic rendering for this route
export const dynamic = "force-dynamic";

const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID;
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET;
// SECURITY: HTTP fallback only in development; production requires NEXT_PUBLIC_SITE_URL (validated as HTTPS)
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000");
const TWITTER_REDIRECT_URI = `${SITE_URL}/api/auth/twitter/callback`;

/**
 * SECURITY: Validate redirect URLs to prevent open-redirect attacks.
 * Only allows same-origin redirects; falls back to /dashboard for invalid URLs.
 */
function getSafeRedirectUrl(url: string | null, requestUrl: string): string {
  const fallback = new URL("/dashboard", requestUrl).toString();
  if (!url) return fallback;

  try {
    const parsed = new URL(url, requestUrl);
    const origin = new URL(requestUrl).origin;
    // Only allow same-origin redirects
    if (parsed.origin !== origin) return fallback;
    return parsed.toString();
  } catch {
    return fallback;
  }
}

interface TwitterUser {
  id: string;
  username: string;
  name: string;
  verified?: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Handle OAuth errors
    if (error) {
      console.error("Twitter OAuth error:", String(error).replace(/[\r\n]/g, ""));
      return NextResponse.redirect(
        getSafeRedirectUrl(`/dashboard/settings?twitter_error=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        getSafeRedirectUrl("/dashboard/settings?twitter_error=missing_params", request.url)
      );
    }

    // Get stored OAuth data from cookie
    const oauthCookie = request.cookies.get("twitter_oauth_data");
    if (!oauthCookie) {
      return NextResponse.redirect(
        getSafeRedirectUrl("/dashboard/settings?twitter_error=session_expired", request.url)
      );
    }

    // Get current user session for AAD-bound decryption
    const authToken = await getAuthToken(request);

    let oauthData: { codeVerifier: string; state: string; userId: string };
    try {
      // SECURITY: Decrypt OAuth data with AAD binding to the authenticated user.
      // Falls back to no-AAD for legacy cookies encrypted before AAD was added.
      const aad = authToken?.id ? `twitter-oauth:${authToken.id}` : undefined;
      let decryptedData: string;
      try {
        decryptedData = decrypt(oauthCookie.value, aad);
      } catch {
        decryptedData = decrypt(oauthCookie.value);
      }
      oauthData = JSON.parse(decryptedData);
    } catch {
      return NextResponse.redirect(
        getSafeRedirectUrl("/dashboard/settings?twitter_error=invalid_session", request.url)
      );
    }

    // SECURITY: Verify state matches using constant-time comparison to prevent timing attacks
    const { timingSafeEqual: tsEqual } = await import("crypto");
    const stateMatches = (() => {
      try {
        const maxLen = Math.max(state!.length, oauthData.state.length);
        const paddedA = Buffer.alloc(maxLen);
        const paddedB = Buffer.alloc(maxLen);
        Buffer.from(state!).copy(paddedA);
        Buffer.from(oauthData.state).copy(paddedB);
        return tsEqual(paddedA, paddedB) && state!.length === oauthData.state.length;
      } catch { return false; }
    })();
    if (!stateMatches) {
      return NextResponse.redirect(
        getSafeRedirectUrl("/dashboard/settings?twitter_error=state_mismatch", request.url)
      );
    }

    if (!TWITTER_CLIENT_ID || !TWITTER_CLIENT_SECRET) {
      return NextResponse.redirect(
        getSafeRedirectUrl("/dashboard/settings?twitter_error=not_configured", request.url)
      );
    }

    // Exchange code for access token
    const tokenResponse = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        client_id: TWITTER_CLIENT_ID,
        redirect_uri: TWITTER_REDIRECT_URI,
        code_verifier: oauthData.codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Twitter token exchange failed:", errorText);
      return NextResponse.redirect(
        getSafeRedirectUrl("/dashboard/settings?twitter_error=token_exchange_failed", request.url)
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get Twitter user info
    const userResponse = await fetch("https://api.twitter.com/2/users/me?user.fields=verified", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      console.error("Failed to fetch Twitter user:", await userResponse.text());
      return NextResponse.redirect(
        getSafeRedirectUrl("/dashboard/settings?twitter_error=user_fetch_failed", request.url)
      );
    }

    const userData = await userResponse.json();
    const twitterUser: TwitterUser = userData.data;

    // Check if Twitter account is already linked to another user
    const existingLink = await prisma.user.findUnique({
      where: { twitterId: twitterUser.id },
      select: { id: true },
    });

    if (existingLink && existingLink.id !== oauthData.userId) {
      return NextResponse.redirect(
        getSafeRedirectUrl("/dashboard/settings?twitter_error=already_linked", request.url)
      );
    }

    // Update user with Twitter info
    await prisma.user.update({
      where: { id: oauthData.userId },
      data: {
        twitterId: twitterUser.id,
        twitterUsername: twitterUser.username,
        twitterVerified: true, // Account is verified by OAuth
        twitterLinkedAt: new Date(),
      },
    });

    // Clear OAuth cookie and redirect to success
    const response = NextResponse.redirect(
      getSafeRedirectUrl(
        `/dashboard/settings?twitter_connected=true&twitter_username=${encodeURIComponent(
          twitterUser.username
        )}`,
        request.url
      )
    );
    response.cookies.delete("twitter_oauth_data");

    return response;
  } catch (error) {
    console.error("Twitter callback error:", error);
    return NextResponse.redirect(
      getSafeRedirectUrl("/dashboard/settings?twitter_error=unknown", request.url)
    );
  }
}
