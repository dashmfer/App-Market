import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyPrivyToken, getPrivyUser } from "@/lib/privy";
import { createNotification } from "@/lib/notifications";

/**
 * Link pending invites to a user when they connect a wallet
 * This handles both collaborator invites and purchase partner invites
 */
async function linkPendingInvitesToUser(userId: string, walletAddress: string) {
  const normalizedWallet = walletAddress.toLowerCase();

  // Find and link pending collaborator invites
  const pendingCollaboratorInvites = await prisma.listingCollaborator.findMany({
    where: {
      walletAddress: { equals: normalizedWallet, mode: "insensitive" },
      status: "PENDING",
      userId: null, // Not yet linked to a user
    },
    include: {
      listing: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
    },
  });

  // Link collaborator invites and send notifications
  for (const invite of pendingCollaboratorInvites) {
    await prisma.listingCollaborator.update({
      where: { id: invite.id },
      data: { userId },
    });

    // Send notification about the pending invite
    await createNotification({
      userId,
      type: "COLLABORATION_INVITE",
      title: "Collaboration Invite",
      message: `You have a pending invite as a ${invite.role.toLowerCase()} on "${invite.listing.title}" with ${invite.percentage}% revenue share`,
      data: {
        listingId: invite.listing.id,
        listingSlug: invite.listing.slug,
        listingTitle: invite.listing.title,
        collaboratorId: invite.id,
        role: invite.role,
        percentage: invite.percentage,
      },
    });
  }

  // Find and link pending purchase partner invites
  const pendingPartnerInvites = await prisma.transactionPartner.findMany({
    where: {
      walletAddress: { equals: normalizedWallet, mode: "insensitive" },
      depositStatus: "PENDING",
      userId: null, // Not yet linked to a user
    },
    include: {
      transaction: {
        select: {
          id: true,
          listing: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
        },
      },
    },
  });

  // Link partner invites and send notifications
  for (const invite of pendingPartnerInvites) {
    await prisma.transactionPartner.update({
      where: { id: invite.id },
      data: { userId },
    });

    // Send notification about the pending partner invite
    await createNotification({
      userId,
      type: "PURCHASE_PARTNER_INVITE",
      title: "Purchase Partner Invite",
      message: `You have a pending invite to co-purchase "${invite.transaction.listing.title}" with ${invite.percentage}% share (${invite.depositAmount} SOL)`,
      data: {
        listingId: invite.transaction.listing.id,
        listingSlug: invite.transaction.listing.slug,
        listingTitle: invite.transaction.listing.title,
        partnerId: invite.id,
        transactionId: invite.transactionId,
        percentage: invite.percentage,
        depositAmount: invite.depositAmount,
      },
    });
  }

  return {
    collaboratorInvitesLinked: pendingCollaboratorInvites.length,
    partnerInvitesLinked: pendingPartnerInvites.length,
  };
}

