import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import {
  authenticateAgent,
  hasPermission,
  agentErrorResponse,
  agentSuccessResponse,
} from "@/lib/agent-auth";
import { ApiKeyPermission } from "@/lib/prisma-enums";

// GET /api/agent/offers/received - Get offers received on user's listings (seller)
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAgent(request);
    if (!auth.success || !hasPermission(auth, ApiKeyPermission.READ)) {
      return agentErrorResponse(auth.error || "Unauthorized", auth.statusCode || 401);
    }

    const offers = await prisma.offer.findMany({
      where: {
        listing: {
          sellerId: auth.userId,
        },
      },
      include: {
        buyer: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
          },
        },
        listing: {
          select: {
            id: true,
            title: true,
            slug: true,
            thumbnailUrl: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return agentSuccessResponse({ offers });
  } catch (error) {
    console.error("[Agent] Error fetching received offers:", error);
    return agentErrorResponse("Failed to fetch received offers", 500);
  }
}
