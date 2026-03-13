import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { audit } from "@/lib/audit";
import { verifyCronSecret, acquireCronLock } from "@/lib/cron-auth";

/**
 * Cron Job: Reconcile Count Fields
 *
 * Recomputes manually-maintained count fields from actual records to fix drift:
 * - User: totalSales, totalPurchases, ratingCount, totalDisputes, disputeCount, disputesWon, disputesLost
 * - Webhook: totalDeliveries, successfulDeliveries, failedDeliveries
 *
 * Should run daily (low frequency) as a safety net.
 */
export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const unlock = await acquireCronLock("reconcile-counts", 600);
  if (!unlock) {
    return NextResponse.json({ message: "Lock held by another instance" }, { status: 200 });
  }

  try {
    let usersFixed = 0;
    let webhooksFixed = 0;

    // Reconcile user stats in batches
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { totalSales: { gt: 0 } },
          { totalPurchases: { gt: 0 } },
          { ratingCount: { gt: 0 } },
          { totalDisputes: { gt: 0 } },
        ],
      },
      select: { id: true, totalSales: true, totalPurchases: true, ratingCount: true, totalDisputes: true, disputeCount: true, disputesWon: true, disputesLost: true },
      take: 500,
    });

    for (const user of users) {
      const [salesCount, purchasesCount, reviewStats, disputeStats] = await Promise.all([
        prisma.transaction.count({ where: { sellerId: user.id, status: "COMPLETED" } }),
        prisma.transaction.count({ where: { buyerId: user.id, status: "COMPLETED" } }),
        prisma.review.aggregate({ where: { subjectId: user.id, isVisible: true }, _count: true }),
        prisma.dispute.count({ where: { OR: [{ initiatorId: user.id }, { respondentId: user.id }] } }),
      ]);

      const [disputesWonCount, disputesLostInit, disputesLostResp] = await Promise.all([
        prisma.dispute.count({
          where: {
            status: "RESOLVED",
            OR: [
              { initiatorId: user.id, resolution: "FULL_REFUND" },
              { respondentId: user.id, resolution: "RELEASE_TO_SELLER" },
            ],
          },
        }),
        prisma.dispute.count({
          where: {
            status: "RESOLVED",
            initiatorId: user.id,
            resolution: "RELEASE_TO_SELLER",
          },
        }),
        prisma.dispute.count({
          where: {
            status: "RESOLVED",
            respondentId: user.id,
            resolution: "FULL_REFUND",
          },
        }),
      ]);

      const disputesLostCount = disputesLostInit + disputesLostResp;

      const needsUpdate =
        user.totalSales !== salesCount ||
        user.totalPurchases !== purchasesCount ||
        user.ratingCount !== reviewStats._count ||
        user.totalDisputes !== disputeStats ||
        user.disputeCount !== disputeStats ||
        user.disputesWon !== disputesWonCount ||
        user.disputesLost !== disputesLostCount;

      if (needsUpdate) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            totalSales: salesCount,
            totalPurchases: purchasesCount,
            ratingCount: reviewStats._count,
            totalDisputes: disputeStats,
            disputeCount: disputeStats,
            disputesWon: disputesWonCount,
            disputesLost: disputesLostCount,
          },
        });
        usersFixed++;
      }
    }

    // Reconcile webhook delivery counts
    const webhooks = await prisma.webhook.findMany({
      select: { id: true, totalDeliveries: true, successfulDeliveries: true, failedDeliveries: true },
      take: 200,
    });

    for (const webhook of webhooks) {
      const [total, success, failed] = await Promise.all([
        prisma.webhookDelivery.count({ where: { webhookId: webhook.id } }),
        prisma.webhookDelivery.count({ where: { webhookId: webhook.id, status: "SUCCESS" } }),
        prisma.webhookDelivery.count({ where: { webhookId: webhook.id, status: "FAILED" } }),
      ]);

      const needsUpdate =
        webhook.totalDeliveries !== total ||
        webhook.successfulDeliveries !== success ||
        webhook.failedDeliveries !== failed;

      if (needsUpdate) {
        await prisma.webhook.update({
          where: { id: webhook.id },
          data: {
            totalDeliveries: total,
            successfulDeliveries: success,
            failedDeliveries: failed,
          },
        });
        webhooksFixed++;
      }
    }

    await audit({
      action: "CRON_EXECUTION",
      severity: "INFO",
      detail: `Count reconciliation: ${usersFixed} users fixed, ${webhooksFixed} webhooks fixed`,
      metadata: { usersFixed, webhooksFixed, usersChecked: users.length, webhooksChecked: webhooks.length },
    });

    return NextResponse.json({
      success: true,
      usersChecked: users.length,
      usersFixed,
      webhooksChecked: webhooks.length,
      webhooksFixed,
    });
  } catch (error) {
    console.error("[Cron] Reconcile counts error:", error);
    return NextResponse.json({ error: "Reconciliation failed" }, { status: 500 });
  } finally {
    await unlock();
  }
}
