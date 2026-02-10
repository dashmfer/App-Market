import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { signWebhookPayload } from "@/lib/agent-auth";
import { decrypt, looksEncrypted } from "@/lib/encryption";
import { verifyCronSecret } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

/**
 * Cron job to retry failed webhook deliveries
 * Runs every 5 minutes
 */
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // SECURITY: Overall cron timeout to prevent webhook retry DOS
    const CRON_TIMEOUT_MS = 55000; // 55 seconds (Vercel cron max is 60s)
    const cronStart = Date.now();

    // Find deliveries ready for retry
    const pendingRetries = await prisma.webhookDelivery.findMany({
      where: {
        status: "RETRYING",
        nextRetryAt: { lte: new Date() },
        attempts: { lt: 3 }, // maxAttempts
      },
      include: {
        webhook: {
          select: { url: true, secret: true, isActive: true },
        },
      },
      take: 50, // Process in batches
    });

    let retried = 0;
    for (const delivery of pendingRetries) {
      // SECURITY: Check overall timeout to prevent runaway cron
      if (Date.now() - cronStart > CRON_TIMEOUT_MS) {
        console.warn(`[Webhook Retry Cron] Timeout after ${retried} retries, stopping`);
        break;
      }
      if (!delivery.webhook.isActive) {
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: { status: "FAILED", errorMessage: "Webhook deactivated" },
        });
        continue;
      }

      try {
        // Decrypt secret (handles both encrypted and legacy plaintext secrets)
        const secret = looksEncrypted(delivery.webhook.secret)
          ? decrypt(delivery.webhook.secret)
          : delivery.webhook.secret;

        const payloadString = JSON.stringify(delivery.payload);
        const signature = signWebhookPayload(payloadString, secret);

        const response = await fetch(delivery.webhook.url, {
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

        if (response.ok) {
          await prisma.webhookDelivery.update({
            where: { id: delivery.id },
            data: {
              status: "SUCCESS",
              responseStatus: response.status,
              deliveredAt: new Date(),
              attempts: delivery.attempts + 1,
            },
          });
        } else {
          const newAttempts = delivery.attempts + 1;
          const maxAttempts = delivery.maxAttempts || 3;
          await prisma.webhookDelivery.update({
            where: { id: delivery.id },
            data: {
              status: newAttempts >= maxAttempts ? "FAILED" : "RETRYING",
              responseStatus: response.status,
              attempts: newAttempts,
              nextRetryAt: newAttempts < maxAttempts
                ? new Date(Date.now() + Math.pow(2, newAttempts) * 1000)
                : null,
              errorMessage: `HTTP ${response.status}`,
            },
          });
        }
        retried++;
      } catch (error: any) {
        const newAttempts = delivery.attempts + 1;
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: newAttempts >= 3 ? "FAILED" : "RETRYING",
            attempts: newAttempts,
            errorMessage: error.message || "Delivery failed",
          },
        });
      }
    }

    return NextResponse.json({ success: true, retried, total: pendingRetries.length });
  } catch (error) {
    console.error("[Webhook Retry Cron] Error:", error);
    return NextResponse.json({ error: "Failed to process retries" }, { status: 500 });
  }
}
