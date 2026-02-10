import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/collaborators/invites - Get all pending collaboration invites for the current user
export async function GET(request: NextRequest) {
  try {
    const token = await getAuthToken(request);
    if (!token?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = token.id as string;

    // Get the user's primary wallet and all linked wallets (multi-wallet support)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        walletAddress: true,
        wallets: {
          select: { walletAddress: true },
        },
      },
    });

    // Collect all wallet addresses (primary + linked wallets)
    const allWallets: string[] = [];
    if (user?.walletAddress) {
      allWallets.push(user.walletAddress.toLowerCase());
    }
    if (user?.wallets) {
      user.wallets.forEach((w: { walletAddress: string }) => {
        const normalized = w.walletAddress.toLowerCase();
        if (!allWallets.includes(normalized)) {
          allWallets.push(normalized);
        }
      });
    }

    // Build OR conditions for wallet matching (case-insensitive)
    const walletConditions = allWallets.map(wallet => ({
      walletAddress: { equals: wallet, mode: "insensitive" as const },
    }));

    // Find all pending invites for this user (by userId or any of their wallet addresses)
    const invites = await prisma.listingCollaborator.findMany({
      where: {
        status: "PENDING",
        OR: [
          { userId },
          ...walletConditions,
        ],
      },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            slug: true,
            tagline: true,
            thumbnailUrl: true,
            categories: true,
            status: true,
            startingPrice: true,
            buyNowPrice: true,
            currency: true,
            seller: {
              select: {
                id: true,
                username: true,
                displayName: true,
                name: true,
                image: true,
                isVerified: true,
                twitterUsername: true,
                twitterVerified: true,
              },
            },
          },
        },
      },
      orderBy: { invitedAt: "desc" },
    });

    return NextResponse.json({
      invites,
      count: invites.length,
    });
  } catch (error: any) {
    console.error("Error fetching collaboration invites:", error);
    return NextResponse.json(
      { error: "Failed to fetch collaboration invites" },
      { status: 500 }
    );
  }
}
