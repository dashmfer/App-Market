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

// GET /api/agent/watchlist - Get all watchlisted items
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAgent(request);
    if (!auth.success || !hasPermission(auth, ApiKeyPermission.READ)) {
      return agentErrorResponse(auth.error || "Unauthorized", auth.statusCode || 401);
    }

    // SECURITY: Rate limit
    const rateLimitResult = await (withRateLimitAsync('read', 'agent-watchlist'))(request);
    if (!rateLimitResult.success) {
      return agentErrorResponse(rateLimitResult.error || "Rate limit exceeded", 429);
    }

    const watchlist = await prisma.watchlist.findMany({
      where: { userId: auth.userId },
      include: {
        listing: {
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
            _count: {
              select: { bids: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const listings = watchlist.map((w: typeof watchlist[number]) => ({
      ...w.listing,
      watchlistId: w.id,
      watchlistedAt: w.createdAt,
    }));

    return agentSuccessResponse({ listings });
  } catch (error) {
    console.error("[Agent] Error fetching watchlist:", error);
    return agentErrorResponse("Failed to fetch watchlist", 500);
  }
}

// POST /api/agent/watchlist - Add a listing to watchlist
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAgent(request);
    if (!auth.success || !hasPermission(auth, ApiKeyPermission.WRITE)) {
      return agentErrorResponse(auth.error || "Unauthorized", auth.statusCode || 401);
    }

    // SECURITY: Rate limit
    const rateLimitResult = await (withRateLimitAsync('write', 'agent-watchlist'))(request);
    if (!rateLimitResult.success) {
      return agentErrorResponse(rateLimitResult.error || "Rate limit exceeded", 429);
    }

    const userId = auth.userId!;
    const body = await request.json();
    const { listingId } = body;

    if (!listingId) {
      return agentErrorResponse("listingId is required", 400);
    }

    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      return agentErrorResponse("Listing not found", 404);
    }

    // Check if already watchlisted
    const existing = await prisma.watchlist.findUnique({
      where: {
        userId_listingId: { userId, listingId },
      },
    });

    if (existing) {
      return agentErrorResponse("Already in watchlist", 400);
    }

    const watchlist = await prisma.watchlist.create({
      data: { userId, listingId },
    });

    return agentSuccessResponse({
      watchlistId: watchlist.id,
      message: "Added to watchlist",
    }, 201);
  } catch (error) {
    console.error("[Agent] Error adding to watchlist:", error);
    return agentErrorResponse("Failed to add to watchlist", 500);
  }
}

// DELETE /api/agent/watchlist?listingId=xxx - Remove a listing from watchlist
export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateAgent(request);
    if (!auth.success || !hasPermission(auth, ApiKeyPermission.WRITE)) {
      return agentErrorResponse(auth.error || "Unauthorized", auth.statusCode || 401);
    }

    // SECURITY: Rate limit
    const rateLimitResult = await (withRateLimitAsync('write', 'agent-watchlist'))(request);
    if (!rateLimitResult.success) {
      return agentErrorResponse(rateLimitResult.error || "Rate limit exceeded", 429);
    }

    const userId = auth.userId!;
    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get("listingId");

    if (!listingId) {
      return agentErrorResponse("listingId is required", 400);
    }

    const existing = await prisma.watchlist.findUnique({
      where: {
        userId_listingId: { userId, listingId },
      },
    });

    if (!existing) {
      return agentErrorResponse("Not in watchlist", 404);
    }

    await prisma.watchlist.delete({
      where: { id: existing.id },
    });

    return agentSuccessResponse({ message: "Removed from watchlist" });
  } catch (error) {
    console.error("[Agent] Error removing from watchlist:", error);
    return agentErrorResponse("Failed to remove from watchlist", 500);
  }
}
