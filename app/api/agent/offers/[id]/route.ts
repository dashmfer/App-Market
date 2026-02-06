import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import {
  authenticateAgent,
  hasPermission,
  agentErrorResponse,
  agentSuccessResponse,
} from "@/lib/agent-auth";
import { ApiKeyPermission } from "@/lib/prisma-enums";

// GET /api/agent/offers/[id] - Get a specific offer
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await authenticateAgent(request);
    if (!auth.success || !hasPermission(auth, ApiKeyPermission.READ)) {
      return agentErrorResponse(auth.error || "Unauthorized", auth.statusCode || 401);
    }

    const offer = await prisma.offer.findUnique({
      where: { id: params.id },
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
            sellerId: true,
          },
        },
      },
    });

    if (!offer) {
      return agentErrorResponse("Offer not found", 404);
    }

    // Only buyer or seller can view the offer
    if (offer.buyerId !== auth.userId && offer.listing.sellerId !== auth.userId) {
      return agentErrorResponse("Not authorized to view this offer", 403);
    }

    return agentSuccessResponse({ offer });
  } catch (error) {
    console.error("[Agent] Error fetching offer:", error);
    return agentErrorResponse("Failed to fetch offer", 500);
  }
}
