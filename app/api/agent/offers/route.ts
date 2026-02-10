import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import {
  authenticateAgent,
  hasPermission,
  agentErrorResponse,
  agentSuccessResponse,
} from "@/lib/agent-auth";
import { ApiKeyPermission } from "@/lib/prisma-enums";

// GET /api/agent/offers - Get all offers made by the authenticated user
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAgent(request);
    if (!auth.success || !hasPermission(auth, ApiKeyPermission.READ)) {
      return agentErrorResponse(auth.error || "Unauthorized", auth.statusCode || 401);
    }

    const offers = await prisma.offer.findMany({
      where: { buyerId: auth.userId },
      include: {
        buyer: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
          },
        },
        listing: {
          select: {
            id: true,
            title: true,
            slug: true,
            thumbnailUrl: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return agentSuccessResponse({ offers });
  } catch (error: any) {
    console.error("[Agent] Error fetching offers:", error);
    return agentErrorResponse("Failed to fetch offers", 500);
  }
}

// POST /api/agent/offers - Create a new offer on a listing
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAgent(request);
    if (!auth.success || !hasPermission(auth, ApiKeyPermission.WRITE)) {
      return agentErrorResponse(auth.error || "Unauthorized", auth.statusCode || 401);
    }

    const userId = auth.userId!;
    const body = await request.json();
    const { listingId, amount, deadline } = body;

    if (!listingId || !amount) {
      return agentErrorResponse("listingId and amount are required", 400);
    }

    // Check if listing exists and is active
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        title: true,
        status: true,
        sellerId: true,
      },
    });

    if (!listing) {
      return agentErrorResponse("Listing not found", 404);
    }

    if (listing.status !== "ACTIVE") {
      return agentErrorResponse("Listing is not active", 400);
    }

    if (listing.sellerId === userId) {
      return agentErrorResponse("Cannot make offer on your own listing", 400);
    }

    // Create offer
    const offer = await prisma.offer.create({
      data: {
        amount,
        deadline: deadline ? new Date(deadline) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 7 days
        listingId,
        buyerId: userId,
        status: "ACTIVE",
      },
      include: {
        buyer: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
          },
        },
        listing: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });

    // Notify seller
    await prisma.notification.create({
      data: {
        userId: listing.sellerId,
        type: "SYSTEM",
        title: "New Offer Received",
        message: `You received an offer of ${amount} SOL on "${listing.title}"`,
        data: {
          offerId: offer.id,
          listingId: listing.id,
          amount,
        },
      },
    });

    return agentSuccessResponse({ offer }, 201);
  } catch (error: any) {
    console.error("[Agent] Error creating offer:", error);
    return agentErrorResponse("Failed to create offer", 500);
  }
}
