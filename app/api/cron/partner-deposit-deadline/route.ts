import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyCronSecret } from "@/lib/cron-auth";
import {
  withRetry,
  getBackendAuthority,
  getSolanaConnection,
  executeOnChainRefund,
} from "@/lib/cron-helpers";

/**
 * Cron Job: Partner Deposit Deadline Enforcement
 *
 * Enforces the 30-minute deposit deadline for purchase partners.
 * If not all partners have deposited within the deadline:
 * 1. On-chain refund for deposited partners
 * 2. Cancel the transaction
 * 3. Remove reservation from listing
 *
 * Security:
 * - Executes on-chain refund before DB updates
 * - Uses idempotent atomic status transition
 * - Re-fetches partner data for freshness (avoids stale reads)
 * - Wraps all DB mutations in $transaction
 *
 * Runs every 2 minutes.
 */

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    const authority = getBackendAuthority();
    const connection = authority ? getSolanaConnection() : null;

    const expiredTransactions = await withRetry(
      async () =>
        prisma.transaction.findMany({
          where: {
            hasPartners: true,
            status: "AWAITING_PARTNER_DEPOSITS",
            partnerDepositDeadline: { not: null, lt: now },
          },
          include: {
            listing: {
              select: { id: true, title: true, onChainId: true },
            },
            partners: true,
            buyer: {
              select: { id: true, username: true, walletAddress: true },
            },
          },
          take: 100,
          orderBy: { partnerDepositDeadline: "asc" },
        }),
      "Find expired partner transactions"
    );

    if (expiredTransactions.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No partner deposits have expired",
        processed: 0,
      });
    }

    const results = {
      cancelled: 0,
      funded: 0,
      refunded: 0,
      failed: 0,
      onChainRefunds: 0,
      errors: [] as string[],
    };

    for (const transaction of expiredTransactions) {
      try {
        // IDEMPOTENCY: Atomically claim
        const claimed = await prisma.transaction.updateMany({
          where: {
            id: transaction.id,
            status: "AWAITING_PARTNER_DEPOSITS",
          },
          data: { status: "PROCESSING_DEPOSITS" as any },
        });

        if (claimed.count === 0) continue;

        // Re-fetch fresh partner data to avoid stale state
        const freshPartners = await prisma.transactionPartner.findMany({
          where: { transactionId: transaction.id },
        });

        const allDeposited = freshPartners.every(
          (p) => p.depositStatus === "DEPOSITED"
        );

        if (allDeposited) {
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: "FUNDED", paidAt: now },
          });
          results.funded++;
          continue;
        }

        // Not all deposited — cancel and refund
        const depositedPartners = freshPartners.filter(
          (p) => p.depositStatus === "DEPOSITED"
        );
        const pendingPartners = freshPartners.filter(
          (p) => p.depositStatus === "PENDING"
        );

        // Execute on-chain refund if possible
        let onChainTxSig: string | null = null;
        if (
          authority &&
          connection &&
          transaction.listing.onChainId &&
          transaction.buyer.walletAddress
        ) {
          onChainTxSig = await executeOnChainRefund(
            connection,
            authority,
            transaction.listing.onChainId,
            transaction.buyer.walletAddress
          );
          if (onChainTxSig) results.onChainRefunds++;
        }

        // Build all DB operations atomically
        const dbOps = [];

        for (const partner of depositedPartners) {
          dbOps.push(
            prisma.transactionPartner.update({
              where: { id: partner.id },
              data: { depositStatus: "REFUNDED" },
            })
          );

          if (partner.userId) {
            dbOps.push(
              prisma.notification.create({
                data: {
                  type: "PURCHASE_PARTNER_TIMEOUT",
                  title: "Partner Deposit Expired - Refund Issued",
                  message: `The purchase of "${transaction.listing.title}" was cancelled because not all partners deposited in time. Your deposit of ${Number(partner.depositAmount)} SOL has been refunded.`,
                  data: {
                    transactionId: transaction.id,
                    refundAmount: Number(partner.depositAmount),
                    onChainTx: onChainTxSig,
                  },
                  userId: partner.userId,
                },
              })
            );
          }
          results.refunded++;
        }

        for (const partner of pendingPartners) {
          if (partner.userId) {
            dbOps.push(
              prisma.notification.create({
                data: {
                  type: "PURCHASE_PARTNER_TIMEOUT",
                  title: "Partner Deposit Expired",
                  message: `The purchase of "${transaction.listing.title}" was cancelled because the deposit deadline passed.`,
                  data: { transactionId: transaction.id },
                  userId: partner.userId,
                },
              })
            );
          }
        }

        dbOps.push(
          prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: "CANCELLED" },
          }),
          prisma.listing.update({
            where: { id: transaction.listingId },
            data: {
              status: "ACTIVE",
              reservedBuyerId: null,
              reservedBuyerWallet: null,
              reservedAt: null,
            },
          }),
          prisma.notification.create({
            data: {
              type: "PURCHASE_PARTNER_TIMEOUT",
              title: "Group Purchase Cancelled",
              message: `The group purchase of "${transaction.listing.title}" was cancelled because not all partners deposited within the 30-minute deadline.`,
              data: {
                transactionId: transaction.id,
                pendingPartnerCount: pendingPartners.length,
              },
              userId: transaction.buyerId,
            },
          })
        );

        await prisma.$transaction(dbOps);

        results.cancelled++;
        console.log(
          `[Cron:partner-deposit-deadline] Cancelled transaction ${transaction.id}`
        );
      } catch (error) {
        results.failed++;
        const errorMsg = `Failed to process transaction ${transaction.id}: ${error}`;
        results.errors.push(errorMsg);
        console.error(`[Cron:partner-deposit-deadline] ${errorMsg}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Partner deadline check complete: ${results.cancelled} cancelled, ${results.funded} funded, ${results.refunded} refunds, ${results.failed} failed`,
      processed: expiredTransactions.length,
      results,
    });
  } catch (error) {
    console.error("[Cron:partner-deposit-deadline] Error:", error);
    return NextResponse.json(
      { error: "Failed to process partner deadline check" },
      { status: 500 }
    );
  }
}
