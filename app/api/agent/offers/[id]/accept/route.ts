import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { calculatePlatformFee } from "@/lib/solana";
import {
  authenticateAgent,
  hasPermission,
  agentErrorResponse,
  agentSuccessResponse,
} from "@/lib/agent-auth";
import { ApiKeyPermission } from "@/lib/prisma-enums";

// POST /api/agent/offers/[id]/accept - Accept an offer (seller only)
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
            status: true,
            currency: true,
          },
        },
      },
    });

    if (!offer) {
      return agentErrorResponse("Offer not found", 404);
    }

    if (offer.listing.sellerId !== auth.userId) {
      return agentErrorResponse("Only the seller can accept this offer", 403);
    }

    if (offer.status !== "ACTIVE") {
      return agentErrorResponse("Offer is not active", 400);
    }

    if (offer.listing.status !== "ACTIVE") {
      return agentErrorResponse("Listing is not active", 400);
    }

    if (new Date() > offer.deadline) {
      await prisma.offer.update({
        where: { id: params.id },
        data: { status: "EXPIRED", expiredAt: new Date() },
      });
      return agentErrorResponse("Offer has expired", 400);
    }

    const platformFee = calculatePlatformFee(offer.amount, offer.listing.currency);
    const sellerProceeds = Number(offer.amount) - platformFee;

    const [updatedOffer, transaction] = await prisma.$transaction([
      prisma.offer.update({
        where: { id: params.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      }),
      prisma.transaction.create({
        data: {
          listingId: offer.listingId,
          buyerId: offer.buyerId,
          sellerId: offer.listing.sellerId,
          salePrice: offer.amount,
          platformFee,
          sellerProceeds,
          currency: offer.listing.currency,
          paymentMethod: "SOLANA",
          status: "IN_ESCROW",
        },
      }),
      prisma.listing.update({
        where: { id: offer.listingId },
        data: { status: "RESERVED" as any },
      }),
      prisma.offer.updateMany({
        where: {
          listingId: offer.listingId,
          id: { not: params.id },
          status: "ACTIVE",
        },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      }),
    ]);

    await prisma.notification.create({
      data: {
        userId: offer.buyerId,
        type: "OFFER_ACCEPTED",
        title: "Offer Accepted!",
        message: `Your offer on "${offer.listing.title}" was accepted!`,
        data: { offerId: offer.id, listingId: offer.listingId, transactionId: transaction.id },
      },
    });

    return agentSuccessResponse({ offer: updatedOffer, transaction });
  } catch (error) {
    console.error("[Agent] Error accepting offer:", error);
    return agentErrorResponse("Failed to accept offer", 500);
  }
}
