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

// GET /api/agent/transactions - List all transactions for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAgent(request);
    if (!auth.success || !hasPermission(auth, ApiKeyPermission.READ)) {
      return agentErrorResponse(auth.error || "Unauthorized", auth.statusCode || 401);
    }

    // SECURITY: Rate limit
    const rateLimitResult = await (withRateLimitAsync('read', 'agent-transactions'))(request);
    if (!rateLimitResult.success) {
      return agentErrorResponse(rateLimitResult.error || "Rate limit exceeded", 429);
    }

    const userId = auth.userId!;
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role") || "all";
    const status = searchParams.get("status");

    const where: any = {};

    if (role === "buyer") {
      where.buyerId = userId;
    } else if (role === "seller") {
      where.sellerId = userId;
    } else {
      where.OR = [{ buyerId: userId }, { sellerId: userId }];
    }

    // SECURITY: Whitelist allowed transaction statuses
    // SECURITY [L2]: Don't expose internal state names in error messages
    const ALLOWED_TX_STATUSES = ["PENDING", "IN_ESCROW", "TRANSFER_PENDING", "TRANSFER_IN_PROGRESS", "AWAITING_CONFIRMATION", "DISPUTED", "PENDING_RELEASE", "COMPLETED", "REFUNDED", "CANCELLED"];
    if (status) {
      const upper = status.toUpperCase();
      if (!ALLOWED_TX_STATUSES.includes(upper)) {
        return agentErrorResponse("Invalid status filter", 400);
      }
      where.status = upper;
    }

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        listing: {
          select: {
            id: true,
            slug: true,
            title: true,
            thumbnailUrl: true,
            categories: true,
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
      },
    });

    return agentSuccessResponse({ transactions });
  } catch (error) {
    console.error("[Agent] Error fetching transactions:", error);
    return agentErrorResponse("Failed to fetch transactions", 500);
  }
}
