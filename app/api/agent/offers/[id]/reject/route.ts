import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import {
  authenticateAgent,
  hasPermission,
  agentErrorResponse,
  agentSuccessResponse,
} from "@/lib/agent-auth";
import { ApiKeyPermission } from "@/lib/prisma-enums";

// POST /api/agent/offers/[id]/reject - Reject an offer (seller only)
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
            id: true,
            title: true,
            sellerId: true,
          },
        },
      },
    });

    if (!offer) {
      return agentErrorResponse("Offer not found", 404);
    }

    if (offer.listing.sellerId !== auth.userId) {
      return agentErrorResponse("Only the seller can reject this offer", 403);
    }

    if (offer.status !== "ACTIVE") {
      return agentErrorResponse("Offer is not active", 400);
    }

    const updatedOffer = await prisma.offer.update({
      where: { id: params.id },
      data: {
        status: "REJECTED",
        rejectedAt: new Date(),
      },
    });

    await prisma.notification.create({
      data: {
        userId: offer.buyerId,
        type: "SYSTEM",
        title: "Offer Rejected",
        message: `Your offer on "${offer.listing.title}" was rejected.`,
        data: { offerId: offer.id, listingId: offer.listingId },
      },
    });

    return agentSuccessResponse({ offer: updatedOffer });
  } catch (error) {
    console.error("[Agent] Error rejecting offer:", error);
    return agentErrorResponse("Failed to reject offer", 500);
  }
}
