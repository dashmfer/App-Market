import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/listings/reserved
 * Get all listings reserved for the current user (for buyer dashboard)
 */
export async function GET(request: NextRequest) {
  try {
    const token = await getAuthToken(request);
    const currentUserId = token?.id as string | undefined;

    if (!currentUserId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get current user's wallet address
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { walletAddress: true },
    });
    const currentUserWallet = currentUser?.walletAddress || undefined;

    // Build the OR conditions for finding reserved listings
    const orConditions: any[] = [
      { reservedBuyerId: currentUserId },
    ];
    if (currentUserWallet) {
      orConditions.push({ reservedBuyerWallet: currentUserWallet });
    }

    // Find all listings reserved for the current user
    const reservedListings = await (prisma.listing.findMany as any)({
      where: {
        status: "RESERVED",
        OR: orConditions,
      },
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            displayName: true,
            username: true,
            image: true,
            isVerified: true,
          },
        },
        bids: {
          orderBy: { amount: "desc" },
          take: 1,
          select: { amount: true },
        },
        _count: {
          select: { bids: true },
        },
      },
      orderBy: { reservedAt: "desc" },
    });

    // Transform listings
    const listings = reservedListings.map((listing: any) => ({
      id: listing.id,
      slug: listing.slug,
      title: listing.title,
      tagline: listing.tagline,
      thumbnailUrl: listing.thumbnailUrl,
      categories: listing.categories,
      category: listing.categories?.[0], // Backwards compatibility
      techStack: listing.techStack,
      startingPrice: listing.startingPrice,
      buyNowPrice: listing.buyNowPrice,
      buyNowEnabled: listing.buyNowEnabled,
      currency: listing.currency,
      endTime: listing.endTime,
      currentBid: listing.bids[0]?.amount || listing.startingPrice,
      _count: listing._count,
      reservedAt: listing.reservedAt,
      seller: listing.seller,
      reservationInfo: {
        isReserved: true,
        isReservedForCurrentUser: true,
      },
    }));

    return NextResponse.json({ listings });
  } catch (error: any) {
    console.error("Error fetching reserved listings:", error);
    return NextResponse.json(
      { error: "Failed to fetch reserved listings" },
      { status: 500 }
    );
  }
}
