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

    // Get wallet address from Solana embedded wallet (not Ethereum)
    const embeddedWallet = privyUser.linkedAccounts?.find(
      (account: any) =>
        account.type === "wallet" &&
        account.walletClientType === "privy" &&
        account.chainType === "solana"
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

    // Check for and link any pending invites to this wallet
    // This handles the case where someone was invited before creating an account
    let invitesLinked = { collaboratorInvitesLinked: 0, partnerInvitesLinked: 0 };
    if (walletAddress) {
      invitesLinked = await linkPendingInvitesToUser(user.id, walletAddress);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        walletAddress: user.walletAddress,
      },
      invitesLinked,
    });
  } catch (error) {
    console.error("Privy callback error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
