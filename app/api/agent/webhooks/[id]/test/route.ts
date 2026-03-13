import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import {
  authenticateAgent,
  hasPermission,
  signWebhookPayload,
  agentErrorResponse,
  agentSuccessResponse,
} from "@/lib/agent-auth";
import { withRateLimitAsync } from "@/lib/rate-limit";
import { ApiKeyPermission } from "@/lib/prisma-enums";
import { decrypt, looksEncrypted } from "@/lib/encryption";
import { isPrivateUrl } from "@/lib/webhooks";

// POST /api/agent/webhooks/[id]/test - Test a webhook by sending a test event
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await authenticateAgent(request);
    if (!auth.success || !hasPermission(auth, ApiKeyPermission.ADMIN)) {
      return agentErrorResponse(auth.error || "Unauthorized", auth.statusCode || 401);
    }

    // SECURITY: Rate limit
    const rateLimitResult = await (withRateLimitAsync('write', 'agent-webhook-test'))(request);
    if (!rateLimitResult.success) {
      return agentErrorResponse(rateLimitResult.error || "Rate limit exceeded", 429);
    }

    const webhook = await prisma.webhook.findUnique({
      where: { id: params.id },
      select: { id: true, url: true, secret: true, userId: true, isActive: true },
    });

    if (!webhook) {
      return agentErrorResponse("Webhook not found", 404);
    }

    if (webhook.userId !== auth.userId) {
      return agentErrorResponse("Not authorized to test this webhook", 403);
    }

    if (!webhook.isActive) {
      return agentErrorResponse("Webhook is not active", 400);
    }

    // Decrypt URL if encrypted
    const webhookUrl = looksEncrypted(webhook.url) ? decrypt(webhook.url) : webhook.url;

    // SECURITY [M5]: Block SSRF — reject private/internal IPs
    if (isPrivateUrl(webhookUrl)) {
      return agentErrorResponse("Webhook URL targets a private or internal address", 400);
    }

    // Send test payload
    const testPayload = {
      id: `evt_test_${Date.now()}`,
      type: "test",
      timestamp: Date.now(),
      data: {
        message: "This is a test webhook delivery from AppMarket.",
      },
    };

    const payloadString = JSON.stringify(testPayload);
    const secret = looksEncrypted(webhook.secret)
      ? decrypt(webhook.secret)
      : webhook.secret;
    const signature = signWebhookPayload(payloadString, secret);

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "X-Webhook-Timestamp": Date.now().toString(),
          "User-Agent": "AppMarket-Webhooks/1.0",
        },
        body: payloadString,
        signal: AbortSignal.timeout(10000),
      });

      return agentSuccessResponse({
        delivered: response.ok,
        statusCode: response.status,
      });
    } catch (error: any) {
      return agentSuccessResponse({
        delivered: false,
        error: error.message || "Failed to deliver test webhook",
      });
    }
  } catch (error) {
    console.error("[Agent] Error testing webhook:", error);
    return agentErrorResponse("Failed to test webhook", 500);
  }
}
