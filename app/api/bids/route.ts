import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthToken } from "@/lib/auth";
import { calculatePlatformFee } from "@/lib/solana";
import { PLATFORM_CONFIG } from "@/lib/config";
import { validateCsrfRequest, csrfError } from "@/lib/csrf";
import { withRateLimitAsync, getClientIp } from "@/lib/rate-limit";
import { audit, auditContext } from "@/lib/audit";

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

    const transformedBids = bids.map((bid: typeof bids[number]) => ({
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
    // SECURITY: Validate CSRF token for state-changing request
    const csrfValidation = validateCsrfRequest(request);
    if (!csrfValidation.valid) {
      return csrfError(csrfValidation.error || "CSRF validation failed");
    }

    // SECURITY: Rate limit
    const rateLimitResult = await (withRateLimitAsync('write', 'bids'))(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: 429, headers: rateLimitResult.headers }
      );
    }

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

    // SECURITY: Validate amount is positive
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 }
      );
    }

    // SECURITY: Use serializable transaction to prevent race conditions (concurrent bid attacks)
    const txResult = await prisma.$transaction(async (tx) => {
      // Get listing inside transaction for consistent read
      const listing = await tx.listing.findUnique({
        where: { id: listingId },
        include: {
          bids: {
            orderBy: { amount: "desc" },
            take: 1,
          },
        },
      });

      if (!listing) {
        return { error: "Listing not found", status: 404 } as const;
      }

      if (listing.status !== "ACTIVE") {
        return { error: "Listing is not active", status: 400 } as const;
      }

      if (new Date() > listing.endTime) {
        return { error: "Auction has ended", status: 400 } as const;
      }

      if (listing.sellerId === userId) {
        return { error: "Seller cannot bid on their own listing", status: 400 } as const;
      }

      // Check minimum bid
      const currentHighBid = listing.bids[0]?.amount || null;

      if (currentHighBid !== null) {
        if (amount <= Number(currentHighBid)) {
          return { error: `Bid must be higher than ${currentHighBid} ${listing.currency}`, status: 400 } as const;
        }
      } else {
        if (amount < Number(listing.startingPrice)) {
          return { error: `Bid must be at least ${listing.startingPrice} ${listing.currency}`, status: 400 } as const;
        }
      }

      // Mark previous winning bid as outbid
      let previousBidderId: string | null = null;
      if (listing.bids[0]) {
        await tx.bid.update({
          where: { id: listing.bids[0].id },
          data: { isWinning: false, isOutbid: true },
        });
        previousBidderId = listing.bids[0].bidderId;
      }

      // ANTI-SNIPE: Extend auction if bid placed in final minutes (inside transaction for atomicity)
      const txNow = new Date();
      const timeUntilEndMs = listing.endTime.getTime() - txNow.getTime();
      const antiSnipeWindowMs = PLATFORM_CONFIG.auction.antiSnipeMinutes * 60 * 1000;
      const antiSnipeExtensionMs = PLATFORM_CONFIG.auction.antiSnipeExtension * 60 * 1000;

      let newEndTime = null;
      if (timeUntilEndMs > 0 && timeUntilEndMs <= antiSnipeWindowMs) {
        newEndTime = new Date(txNow.getTime() + antiSnipeExtensionMs);
        await tx.listing.update({
          where: { id: listingId },
          data: { endTime: newEndTime },
        });
      }

      // Create new bid
      const bid = await tx.bid.create({
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

      return { bid, listing, previousBidderId, newEndTime } as const;
    }, {
      isolationLevel: 'Serializable',
    });

    // Handle transaction errors
    if ('error' in txResult) {
      return NextResponse.json(
        { error: txResult.error },
        { status: txResult.status }
      );
    }

    const { bid, listing, previousBidderId } = txResult;

    // Notifications outside transaction (non-critical)
    if (previousBidderId) {
      await prisma.notification.create({
        data: {
          type: "BID_OUTBID",
          title: "You've been outbid!",
          message: `Someone placed a higher bid on "${listing.title}"`,
          data: { listingId, listingSlug: listing.slug },
          userId: previousBidderId,
        },
      }).catch(console.error);
    }

    await audit({
      action: "ESCROW_DEPOSIT",
      severity: "INFO",
      userId,
      targetId: bid.id,
      targetType: "Bid",
      detail: `Bid placed: ${amount} ${listing.currency} on listing ${listingId}`,
      metadata: { listingId, amount, currency: listing.currency },
      ...auditContext(request.headers),
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

    // Notify all bidders about extension (outside transaction — non-critical)
    if (newEndTime) {
      const allBidders = await prisma.bid.findMany({
        where: { listingId },
        select: { bidderId: true },
        distinct: ['bidderId'],
      });

      await Promise.all(
        allBidders.map((b: { bidderId: string }) =>
          prisma.notification.create({
            data: {
              type: "AUCTION_EXTENDED",
              title: "Auction Extended!",
              message: `The auction for "${listing.title}" has been extended by ${PLATFORM_CONFIG.auction.antiSnipeExtension} minutes due to a late bid.`,
              data: { listingId, listingSlug: listing.slug, newEndTime: newEndTime!.toISOString() },
              userId: b.bidderId,
            },
          }).catch(console.error)
        )
      );
    }

    return NextResponse.json({
      bid,
      auctionExtended: newEndTime !== null,
      newEndTime: newEndTime?.toISOString() || null,
    }, { status: 201 });
  } catch (error) {
    console.error("Error placing bid:", error);
    return NextResponse.json(
      { error: "Failed to place bid" },
      { status: 500 }
    );
  }
}
