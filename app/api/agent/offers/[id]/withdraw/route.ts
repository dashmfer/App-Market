import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import {
  authenticateAgent,
  hasPermission,
  agentErrorResponse,
  agentSuccessResponse,
} from "@/lib/agent-auth";
import { ApiKeyPermission } from "@/lib/prisma-enums";

// POST /api/agent/offers/[id]/withdraw - Withdraw an offer (buyer only)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await authenticateAgent(request);
    if (!auth.success || !hasPermission(auth, ApiKeyPermission.WRITE)) {
      return agentErrorResponse(auth.error || "Unauthorized", auth.statusCode || 401);
    }

    const offer = await prisma.offer.findUnique({
      where: { id: params.id },
      include: {
        listing: {
          select: {
            title: true,
            sellerId: true,
          },
        },
      },
    });

    if (!offer) {
      return agentErrorResponse("Offer not found", 404);
    }

    if (offer.buyerId !== auth.userId) {
      return agentErrorResponse("Only the buyer can withdraw this offer", 403);
    }

    if (offer.status !== "ACTIVE") {
      return agentErrorResponse("Offer is not active", 400);
    }

    const updatedOffer = await prisma.offer.update({
      where: { id: params.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
      },
    });

    await prisma.notification.create({
      data: {
        userId: offer.listing.sellerId,
        type: "SYSTEM",
        title: "Offer Withdrawn",
        message: `An offer on "${offer.listing.title}" was withdrawn by the buyer.`,
        data: { offerId: offer.id, listingId: offer.listingId },
      },
    });

    return agentSuccessResponse({ offer: updatedOffer });
  } catch (error) {
    console.error("[Agent] Error withdrawing offer:", error);
    return agentErrorResponse("Failed to withdraw offer", 500);
  }
}
