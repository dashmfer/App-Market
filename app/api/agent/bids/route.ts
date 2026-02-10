import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import {
  authenticateAgent,
  hasPermission,
  agentErrorResponse,
  agentSuccessResponse,
} from "@/lib/agent-auth";
import { ApiKeyPermission } from "@/lib/prisma-enums";
import { PLATFORM_CONFIG } from "@/lib/config";

// GET /api/agent/bids - Get all bids placed by the authenticated user
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAgent(request);
    if (!auth.success || !hasPermission(auth, ApiKeyPermission.READ)) {
      return agentErrorResponse(auth.error || "Unauthorized", auth.statusCode || 401);
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
  } catch (error: any) {
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

    const userId = auth.userId!;
    const body = await request.json();
    const { listingId, amount, currency } = body;

    if (!listingId || !amount) {
      return agentErrorResponse("listingId and amount are required", 400);
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
      return agentErrorResponse("Listing not found", 404);
    }

    if (listing.status !== "ACTIVE") {
      return agentErrorResponse("Listing is not active", 400);
    }

    if (new Date() > listing.endTime) {
      return agentErrorResponse("Auction has ended", 400);
    }

    if (listing.sellerId === userId) {
      return agentErrorResponse("Seller cannot bid on their own listing", 400);
    }

    // Check minimum bid
    const currentHighBid = listing.bids[0]?.amount || null;
    if (currentHighBid !== null) {
      if (amount <= Number(currentHighBid)) {
        return agentErrorResponse(`Bid must be higher than ${currentHighBid} ${listing.currency}`, 400);
      }
    } else {
      if (amount < Number(listing.startingPrice)) {
        return agentErrorResponse(`Bid must be at least ${listing.startingPrice} ${listing.currency}`, 400);
      }
    }

    // Mark previous winning bid as outbid
    if (listing.bids[0]) {
      await prisma.bid.update({
        where: { id: listing.bids[0].id },
        data: { isWinning: false, isOutbid: true },
      });
    }

    // Create new bid
    const bid = await prisma.bid.create({
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

    return agentSuccessResponse({ bid }, 201);
  } catch (error: any) {
    console.error("[Agent] Error placing bid:", error);
    return agentErrorResponse("Failed to place bid", 500);
  }
}
