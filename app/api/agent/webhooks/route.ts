import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthToken } from "@/lib/auth";
import {
  authenticateAgent,
  hasPermission,
  generateWebhookSecret,
  agentErrorResponse,
  agentSuccessResponse,
} from "@/lib/agent-auth";
import { withRateLimitAsync } from "@/lib/rate-limit";
import { ApiKeyPermission, WebhookEventType } from "@/lib/prisma-enums";
import { encrypt } from "@/lib/encryption";

// SECURITY: SSRF protection — block private/internal IPs in webhook URLs
function checkSsrfUrl(hostname: string): string | null {
  const h = hostname.toLowerCase();

  // Block localhost variants
  if (h === "localhost" || h === "::1" || h === "0.0.0.0" || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) {
    return "Webhook URL cannot point to localhost";
  }

  // Block private IP ranges (RFC 1918), link-local, CGNAT
  const privatePatterns = [
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
    /^192\.168\.\d{1,3}\.\d{1,3}$/,
    /^169\.254\.\d{1,3}\.\d{1,3}$/,           // AWS/cloud metadata
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}$/, // CGNAT
  ];

  if (privatePatterns.some(p => p.test(h))) {
    return "Webhook URL cannot point to private/internal IP addresses";
  }

  // IPv6 private ranges
  if (h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80') ||
      h === '::ffff:127.0.0.1' || h.startsWith('::ffff:10.') ||
      h.startsWith('::ffff:192.168.') || h.startsWith('::ffff:172.')) {
    return 'Webhook URL cannot point to private IPv6 addresses';
  }

  // Block cloud metadata hostnames
  if (["metadata.google.internal", "metadata.google", "instance-data"].some(b => h.includes(b))) {
    return "Webhook URL cannot point to cloud metadata services";
  }

  return null;
}

// GET /api/agent/webhooks - List user's webhooks
export async function GET(request: NextRequest) {
  try {
    let userId: string | undefined;

    const token = await getAuthToken(request);
    if (token?.id) {
      userId = token.id as string;
    } else {
      const agentAuth = await authenticateAgent(request);
      if (agentAuth.success && hasPermission(agentAuth, ApiKeyPermission.ADMIN)) {
        userId = agentAuth.userId;
      }
    }

    if (!userId) {
      return agentErrorResponse("Unauthorized", 401);
    }

    // SECURITY: Rate limit
    const rateLimitResult = await (withRateLimitAsync('read', 'agent-webhooks'))(request);
    if (!rateLimitResult.success) {
      return agentErrorResponse(rateLimitResult.error || "Rate limit exceeded", 429);
    }

    const webhooks = await prisma.webhook.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        isActive: true,
        totalDeliveries: true,
        successfulDeliveries: true,
        failedDeliveries: true,
        lastDeliveryAt: true,
        lastDeliveryStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return agentSuccessResponse({ webhooks });
  } catch (error) {
    console.error("Error fetching webhooks:", error);
    return agentErrorResponse("Failed to fetch webhooks", 500);
  }
}

