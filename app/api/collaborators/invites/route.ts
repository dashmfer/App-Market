import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthToken } from "@/lib/auth";

// GET /api/collaborators/invites - Get all pending collaboration invites for the current user
export async function GET(request: NextRequest) {
  try {
    const token = await getAuthToken(request);
    if (!token?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = token.id as string;

    // Get the user's wallet address
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { walletAddress: true },
    });

    if (!user?.walletAddress) {
      return NextResponse.json({ invites: [], count: 0 });
    }

    // Find all pending invites for this user (by userId or wallet address)
    const invites = await prisma.listingCollaborator.findMany({
      where: {
        status: "PENDING",
        OR: [
          { userId },
          { walletAddress: user.walletAddress },
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
            category: true,
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
  } catch (error) {
    console.error("Error fetching collaboration invites:", error);
    return NextResponse.json(
      { error: "Failed to fetch collaboration invites" },
      { status: 500 }
    );
  }
}
