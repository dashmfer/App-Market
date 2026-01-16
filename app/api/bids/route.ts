import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthToken } from "@/lib/auth";
import { calculatePlatformFee } from "@/lib/solana";

// GET /api/bids?listingId=xxx - Get bids for a listing
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get("listingId");

    if (!listingId) {
      return NextResponse.json(
        { error: "Listing ID required" },
        { status: 400 }
      );
    }

    const bids = await prisma.bid.findMany({
      where: { listingId },
      orderBy: { amount: "desc" },
      include: {
        bidder: {
          select: {
            id: true,
            name: true,
            username: true,
            walletAddress: true,
            isVerified: true,
          },
        },
      },
    });

    const transformedBids = bids.map((bid) => ({
      id: bid.id,
      amount: bid.amount,
      currency: bid.currency,
      bidder: bid.bidder.username || bid.bidder.walletAddress?.slice(0, 8) || "Anonymous",
      isWinning: bid.isWinning,
      createdAt: bid.createdAt,
    }));

    return NextResponse.json({ bids: transformedBids });
  } catch (error) {
    console.error("Error fetching bids:", error);
    return NextResponse.json(
      { error: "Failed to fetch bids" },
      { status: 500 }
    );
  }
}

// POST /api/bids - Place a bid
export async function POST(request: NextRequest) {
  try {
    // Use getAuthToken for JWT-based authentication (works better with credentials provider)
    const token = await getAuthToken(request);

    if (!token?.id) {
      return NextResponse.json(
        { error: "Unauthorized - please sign in with your wallet" },
        { status: 401 }
      );
    }

    const userId = token.id as string;

    const body = await request.json();
    const { listingId, amount, maxBid, currency, onChainTx } = body;

    // Validate
    if (!listingId || !amount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get listing
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        bids: {
          orderBy: { amount: "desc" },
          take: 1,
        },
      },
    });

    if (!listing) {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 }
      );
    }

    // Check auction status
    if (listing.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Listing is not active" },
        { status: 400 }
      );
    }

    // Check if auction ended
    if (new Date() > listing.endTime) {
      return NextResponse.json(
        { error: "Auction has ended" },
        { status: 400 }
      );
    }

    // Check seller not bidding
    if (listing.sellerId === userId) {
      return NextResponse.json(
        { error: "Seller cannot bid on their own listing" },
        { status: 400 }
      );
    }

    // Check minimum bid
    const currentHighBid = listing.bids[0]?.amount || listing.startingPrice;
    if (amount <= currentHighBid) {
      return NextResponse.json(
        { error: `Bid must be higher than ${currentHighBid} ${listing.currency}` },
        { status: 400 }
      );
    }

    // Mark previous winning bid as outbid
    if (listing.bids[0]) {
      await prisma.bid.update({
        where: { id: listing.bids[0].id },
        data: { isWinning: false, isOutbid: true },
      });

      // Notify previous high bidder
      const previousBidder = await prisma.bid.findUnique({
        where: { id: listing.bids[0].id },
        select: { bidderId: true },
      });

      if (previousBidder) {
        await prisma.notification.create({
          data: {
            type: "BID_OUTBID",
            title: "You've been outbid!",
            message: `Someone placed a higher bid on "${listing.title}"`,
            data: { listingId, listingSlug: listing.slug },
            userId: previousBidder.bidderId,
          },
        });
      }
    }

    // Create new bid
    const bid = await prisma.bid.create({
      data: {
        amount,
        currency: currency || listing.currency,
        maxBid: maxBid || null,
        onChainTx,
        isWinning: true,
        listingId,
        bidderId: userId,
      },
      include: {
        bidder: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    // Notify seller
    await prisma.notification.create({
      data: {
        type: "BID_PLACED",
        title: "New bid received!",
        message: `New bid of ${amount} ${listing.currency} on "${listing.title}"`,
        data: { listingId, listingSlug: listing.slug, amount },
        userId: listing.sellerId,
      },
    });

    return NextResponse.json({ bid }, { status: 201 });
  } catch (error) {
    console.error("Error placing bid:", error);
    return NextResponse.json(
      { error: "Failed to place bid" },
      { status: 500 }
    );
  }
}
