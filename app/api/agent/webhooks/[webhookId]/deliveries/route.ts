import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import {
  authenticateAgent,
  hasPermission,
  agentErrorResponse,
  agentSuccessResponse,
} from "@/lib/agent-auth";
import { ApiKeyPermission } from "@/lib/prisma-enums";

// GET /api/agent/webhooks/[webhookId]/deliveries - Get webhook delivery history
export async function GET(
  request: NextRequest,
  { params }: { params: { webhookId: string } }
) {
  try {
    const auth = await authenticateAgent(request);
    if (!auth.success || !hasPermission(auth, ApiKeyPermission.READ)) {
      return agentErrorResponse(auth.error || "Unauthorized", auth.statusCode || 401);
    }

    // Verify webhook ownership
    const webhook = await prisma.webhook.findUnique({
      where: { id: params.webhookId },
      select: { userId: true },
    });

    if (!webhook) {
      return agentErrorResponse("Webhook not found", 404);
    }

    if (webhook.userId !== auth.userId) {
      return agentErrorResponse("Not authorized to view this webhook's deliveries", 403);
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "20", 10), 100);

    const total = await prisma.webhookDelivery.count({
      where: { webhookId: params.webhookId },
    });

    const deliveries = await prisma.webhookDelivery.findMany({
      where: { webhookId: params.webhookId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        eventType: true,
        status: true,
        attempts: true,
        maxAttempts: true,
        responseStatus: true,
        errorMessage: true,
        createdAt: true,
        deliveredAt: true,
        nextRetryAt: true,
      },
    });

    return agentSuccessResponse({
      deliveries,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("[Agent] Error fetching webhook deliveries:", error);
    return agentErrorResponse("Failed to fetch webhook deliveries", 500);
  }
}
