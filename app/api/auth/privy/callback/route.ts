import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyPrivyToken, getPrivyUser } from "@/lib/privy";

// POST /api/auth/privy/callback
// Called after Privy authentication to sync user with our database
export async function POST(request: NextRequest) {
  try {
    const { accessToken } = await request.json();

    if (!accessToken) {
      return NextResponse.json(
        { error: "Missing access token" },
        { status: 400 }
      );
    }

    // Verify the Privy token
    const claims = await verifyPrivyToken(accessToken);
    if (!claims) {
      return NextResponse.json(
        { error: "Invalid access token" },
        { status: 401 }
      );
    }

    // Get full user data from Privy
    const privyUser = await getPrivyUser(claims.userId);
    if (!privyUser) {
      return NextResponse.json(
        { error: "Failed to get user data" },
        { status: 500 }
      );
    }

    // Extract relevant data
    const email = privyUser.email?.address;
    const twitterUsername = privyUser.twitter?.username;
    const twitterId = privyUser.twitter?.subject;

    // Get wallet address from embedded wallet
    const embeddedWallet = privyUser.linkedAccounts?.find(
      (account: any) => account.type === "wallet" && account.walletClientType === "privy"
    ) as { address?: string } | undefined;
    const walletAddress = embeddedWallet?.address;

    // Determine wallet type based on how they signed up
    let walletType: "PRIVY_EMAIL" | "PRIVY_TWITTER" | "EXTERNAL" = "EXTERNAL";
    if (email) {
      walletType = "PRIVY_EMAIL";
    } else if (twitterUsername) {
      walletType = "PRIVY_TWITTER";
    }

    // Find or create user
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          email ? { email } : {},
          twitterId ? { twitterId } : {},
          walletAddress ? { walletAddress } : {},
        ].filter(obj => Object.keys(obj).length > 0),
      },
    });

    if (!user) {
      // Create new user
      const baseUsername = email
        ? email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "")
        : twitterUsername
          ? twitterUsername.toLowerCase()
          : walletAddress?.slice(0, 8).toLowerCase();

      // Generate unique username
      let username = baseUsername || `user_${Date.now().toString(36)}`;
      const existingUsername = await prisma.user.findUnique({
        where: { username },
      });
      if (existingUsername) {
        username = `${username}_${Date.now().toString(36).slice(-4)}`;
      }

      user = await prisma.user.create({
        data: {
          email: email || null,
          username,
          walletAddress: walletAddress || null,
          twitterId: twitterId || null,
          twitterUsername: twitterUsername || null,
          twitterVerified: !!twitterUsername,
          isVerified: true,
          verifiedAt: new Date(),
        },
      });

      // Create wallet entry if we have a wallet address
      if (walletAddress) {
        await prisma.userWallet.create({
          data: {
            userId: user.id,
            walletAddress,
            isPrimary: true,
            walletType,
          },
        });
      }
    } else {
      // Update existing user with any new info
      const updates: any = {};

      if (email && !user.email) {
        updates.email = email;
      }
      if (twitterId && !user.twitterId) {
        updates.twitterId = twitterId;
        updates.twitterUsername = twitterUsername;
        updates.twitterVerified = true;
      }
      if (walletAddress && !user.walletAddress) {
        updates.walletAddress = walletAddress;
      }

      if (Object.keys(updates).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updates,
        });
      }

      // Add wallet if it doesn't exist
      if (walletAddress) {
        const existingWallet = await prisma.userWallet.findUnique({
          where: { walletAddress },
        });

        if (!existingWallet) {
          await prisma.userWallet.create({
            data: {
              userId: user.id,
              walletAddress,
              isPrimary: !user.walletAddress, // Primary if user didn't have a wallet before
              walletType,
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        walletAddress: user.walletAddress,
      },
    });
  } catch (error) {
    console.error("Privy callback error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
