import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import {
  authenticateAgent,
  hasPermission,
  agentErrorResponse,
  agentSuccessResponse,
} from "@/lib/agent-auth";
import { ApiKeyPermission } from "@/lib/prisma-enums";

// GET /api/agent/listings/[idOrSlug]/offers - Get offers for a listing (seller only)
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

    // Resolve listing
    const listing = await prisma.listing.findFirst({
      where: {
        OR: [{ slug: idOrSlug }, { id: idOrSlug }],
      },
      select: { id: true, sellerId: true },
    });

    if (!listing) {
      return agentErrorResponse("Listing not found", 404);
    }

    // Only seller can view offers on their listing
    if (listing.sellerId !== auth.userId) {
      return agentErrorResponse("Only the seller can view offers on this listing", 403);
    }

    const offers = await prisma.offer.findMany({
      where: { listingId: listing.id },
      include: {
        buyer: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
            rating: true,
            totalPurchases: true,
          },
        },
      },
      orderBy: { amount: "desc" },
    });

    return agentSuccessResponse({ offers });
  } catch (error) {
    console.error("[Agent] Error fetching listing offers:", error);
    return agentErrorResponse("Failed to fetch offers", 500);
  }
}
