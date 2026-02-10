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

// GET /api/agent/watchlist/check?listingId=xxx - Check if a listing is watchlisted
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAgent(request);
    if (!auth.success || !hasPermission(auth, ApiKeyPermission.READ)) {
      return agentErrorResponse(auth.error || "Unauthorized", auth.statusCode || 401);
    }

    // SECURITY: Rate limit
    const rateLimitResult = await (withRateLimitAsync('read', 'agent-watchlist-check'))(request);
    if (!rateLimitResult.success) {
      return agentErrorResponse(rateLimitResult.error || "Rate limit exceeded", 429);
    }

    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get("listingId");

    if (!listingId) {
      return agentErrorResponse("listingId is required", 400);
    }

    const existing = await prisma.watchlist.findUnique({
      where: {
        userId_listingId: {
          userId: auth.userId!,
          listingId,
        },
      },
    });

    return agentSuccessResponse({ isWatchlisted: !!existing });
  } catch (error) {
    console.error("[Agent] Error checking watchlist:", error);
    return agentErrorResponse("Failed to check watchlist", 500);
  }
}
