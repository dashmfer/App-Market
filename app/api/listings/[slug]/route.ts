import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthToken } from "@/lib/auth";
import { canEditListing, isValidUrl, MAX_CATEGORIES } from "@/lib/validation";
import { withRateLimitAsync } from "@/lib/rate-limit";

// GET /api/listings/[slug] - Get a single listing by slug
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;

    // Get current user's wallet and ID if authenticated
    const token = await getAuthToken(request);
    const currentUserId = token?.id as string | undefined;

    // Also get current user's wallet address
    let currentUserWallet: string | undefined;
    if (currentUserId) {
      const currentUser = await prisma.user.findUnique({
        where: { id: currentUserId },
        select: { walletAddress: true },
      });
      currentUserWallet = currentUser?.walletAddress || undefined;
    }

    const listing = await prisma.listing.findUnique({
      where: { slug },
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            username: true,
            walletAddress: true,
            image: true,
            isVerified: true,
            totalSales: true,
            createdAt: true,
          },
        },
        bids: {
          orderBy: { amount: "desc" },
          take: 10,
          include: {
            bidder: {
              select: {
                id: true,
                name: true,
                username: true,
                walletAddress: true,
              },
            },
          },
        },
        _count: {
          select: {
            bids: true,
            watchlist: true,
          },
        },
      },
    });

    if (!listing) {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 }
      );
    }

    // Get current highest bid
    const currentBid = listing.bids[0]?.amount || listing.startingPrice;

    // Build reservation info if listing is reserved
    let reservationInfo = null;
    const listingAny = listing as any;
    if (listingAny.reservedBuyerWallet || listingAny.reservedBuyerId) {
      // Check if current user is the reserved buyer (by ID or wallet)
      const isReservedForCurrentUser =
        (currentUserId && listingAny.reservedBuyerId === currentUserId) ||
        (currentUserWallet && listingAny.reservedBuyerWallet === currentUserWallet);

      // Get reserved buyer info if they're a registered user
      let reservedBuyerName: string | null = null;
      if (listingAny.reservedBuyerId) {
        const reservedBuyer = await prisma.user.findUnique({
          where: { id: listingAny.reservedBuyerId },
          select: { name: true, username: true },
        });
        // Show username if public (has a username set)
        if (reservedBuyer?.username) {
          reservedBuyerName = reservedBuyer.username;
        } else if (reservedBuyer?.name) {
          reservedBuyerName = reservedBuyer.name;
        }
      }

      reservationInfo = {
        isReserved: true,
        isReservedForCurrentUser,
        reservedBuyerName, // null if no public username, buyer can see "Reserved for you" instead
        reservedAt: listingAny.reservedAt,
      };
    }

    // Check if listing has been purchased and if current user is the buyer
    let purchaseInfo = null;
    const transaction = await prisma.transaction.findUnique({
      where: { listingId: listing.id },
      select: { id: true, buyerId: true, status: true },
    });
    if (transaction) {
      purchaseInfo = {
        isPurchased: true,
        isCurrentUserBuyer: currentUserId ? transaction.buyerId === currentUserId : false,
        transactionId: transaction.id,
        status: transaction.status,
      };
    }

    return NextResponse.json({
      listing: {
        ...listing,
        currentBid,
        bidCount: listing._count.bids,
        reservationInfo,
        purchaseInfo,
      },
    });
  } catch (error) {
    console.error("Error fetching listing:", error);
    return NextResponse.json(
      { error: "Failed to fetch listing" },
      { status: 500 }
    );
  }
}

// PUT /api/listings/[slug] - Update a listing
export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const rateLimitResult = await (withRateLimitAsync('write', 'listing-update'))(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error || 'Rate limit exceeded' },
        { status: 429, headers: rateLimitResult.headers }
      );
    }

    const token = await getAuthToken(request);

    if (!token?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = token.id as string;
    const { slug } = params;

    // Find the listing
    const listing = await prisma.listing.findUnique({
      where: { slug },
      include: {
        _count: {
          select: { bids: true },
        },
      },
    });

    if (!listing) {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 }
      );
    }

    // Check ownership
    if (listing.sellerId !== userId) {
      return NextResponse.json(
        { error: "You can only edit your own listings" },
        { status: 403 }
      );
    }

    // SECURITY: Prevent editing listings that are sold, ended, or cancelled
    if (!canEditListing(listing.status)) {
      return NextResponse.json(
        { error: `Cannot edit listing with status: ${listing.status}` },
        { status: 400 }
      );
    }

    // SECURITY: Prevent editing listings that have bids (price manipulation)
    if (listing._count.bids > 0) {
      return NextResponse.json(
        { error: "Cannot edit listing that already has bids" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { title, tagline, description, demoUrl, videoUrl, websiteUrl } = body;

    // SECURITY: Validate URLs have safe protocols
    const urlFields = { demoUrl, videoUrl, websiteUrl };
    for (const [field, url] of Object.entries(urlFields)) {
      if (url && !isValidUrl(url)) {
        return NextResponse.json(
          { error: `Invalid URL for ${field}: only http/https allowed` },
          { status: 400 }
        );
      }
    }

    // Update the listing
    const updatedListing = await prisma.listing.update({
      where: { slug },
      data: {
        ...(title && { title }),
        ...(tagline !== undefined && { tagline }),
        ...(description && { description }),
        ...(demoUrl !== undefined && { demoUrl }),
        ...(videoUrl !== undefined && { videoUrl }),
      },
    });

    return NextResponse.json({ listing: updatedListing });
  } catch (error) {
    console.error("Error updating listing:", error);
    return NextResponse.json(
      { error: "Failed to update listing" },
      { status: 500 }
    );
  }
}