// POST /api/agent/webhooks - Create a new webhook
export async function POST(request: NextRequest) {
  try {
    let userId: string | undefined;

    const token = await getAuthToken(request);
    if (token?.id) {
      userId = token.id as string;
    } else {
      const agentAuth = await authenticateAgent(request);
      if (agentAuth.success && hasPermission(agentAuth, ApiKeyPermission.ADMIN)) {
        userId = agentAuth.userId;
      }
    }

    if (!userId) {
      return agentErrorResponse("Unauthorized", 401);
    }

    // SECURITY: Rate limit
    const rateLimitResult = await (withRateLimitAsync('write', 'agent-webhooks'))(request);
    if (!rateLimitResult.success) {
      return agentErrorResponse(rateLimitResult.error || "Rate limit exceeded", 429);
    }

    const body = await request.json();
    const { name, url, events } = body;

    if (!name || typeof name !== "string") {
      return agentErrorResponse("Name is required", 400);
    }

    if (!url || typeof url !== "string") {
      return agentErrorResponse("URL is required", 400);
    }

    // Validate URL format and SECURITY: Block SSRF via private IPs
    try {
      const parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Invalid protocol");
      }
      const ssrfError = checkSsrfUrl(parsedUrl.hostname);
      if (ssrfError) {
        return agentErrorResponse(ssrfError, 400);
      }
    } catch {
      return agentErrorResponse("Invalid URL format. Must be http:// or https://", 400);
    }

    // Validate events
    const validEvents = Object.values(WebhookEventType);
    const requestedEvents = (events || []).filter((e: string) =>
      validEvents.includes(e as WebhookEventType)
    );

    if (requestedEvents.length === 0) {
      return agentErrorResponse(
        `At least one valid event is required. Available events: ${validEvents.join(", ")}`,
        400
      );
    }

    // Check webhook limit (max 5 webhooks per user)
    const existingCount = await prisma.webhook.count({ where: { userId } });
    if (existingCount >= 5) {
      return agentErrorResponse("Maximum 5 webhooks allowed per account", 400);
    }

    // Generate webhook secret
    const plaintextSecret = generateWebhookSecret();
    // SECURITY: Encrypt secret before storing in database
    const encryptedSecret = encrypt(plaintextSecret);

    // Create webhook
    const webhook = await prisma.webhook.create({
      data: {
        userId,
        name: name.trim(),
        url: url.trim(),
        secret: encryptedSecret,
        events: requestedEvents,
      },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Return with plaintext secret (only shown on creation)
    return agentSuccessResponse({
      webhook: {
        ...webhook,
        secret: plaintextSecret, // Only returned on creation, never stored in plaintext
      },
      message: "Webhook created. Save the secret for signature verification.",
    }, 201);
  } catch (error) {
    console.error("Error creating webhook:", error);
    return agentErrorResponse("Failed to create webhook", 500);
  }
}

// DELETE /api/agent/webhooks?id=xxx - Delete a webhook
export async function DELETE(request: NextRequest) {
  try {
    let userId: string | undefined;

    const token = await getAuthToken(request);
    if (token?.id) {
      userId = token.id as string;
    } else {
      const agentAuth = await authenticateAgent(request);
      if (agentAuth.success && hasPermission(agentAuth, ApiKeyPermission.ADMIN)) {
        userId = agentAuth.userId;
      }
    }

    if (!userId) {
      return agentErrorResponse("Unauthorized", 401);
    }

    // SECURITY: Rate limit
    const rateLimitResult = await (withRateLimitAsync('write', 'agent-webhooks'))(request);
    if (!rateLimitResult.success) {
      return agentErrorResponse(rateLimitResult.error || "Rate limit exceeded", 429);
    }

    const { searchParams } = new URL(request.url);
    const webhookId = searchParams.get("id");

    if (!webhookId) {
      return agentErrorResponse("Webhook ID is required", 400);
    }

    // Find and verify ownership
    const webhook = await prisma.webhook.findUnique({
      where: { id: webhookId },
    });

    if (!webhook) {
      return agentErrorResponse("Webhook not found", 404);
    }

    if (webhook.userId !== userId) {
      return agentErrorResponse("Not authorized to delete this webhook", 403);
    }

    // Delete the webhook
    await prisma.webhook.delete({
      where: { id: webhookId },
    });

    return agentSuccessResponse({ message: "Webhook deleted" });
  } catch (error) {
    console.error("Error deleting webhook:", error);
    return agentErrorResponse("Failed to delete webhook", 500);
  }
}

// PATCH /api/agent/webhooks - Update a webhook
export async function PATCH(request: NextRequest) {
  try {
    let userId: string | undefined;

    const token = await getAuthToken(request);
    if (token?.id) {
      userId = token.id as string;
    } else {
      const agentAuth = await authenticateAgent(request);
      if (agentAuth.success && hasPermission(agentAuth, ApiKeyPermission.ADMIN)) {
        userId = agentAuth.userId;
      }
    }

    if (!userId) {
      return agentErrorResponse("Unauthorized", 401);
    }

    // SECURITY: Rate limit
    const rateLimitResult = await (withRateLimitAsync('write', 'agent-webhooks'))(request);
    if (!rateLimitResult.success) {
      return agentErrorResponse(rateLimitResult.error || "Rate limit exceeded", 429);
    }

    const body = await request.json();
    const { id, name, url, events, isActive } = body;

    if (!id) {
      return agentErrorResponse("Webhook ID is required", 400);
    }

    // Find and verify ownership
    const webhook = await prisma.webhook.findUnique({
      where: { id },
    });

    if (!webhook) {
      return agentErrorResponse("Webhook not found", 404);
    }

    if (webhook.userId !== userId) {
      return agentErrorResponse("Not authorized to update this webhook", 403);
    }

    // Build update data
    const updateData: any = {};

    if (name !== undefined) {
      updateData.name = name.trim();
    }

    if (url !== undefined) {
      try {
        const parsedUrl = new URL(url);
        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          throw new Error("Invalid protocol");
        }
        // SECURITY: SSRF check on URL update too
        const ssrfError = checkSsrfUrl(parsedUrl.hostname);
        if (ssrfError) {
          return agentErrorResponse(ssrfError, 400);
        }
        updateData.url = url.trim();
      } catch {
        return agentErrorResponse("Invalid URL format", 400);
      }
    }

    if (events !== undefined) {
      const validEvents = Object.values(WebhookEventType);
      const requestedEvents = events.filter((e: string) =>
        validEvents.includes(e as WebhookEventType)
      );
      if (requestedEvents.length === 0) {
        return agentErrorResponse("At least one valid event is required", 400);
      }
      updateData.events = requestedEvents;
    }

    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }

    const updated = await prisma.webhook.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        isActive: true,
        totalDeliveries: true,
        successfulDeliveries: true,
        failedDeliveries: true,
        lastDeliveryAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return agentSuccessResponse({ webhook: updated });
  } catch (error) {
    console.error("Error updating webhook:", error);
    return agentErrorResponse("Failed to update webhook", 500);
  }
}
