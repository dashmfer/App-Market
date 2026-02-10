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

// GET /api/agent/bids/[id] - Get a specific bid
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await authenticateAgent(request);
    if (!auth.success || !hasPermission(auth, ApiKeyPermission.READ)) {
      return agentErrorResponse(auth.error || "Unauthorized", auth.statusCode || 401);
    }

    // SECURITY: Rate limit
    const rateLimitResult = await (withRateLimitAsync('read', 'agent-bids-detail'))(request);
    if (!rateLimitResult.success) {
      return agentErrorResponse(rateLimitResult.error || "Rate limit exceeded", 429);
    }

    const bid = await prisma.bid.findUnique({
      where: { id: params.id },
      include: {
        listing: {
          select: {
            id: true,
            slug: true,
            title: true,
            status: true,
            endTime: true,
          },
        },
        bidder: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
    });

    if (!bid) {
      return agentErrorResponse("Bid not found", 404);
    }

    return agentSuccessResponse({ bid });
  } catch (error) {
    console.error("[Agent] Error fetching bid:", error);
    return agentErrorResponse("Failed to fetch bid", 500);
  }
}
