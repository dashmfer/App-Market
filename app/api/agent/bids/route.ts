import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import {
  authenticateAgent,
  hasPermission,
  agentErrorResponse,
  agentSuccessResponse,
} from "@/lib/agent-auth";
import { withRateLimitAsync } from "@/lib/rate-limit";
import { ApiKeyPermission } from "@/lib/prisma-enums";
import { PLATFORM_CONFIG } from "@/lib/config";

// GET /api/agent/bids - Get all bids placed by the authenticated user
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAgent(request);
    if (!auth.success || !hasPermission(auth, ApiKeyPermission.READ)) {
      return agentErrorResponse(auth.error || "Unauthorized", auth.statusCode || 401);
    }

    // SECURITY: Rate limit
    const rateLimitResult = await (withRateLimitAsync('read', 'agent-bids'))(request);
    if (!rateLimitResult.success) {
      return agentErrorResponse(rateLimitResult.error || "Rate limit exceeded", 429);
    }

    const bids = await prisma.bid.findMany({
      where: { bidderId: auth.userId },
      orderBy: { createdAt: "desc" },
      include: {
        listing: {
          select: {
            id: true,
            slug: true,
            title: true,
            thumbnailUrl: true,
            status: true,
            endTime: true,
          },
        },
      },
    });

    return agentSuccessResponse({ bids });
  } catch (error) {
    console.error("[Agent] Error fetching bids:", error);
    return agentErrorResponse("Failed to fetch bids", 500);
  }
}

// POST /api/agent/bids - Place a bid on a listing
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAgent(request);
    if (!auth.success || !hasPermission(auth, ApiKeyPermission.WRITE)) {
      return agentErrorResponse(auth.error || "Unauthorized", auth.statusCode || 401);
    }

    // SECURITY: Rate limit
    const rateLimitResult = await (withRateLimitAsync('write', 'agent-bids'))(request);
    if (!rateLimitResult.success) {
      return agentErrorResponse(rateLimitResult.error || "Rate limit exceeded", 429);
    }

    const userId = auth.userId!;
    const body = await request.json();
    const { listingId, amount, currency } = body;

    if (!listingId || !amount) {
      return agentErrorResponse("listingId and amount are required", 400);
    }

    // SECURITY: Validate amount is positive
    if (typeof amount !== 'number' || amount <= 0) {
      return agentErrorResponse("Amount must be a positive number", 400);
    }

    // SECURITY [H9]: Wrap listing read + bid validation + bid creation + previous
    // winner update in a serializable transaction to prevent race conditions
    const txResult = await prisma.$transaction(async (tx) => {
      // Get listing inside the serializable block
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
        return { error: "Listing not found", statusCode: 404 } as const;
      }

      if (listing.status !== "ACTIVE") {
        return { error: "Listing is not active", statusCode: 400 } as const;
      }

      if (new Date() > listing.endTime) {
        return { error: "Auction has ended", statusCode: 400 } as const;
      }

      if (listing.sellerId === userId) {
        return { error: "Seller cannot bid on their own listing", statusCode: 400 } as const;
      }

      // Check minimum bid
      const currentHighBid = listing.bids[0]?.amount || null;
      if (currentHighBid !== null) {
        if (amount <= Number(currentHighBid)) {
          return { error: `Bid must be higher than ${currentHighBid} ${listing.currency}`, statusCode: 400 } as const;
        }
      } else {
        if (amount < Number(listing.startingPrice)) {
          return { error: `Bid must be at least ${listing.startingPrice} ${listing.currency}`, statusCode: 400 } as const;
        }
      }

      // Mark previous winning bid as outbid
      if (listing.bids[0]) {
        await tx.bid.update({
          where: { id: listing.bids[0].id },
          data: { isWinning: false, isOutbid: true },
        });
      }

      // Create new bid
      const bid = await tx.bid.create({
        data: {
          amount,
          currency: currency || listing.currency,
          isWinning: true,
          listingId,
          bidderId: userId,
        },
        include: {
          bidder: {
            select: { id: true, username: true },
          },
        },
      });

      return { bid, listing } as const;
    }, { isolationLevel: 'Serializable' });

    // Handle transaction errors
    if ('error' in txResult) {
      return agentErrorResponse(txResult.error as string, txResult.statusCode as number);
    }

    const { bid, listing } = txResult;

    // Notify seller (outside the transaction -- non-critical)
    await prisma.notification.create({
      data: {
        type: "BID_PLACED",
        title: "New bid received!",
        message: `New bid of ${amount} ${listing.currency} on "${listing.title}"`,
        data: { listingId, listingSlug: listing.slug, amount },
        userId: listing.sellerId,
      },
    });

    return agentSuccessResponse({ bid }, 201);
  } catch (error) {
    console.error("[Agent] Error placing bid:", error);
    return agentErrorResponse("Failed to place bid", 500);
  }
}
