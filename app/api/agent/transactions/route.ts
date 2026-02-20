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

    // SECURITY: Whitelist valid status values
    const VALID_TX_STATUSES = ["PENDING", "AWAITING_PAYMENT", "PAID", "TRANSFER_IN_PROGRESS", "AWAITING_CONFIRMATION", "COMPLETING", "COMPLETED", "CANCELLED", "DISPUTED", "REFUNDED", "AWAITING_PARTNER_DEPOSITS"];
    if (status) {
      const upperStatus = status.toUpperCase();
      if (VALID_TX_STATUSES.includes(upperStatus)) {
        where.status = upperStatus;
      }
    }

    const transactions = await prisma.transaction.findMany({
      where,
      take: 100,
      orderBy: { createdAt: "desc" },
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
