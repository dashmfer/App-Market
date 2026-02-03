import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { decrypt } from "@/lib/encryption";

// Force dynamic rendering for this route
export const dynamic = "force-dynamic";

const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID;
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET;
const TWITTER_REDIRECT_URI = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/auth/twitter/callback`;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

interface TwitterUser {
  id: string;
  username: string;
  name: string;
  verified?: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Handle OAuth errors
    if (error) {
      console.error("Twitter OAuth error:", error);
      return NextResponse.redirect(
        `${SITE_URL}/dashboard/settings?twitter_error=${encodeURIComponent(error)}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${SITE_URL}/dashboard/settings?twitter_error=missing_params`
      );
    }

    // Get stored OAuth data from cookie
    const oauthCookie = request.cookies.get("twitter_oauth_data");
    if (!oauthCookie) {
      return NextResponse.redirect(
        `${SITE_URL}/dashboard/settings?twitter_error=session_expired`
      );
    }

    let oauthData: { codeVerifier: string; state: string; userId: string };
    try {
      // SECURITY: Decrypt OAuth data with AES-256-GCM
      const decryptedData = decrypt(oauthCookie.value);
      oauthData = JSON.parse(decryptedData);
    } catch {
      return NextResponse.redirect(
        `${SITE_URL}/dashboard/settings?twitter_error=invalid_session`
      );
    }

    // Verify state matches
    if (state !== oauthData.state) {
      return NextResponse.redirect(
        `${SITE_URL}/dashboard/settings?twitter_error=state_mismatch`
      );
    }

    if (!TWITTER_CLIENT_ID || !TWITTER_CLIENT_SECRET) {
      return NextResponse.redirect(
        `${SITE_URL}/dashboard/settings?twitter_error=not_configured`
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
        `${SITE_URL}/dashboard/settings?twitter_error=token_exchange_failed`
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
        `${SITE_URL}/dashboard/settings?twitter_error=user_fetch_failed`
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
        `${SITE_URL}/dashboard/settings?twitter_error=already_linked`
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
      `${SITE_URL}/dashboard/settings?twitter_connected=true&twitter_username=${encodeURIComponent(
        twitterUser.username
      )}`
    );
    response.cookies.delete("twitter_oauth_data");

    return response;
  } catch (error) {
    console.error("Twitter callback error:", error);
    return NextResponse.redirect(
      `${SITE_URL}/dashboard/settings?twitter_error=unknown`
    );
  }
}
