import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import {
  authenticateAgent,
  hasPermission,
  agentErrorResponse,
  agentSuccessResponse,
} from "@/lib/agent-auth";
import { ApiKeyPermission } from "@/lib/prisma-enums";

// GET /api/agent/transactions/[id] - Get a specific transaction
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await authenticateAgent(request);
    if (!auth.success || !hasPermission(auth, ApiKeyPermission.READ)) {
      return agentErrorResponse(auth.error || "Unauthorized", auth.statusCode || 401);
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: params.id },
      include: {
        listing: {
          select: {
            id: true,
            slug: true,
            title: true,
            thumbnailUrl: true,
            categories: true,
            description: true,
          },
        },
        buyer: {
          select: {
            id: true,
            name: true,
            username: true,
            walletAddress: true,
          },
        },
        seller: {
          select: {
            id: true,
            name: true,
            username: true,
            walletAddress: true,
          },
        },
        agreements: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!transaction) {
      return agentErrorResponse("Transaction not found", 404);
    }

    // Only buyer or seller can view
    if (transaction.buyerId !== auth.userId && transaction.sellerId !== auth.userId) {
      return agentErrorResponse("Not authorized to view this transaction", 403);
    }

    return agentSuccessResponse({ transaction });
  } catch (error: any) {
    console.error("[Agent] Error fetching transaction:", error);
    return agentErrorResponse("Failed to fetch transaction", 500);
  }
}
