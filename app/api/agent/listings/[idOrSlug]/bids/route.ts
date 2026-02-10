import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import {
  authenticateAgent,
  hasPermission,
  agentErrorResponse,
  agentSuccessResponse,
} from "@/lib/agent-auth";
import { ApiKeyPermission } from "@/lib/prisma-enums";

// GET /api/agent/listings/[idOrSlug]/bids - Get bids for a listing
export async function GET(
  request: NextRequest,
  { params }: { params: { idOrSlug: string } }
) {
  try {
    const auth = await authenticateAgent(request);
    if (!auth.success || !hasPermission(auth, ApiKeyPermission.READ)) {
      return agentErrorResponse(auth.error || "Unauthorized", auth.statusCode || 401);
    }

    const { idOrSlug } = params;

    // Resolve listing ID from slug or ID
    let listingId = idOrSlug;
    const listing = await prisma.listing.findFirst({
      where: {
        OR: [{ slug: idOrSlug }, { id: idOrSlug }],
      },
      select: { id: true },
    });

    if (!listing) {
      return agentErrorResponse("Listing not found", 404);
    }
    listingId = listing.id;

    const bids = await prisma.bid.findMany({
      where: { listingId },
      orderBy: { amount: "desc" },
      include: {
        bidder: {
          select: {
            id: true,
            name: true,
            username: true,
            isVerified: true,
          },
        },
      },
    });

    const transformedBids = bids.map((bid: typeof bids[number]) => ({
      id: bid.id,
      amount: bid.amount,
      currency: bid.currency,
      bidder: bid.bidder.username || "Anonymous",
      bidderId: bid.bidder.id,
      isWinning: bid.isWinning,
      createdAt: bid.createdAt,
    }));

    return agentSuccessResponse({ bids: transformedBids });
  } catch (error) {
    console.error("[Agent] Error fetching listing bids:", error);
    return agentErrorResponse("Failed to fetch bids", 500);
  }
}
