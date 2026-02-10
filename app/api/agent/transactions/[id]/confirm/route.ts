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

// POST /api/agent/transactions/[id]/confirm - Confirm asset transfer (buyer confirms receipt)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await authenticateAgent(request);
    if (!auth.success || !hasPermission(auth, ApiKeyPermission.TRANSACTION)) {
      return agentErrorResponse(auth.error || "Unauthorized", auth.statusCode || 401);
    }

    // SECURITY: Rate limit
    const rateLimitResult = await (withRateLimitAsync('write', 'agent-transactions-confirm'))(request);
    if (!rateLimitResult.success) {
      return agentErrorResponse(rateLimitResult.error || "Rate limit exceeded", 429);
    }

    const userId = auth.userId!;
    const transactionId = params.id;
    const body = await request.json();
    const { asset, action, evidence } = body;

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        listing: true,
        buyer: true,
        seller: true,
      },
    });

    if (!transaction) {
      return agentErrorResponse("Transaction not found", 404);
    }

    const allowedStates = ["FUNDED", "IN_PROGRESS", "TRANSFER_IN_PROGRESS", "AWAITING_CONFIRMATION"];
    if (!allowedStates.includes(transaction.status)) {
      return agentErrorResponse(`Cannot confirm transfers in state: ${transaction.status}`, 400);
    }

    const isBuyer = transaction.buyerId === userId;
    const isSeller = transaction.sellerId === userId;

    if (!isBuyer && !isSeller) {
      return agentErrorResponse("Not authorized for this transaction", 403);
    }

    // Get current checklist
    const checklist = transaction.transferChecklist as Array<{
      id: string;
      label: string;
      description: string;
      iconType: string;
      required: boolean;
      sellerConfirmed: boolean;
      sellerConfirmedAt: string | null;
      sellerEvidence: string | null;
      buyerConfirmed: boolean;
      buyerConfirmedAt: string | null;
    }>;

    if (!checklist || !Array.isArray(checklist)) {
      return agentErrorResponse("Transfer checklist not initialized", 400);
    }

    const itemIndex = checklist.findIndex((item) => item.id === asset);
    if (itemIndex === -1) {
      return agentErrorResponse("Invalid asset", 400);
    }
    const item = checklist[itemIndex];

    if (action === "sellerConfirm") {
      if (!isSeller) {
        return agentErrorResponse("Only seller can mark as transferred", 403);
      }
      item.sellerConfirmed = true;
      item.sellerEvidence = evidence || null;
      item.sellerConfirmedAt = new Date().toISOString();
    } else if (action === "buyerConfirm") {
      if (!isBuyer) {
        return agentErrorResponse("Only buyer can confirm receipt", 403);
      }
      item.buyerConfirmed = true;
      item.buyerConfirmedAt = new Date().toISOString();
    } else {
      return agentErrorResponse("Invalid action. Use 'sellerConfirm' or 'buyerConfirm'", 400);
    }

    checklist[itemIndex] = item;

    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        transferChecklist: checklist,
        status: "TRANSFER_IN_PROGRESS",
        transferStartedAt: transaction.transferStartedAt || new Date(),
      },
    });

    // Check if all required items confirmed by both parties
    const allConfirmed = checklist
      .filter((item) => item.required)
      .every((item) => item.sellerConfirmed && item.buyerConfirmed);

    if (allConfirmed) {
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: "COMPLETED",
          transferCompletedAt: new Date(),
          releasedAt: new Date(),
        },
      });

      // Update stats
      await prisma.user.update({
        where: { id: transaction.sellerId },
        data: {
          totalSales: { increment: 1 },
          totalVolume: { increment: Number(transaction.salePrice) },
        },
      });

      await prisma.user.update({
        where: { id: transaction.buyerId },
        data: { totalPurchases: { increment: 1 } },
      });
    }

    return agentSuccessResponse({ checklist, allConfirmed });
  } catch (error) {
    console.error("[Agent] Error confirming transfer:", error);
    return agentErrorResponse("Failed to confirm transfer", 500);
  }
}