// POST /api/auth/privy/callback
// Called after Privy authentication to sync user with our database
export async function POST(request: NextRequest) {
  try {
    const { accessToken, createdWalletAddress } = await request.json();

    if (!accessToken) {
      return NextResponse.json(
        { error: "Missing access token" },
        { status: 400 }
      );
    }

    // Log if we received a directly created wallet address
    if (createdWalletAddress) {
      console.log("[Privy Callback] Received directly created wallet address:", createdWalletAddress);
    }

    // Check if Privy is configured
    if (!process.env.PRIVY_APP_SECRET) {
      console.error("[Privy Callback] PRIVY_APP_SECRET not configured");
      return NextResponse.json(
        { error: "Privy server not configured. Please contact support." },
        { status: 500 }
      );
    }

    // Verify the Privy token
    console.log("[Privy Callback] Verifying token...");
    const claims = await verifyPrivyToken(accessToken);
    if (!claims) {
      console.error("[Privy Callback] Token verification failed");
      return NextResponse.json(
        { error: "Invalid or expired access token. Please try signing in again." },
        { status: 401 }
      );
    }
    console.log("[Privy Callback] Token verified, userId:", claims.userId);

    // Get full user data from Privy
    console.log("[Privy Callback] Fetching user data...");
    const privyUser = await getPrivyUser(claims.userId);
    if (!privyUser) {
      console.error("[Privy Callback] Failed to fetch user from Privy");
      return NextResponse.json(
        { error: "Failed to get user data from Privy. Please try again." },
        { status: 500 }
      );
    }
    console.log("[Privy Callback] User data fetched, email:", privyUser.email?.address);

    // Extract relevant data
    const email = privyUser.email?.address;
    const twitterUsername = privyUser.twitter?.username;
    const twitterId = privyUser.twitter?.subject;

    // Log linked accounts for debugging
    console.log("[Privy Callback] Linked accounts:", JSON.stringify(privyUser.linkedAccounts, null, 2));

    // Get wallet address from Solana embedded wallet
    // Try to find Solana wallet first, then fall back to any Privy embedded wallet
    let embeddedWallet = privyUser.linkedAccounts?.find(
      (account: any) =>
        account.type === "wallet" &&
        account.walletClientType === "privy" &&
        (account.chainType === "solana" || account.chainId === "solana")
    ) as { address?: string } | undefined;

    // Fallback: if no Solana wallet found, try to get any Privy wallet that's NOT Ethereum
    if (!embeddedWallet?.address) {
      embeddedWallet = privyUser.linkedAccounts?.find(
        (account: any) =>
          account.type === "wallet" &&
          account.walletClientType === "privy" &&
          account.chainType !== "ethereum" &&
          !account.address?.startsWith("0x") // Exclude ETH addresses
      ) as { address?: string } | undefined;
    }

    // Last fallback: get any Privy wallet
    if (!embeddedWallet?.address) {
      embeddedWallet = privyUser.linkedAccounts?.find(
        (account: any) =>
          account.type === "wallet" &&
          account.walletClientType === "privy"
      ) as { address?: string } | undefined;

      // Log warning if we had to use fallback
      if (embeddedWallet?.address) {
        console.log("[Privy Callback] Using fallback wallet:", embeddedWallet);
      }
    }

    // Prefer the directly passed wallet address (from just-created wallet)
    // Fall back to finding it in linkedAccounts
    const walletAddress = createdWalletAddress || embeddedWallet?.address;
    console.log("[Privy Callback] Final wallet address:", walletAddress);
    console.log("[Privy Callback] Source:", createdWalletAddress ? "directly passed" : "from linkedAccounts");

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

      // ALWAYS update to Solana wallet if we have one and user has ETH wallet
      // This handles the case where user had ETH wallet but we created Solana one
      const isSolanaWallet = walletAddress && !walletAddress.startsWith("0x");
      const userHasEthWallet = user.walletAddress?.startsWith("0x");

      if (isSolanaWallet && userHasEthWallet) {
        // Replace ETH wallet with Solana wallet
        console.log("[Privy Callback] Replacing ETH wallet with Solana wallet:", walletAddress);
        updates.walletAddress = walletAddress;
      } else if (walletAddress && !user.walletAddress) {
        // User has no wallet, use whatever we found
        updates.walletAddress = walletAddress;
      }

      if (Object.keys(updates).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updates,
        });
      }

      // Add wallet if it doesn't exist (use upsert to avoid unique constraint errors)
      if (walletAddress) {
        await prisma.userWallet.upsert({
          where: { walletAddress },
          update: {
            // Update userId if wallet exists but belongs to this user
            userId: user.id,
          },
          create: {
            userId: user.id,
            walletAddress,
            isPrimary: isSolanaWallet || !user.walletAddress,
            walletType,
          },
        });
      }
    }

    // Check for and link any pending invites to this wallet
    // This handles the case where someone was invited before creating an account
    let invitesLinked = { collaboratorInvitesLinked: 0, partnerInvitesLinked: 0 };
    if (walletAddress) {
      invitesLinked = await linkPendingInvitesToUser(user.id, walletAddress);
    }

    // Return the Solana wallet if we have one, otherwise the user's wallet
    const finalWalletAddress = (walletAddress && !walletAddress.startsWith("0x"))
      ? walletAddress
      : user.walletAddress;

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        walletAddress: finalWalletAddress,
      },
      invitesLinked,
    });
  } catch (error: any) {
    console.error("Privy callback error:", error);
    console.error("Error stack:", error?.stack);
    console.error("Error message:", error?.message);

    // Return more specific error message for debugging
    const errorMessage = error?.message || "Authentication failed";
    return NextResponse.json(
      { error: errorMessage, details: error?.stack?.split('\n')[0] },
      { status: 500 }
    );
  }
}
