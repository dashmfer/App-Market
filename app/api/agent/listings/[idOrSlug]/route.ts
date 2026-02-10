import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import {
  authenticateAgent,
  hasPermission,
  agentErrorResponse,
  agentSuccessResponse,
} from "@/lib/agent-auth";
import { ApiKeyPermission } from "@/lib/prisma-enums";

// GET /api/agent/listings/[idOrSlug] - Get a single listing by ID or slug
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

    // Try by slug first, then by ID
    let listing = await prisma.listing.findUnique({
      where: { slug: idOrSlug },
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
              },
            },
          },
        },
        _count: {
          select: { bids: true, watchlist: true },
        },
      },
    });

    if (!listing) {
      listing = await prisma.listing.findUnique({
        where: { id: idOrSlug },
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
                },
              },
            },
          },
          _count: {
            select: { bids: true, watchlist: true },
          },
        },
      });
    }

    if (!listing) {
      return agentErrorResponse("Listing not found", 404);
    }

    const currentBid = listing.bids[0]?.amount || listing.startingPrice;

    return agentSuccessResponse({
      listing: {
        ...listing,
        currentBid,
        bidCount: listing._count.bids,
      },
    });
  } catch (error: any) {
    console.error("[Agent] Error fetching listing:", error);
    return agentErrorResponse("Failed to fetch listing", 500);
  }
}
