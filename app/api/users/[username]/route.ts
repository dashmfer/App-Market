import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthToken } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    // Get current user info for checking reserved listings
    const token = await getAuthToken(request);
    const currentUserId = token?.id as string | undefined;
    let currentUserWallet: string | undefined;
    if (currentUserId) {
      const currentUser = await prisma.user.findUnique({
        where: { id: currentUserId },
        select: { walletAddress: true },
      });
      currentUserWallet = currentUser?.walletAddress || undefined;
    }

    // Try to find by username first, then by ID
    let user = await (prisma.user.findUnique as any)({
      where: { username },
      select: {
        id: true,
        name: true,
        displayName: true,
        username: true,
        image: true,
        bio: true,
        isVerified: true,
        totalSales: true,
        totalPurchases: true,
        rating: true,
        ratingCount: true,
        sellerLevel: true,
        successRate: true,
        totalDisputes: true,
        disputesWon: true,
        disputesLost: true,
        twitterUsername: true,
        twitterVerified: true,
        createdAt: true,
        listings: {
          where: {
            status: "ACTIVE",
          },
          select: {
            id: true,
            slug: true,
            title: true,
            tagline: true,
            thumbnailUrl: true,
            categories: true,
            techStack: true,
            startingPrice: true,
            buyNowPrice: true,
            buyNowEnabled: true,
            currency: true,
            endTime: true,
            reservedBuyerWallet: true,
            reservedBuyerId: true,
            bids: {
              orderBy: { amount: "desc" },
              take: 1,
              select: { amount: true },
            },
            _count: {
              select: { bids: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    // If not found by username, try finding by ID
    if (!user) {
      user = await (prisma.user.findUnique as any)({
        where: { id: username },
        select: {
          id: true,
          name: true,
          displayName: true,
          username: true,
          image: true,
          bio: true,
          isVerified: true,
          totalSales: true,
          totalPurchases: true,
          rating: true,
          ratingCount: true,
          sellerLevel: true,
          successRate: true,
          totalDisputes: true,
          disputesWon: true,
          disputesLost: true,
          twitterUsername: true,
          twitterVerified: true,
          createdAt: true,
          listings: {
            where: {
              status: "ACTIVE",
            },
            select: {
              id: true,
              slug: true,
              title: true,
              tagline: true,
              thumbnailUrl: true,
              categories: true,
              techStack: true,
              startingPrice: true,
              buyNowPrice: true,
              buyNowEnabled: true,
              currency: true,
              endTime: true,
              reservedBuyerWallet: true,
              reservedBuyerId: true,
              bids: {
                orderBy: { amount: "desc" },
                take: 1,
                select: { amount: true },
              },
              _count: {
                select: { bids: true },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Also get RESERVED listings from this seller that are reserved for the current viewer
    let reservedForViewer: any[] = [];
    if (currentUserId || currentUserWallet) {
      const reservedListings = await (prisma.listing.findMany as any)({
        where: {
          sellerId: user.id,
          status: "RESERVED",
          OR: [
            ...(currentUserId ? [{ reservedBuyerId: currentUserId }] : []),
            ...(currentUserWallet ? [{ reservedBuyerWallet: currentUserWallet }] : []),
          ],
        },
        select: {
          id: true,
          slug: true,
          title: true,
          tagline: true,
          thumbnailUrl: true,
          categories: true,
          techStack: true,
          startingPrice: true,
          buyNowPrice: true,
          buyNowEnabled: true,
          currency: true,
          endTime: true,
          reservedBuyerWallet: true,
          reservedBuyerId: true,
          bids: {
            orderBy: { amount: "desc" },
            take: 1,
            select: { amount: true },
          },
          _count: {
            select: { bids: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      reservedForViewer = reservedListings.map((listing: any) => ({
        ...listing,
        currentBid: listing.bids[0]?.amount || listing.startingPrice,
        bids: undefined,
        reservedBuyerWallet: undefined,
        reservedBuyerId: undefined,
        reservationInfo: {
          isReserved: true,
          isReservedForCurrentUser: true,
        },
      }));
    }

    // Transform listings to include currentBid and reservation info
    const transformedUser = {
      ...user,
      listings: user.listings.map((listing: any) => {
        const isReserved = !!(listing.reservedBuyerWallet || listing.reservedBuyerId);
        const isReservedForCurrentUser = isReserved && (
          (currentUserId && listing.reservedBuyerId === currentUserId) ||
          (currentUserWallet && listing.reservedBuyerWallet === currentUserWallet)
        );

        return {
          ...listing,
          currentBid: listing.bids[0]?.amount || listing.startingPrice,
          bids: undefined,
          reservedBuyerWallet: undefined,
          reservedBuyerId: undefined,
          reservationInfo: isReserved ? {
            isReserved: true,
            isReservedForCurrentUser,
          } : undefined,
        };
      }),
      reservedForViewer, // Listings with status RESERVED that are reserved for the viewer
    };

    return NextResponse.json({ user: transformedUser });
  } catch (error: any) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}
