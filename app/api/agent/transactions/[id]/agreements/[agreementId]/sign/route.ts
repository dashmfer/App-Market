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

// POST /api/agent/transactions/[id]/agreements/[agreementId]/sign - Sign an agreement
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; agreementId: string } }
) {
  try {
    const auth = await authenticateAgent(request);
    if (!auth.success || !hasPermission(auth, ApiKeyPermission.TRANSACTION)) {
      return agentErrorResponse(auth.error || "Unauthorized", auth.statusCode || 401);
    }

    // SECURITY: Rate limit
    const rateLimitResult = await (withRateLimitAsync('write', 'agent-agreements-sign'))(request);
    if (!rateLimitResult.success) {
      return agentErrorResponse(rateLimitResult.error || "Rate limit exceeded", 429);
    }

    const userId = auth.userId!;
    const { id: transactionId, agreementId } = params;

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: { buyerId: true, sellerId: true },
    });

    if (!transaction) {
      return agentErrorResponse("Transaction not found", 404);
    }

    const isBuyer = transaction.buyerId === userId;
    const isSeller = transaction.sellerId === userId;

    if (!isBuyer && !isSeller) {
      return agentErrorResponse("Not authorized for this transaction", 403);
    }

    const agreement = await prisma.transactionAgreement.findUnique({
      where: { id: agreementId },
    });

    if (!agreement || agreement.transactionId !== transactionId) {
      return agentErrorResponse("Agreement not found", 404);
    }

    const body = await request.json();
    const { signature } = body;

    const updateData: any = {};

    if (isBuyer && !agreement.buyerSigned) {
      updateData.buyerSigned = true;
      updateData.buyerSignature = signature || null;
      updateData.buyerSignedAt = new Date();
    } else if (isSeller && !agreement.sellerSigned) {
      updateData.sellerSigned = true;
      updateData.sellerSignature = signature || null;
      updateData.sellerSignedAt = new Date();
    } else {
      return agentErrorResponse("You have already signed this agreement", 400);
    }

    const bothSigned =
      (updateData.buyerSigned || agreement.buyerSigned) &&
      (updateData.sellerSigned || agreement.sellerSigned);

    if (bothSigned) {
      updateData.status = "COMPLETED";
    }

    const updatedAgreement = await prisma.transactionAgreement.update({
      where: { id: agreementId },
      data: updateData,
    });

    return agentSuccessResponse({ agreement: updatedAgreement });
  } catch (error) {
    console.error("[Agent] Error signing agreement:", error);
    return agentErrorResponse("Failed to sign agreement", 500);
  }
}
