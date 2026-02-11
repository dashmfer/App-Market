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

// GET /api/agent/offers - Get all offers made by the authenticated user
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAgent(request);
    if (!auth.success || !hasPermission(auth, ApiKeyPermission.READ)) {
      return agentErrorResponse(auth.error || "Unauthorized", auth.statusCode || 401);
    }

    // SECURITY: Rate limit
    const rateLimitResult = await (withRateLimitAsync('read', 'agent-offers'))(request);
    if (!rateLimitResult.success) {
      return agentErrorResponse(rateLimitResult.error || "Rate limit exceeded", 429);
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
  } catch (error) {
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

    // SECURITY: Rate limit
    const rateLimitResult = await (withRateLimitAsync('write', 'agent-offers'))(request);
    if (!rateLimitResult.success) {
      return agentErrorResponse(rateLimitResult.error || "Rate limit exceeded", 429);
    }

    const userId = auth.userId!;
    const body = await request.json();
    const { listingId, amount, deadline } = body;

    if (!listingId || amount === undefined || amount === null) {
      return agentErrorResponse("listingId and amount are required", 400);
    }

    if (typeof amount !== "number" || !isFinite(amount) || amount <= 0) {
      return agentErrorResponse("amount must be a positive number", 400);
    }

    // SECURITY [M8]: Wrap listing lookup + offer count checks + offer creation
    // in a Serializable transaction to prevent race conditions (matching /api/offers)
    const { offer, listing } = await prisma.$transaction(async (tx) => {
      // Check if listing exists and is active
      const listing = await tx.listing.findUnique({
        where: { id: listingId },
        select: {
          id: true,
          title: true,
          status: true,
          sellerId: true,
        },
      });

      if (!listing) {
        throw new Error("LISTING_NOT_FOUND");
      }

      if (listing.status !== "ACTIVE") {
        throw new Error("LISTING_NOT_ACTIVE");
      }

      if (listing.sellerId === userId) {
        throw new Error("OWN_LISTING");
      }

      // Enforce offer limits within the transaction to prevent bypass via race condition
      const activeOffersOnListing = await tx.offer.count({
        where: {
          buyerId: userId,
          listingId,
          status: "ACTIVE",
        },
      });

      if (activeOffersOnListing >= 3) {
        throw new Error("MAX_OFFERS_ON_LISTING");
      }

      const totalActiveOffers = await tx.offer.count({
        where: {
          buyerId: userId,
          status: "ACTIVE",
        },
      });

      if (totalActiveOffers >= 10) {
        throw new Error("MAX_TOTAL_OFFERS");
      }

      // Create offer
      const offer = await tx.offer.create({
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

      return { offer, listing };
    }, { isolationLevel: 'Serializable' });

    // Notify seller (outside transaction - notification is non-critical)
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage === "LISTING_NOT_FOUND") {
      return agentErrorResponse("Listing not found", 404);
    }
    if (errorMessage === "LISTING_NOT_ACTIVE") {
      return agentErrorResponse("Listing is not active", 400);
    }
    if (errorMessage === "OWN_LISTING") {
      return agentErrorResponse("Cannot make offer on your own listing", 400);
    }
    if (errorMessage === "MAX_OFFERS_ON_LISTING") {
      return agentErrorResponse("You already have the maximum of 3 active offers on this listing", 429);
    }
    if (errorMessage === "MAX_TOTAL_OFFERS") {
      return agentErrorResponse("You have reached the maximum of 10 active offers", 429);
    }

    console.error("[Agent] Error creating offer:", error);
    return agentErrorResponse("Failed to create offer", 500);
  }
}
