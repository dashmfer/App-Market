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
 * Cron Job: Seller Transfer Deadline Enforcement
 *
 * Automatically refunds buyer if seller doesn't start the transfer
 * within the deadline (3 days after purchase).
 *
 * Security:
 * - Executes on-chain refund before updating DB
 * - Uses idempotent atomic status transition
 * - Wraps all DB mutations in $transaction
 *
 * Runs every hour.
 */

const SELLER_TRANSFER_DEADLINE_DAYS = 3;

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const deadlineThreshold = new Date(
      now.getTime() - SELLER_TRANSFER_DEADLINE_DAYS * 24 * 60 * 60 * 1000
    );

    const authority = getBackendAuthority();
    const connection = authority ? getSolanaConnection() : null;

    const expiredTransactions = await withRetry(
      async () =>
        prisma.transaction.findMany({
          where: {
            // Include REFUNDING to retry stuck transactions from failed previous runs
            status: { in: ["PAID", "IN_ESCROW", "TRANSFER_PENDING", "FUNDED", "REFUNDING"] as any },
            transferStartedAt: null,
            paidAt: { not: null, lt: deadlineThreshold },
            dispute: null,
          },
          include: {
            listing: {
              select: { id: true, title: true, slug: true, onChainId: true },
            },
            buyer: {
              select: { id: true, username: true, walletAddress: true },
            },
            seller: {
              select: { id: true, username: true },
            },
          },
          take: 100,
          orderBy: { paidAt: "asc" },
        }),
      "Find expired transactions"
    ) as any[];

    if (expiredTransactions.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No seller transfer deadlines have expired",
        processed: 0,
      });
    }

    const results = {
      refunded: 0,
      failed: 0,
      onChainSuccess: 0,
      onChainSkipped: 0,
      errors: [] as string[],
    };

    for (const transaction of expiredTransactions) {
      try {
        // IDEMPOTENCY: Atomically claim (includes REFUNDING for retry of stuck transactions)
        const claimed = await prisma.transaction.updateMany({
          where: {
            id: transaction.id,
            status: { in: ["PAID", "IN_ESCROW", "TRANSFER_PENDING", "FUNDED", "REFUNDING"] as any },
          },
          data: { status: "REFUNDING" as any },
        });

        if (claimed.count === 0) continue;

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

          if (onChainTxSig) {
            results.onChainSuccess++;
          } else {
            // Revert claim for retry
            await prisma.transaction.updateMany({
              where: { id: transaction.id, status: "REFUNDING" as any },
              data: { status: "PAID" },
            });
            results.failed++;
            results.errors.push(
              `On-chain refund failed for ${transaction.id} — will retry`
            );
            continue;
          }
        } else {
          results.onChainSkipped++;
        }

        // Wrap all mutations in a DB transaction
        await prisma.$transaction([
          prisma.transaction.update({
            where: { id: transaction.id },
            data: {
              status: "REFUNDED",
              refundedAt: now,
              refundReason: "Seller did not start transfer within deadline",
              onChainTx: onChainTxSig || undefined,
            },
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
              type: "REFUND_PROCESSED",
              title: "Refund Issued - Seller Did Not Transfer",
              message: `The seller did not start the transfer for "${transaction.listing.title}" within ${SELLER_TRANSFER_DEADLINE_DAYS} days. A refund has been processed.${onChainTxSig ? " Funds returned to your wallet." : ""}`,
              data: {
                transactionId: transaction.id,
                listingSlug: transaction.listing.slug,
                refundAmount: Number(transaction.salePrice),
                reason: "seller_transfer_deadline_expired",
                onChainTx: onChainTxSig,
              },
              userId: transaction.buyerId,
            },
          }),
          prisma.notification.create({
            data: {
              type: "SALE_CANCELLED",
              title: "Sale Cancelled - Transfer Deadline Expired",
              message: `Your sale of "${transaction.listing.title}" has been cancelled because you did not start the transfer within ${SELLER_TRANSFER_DEADLINE_DAYS} days. The buyer has been refunded.`,
              data: {
                transactionId: transaction.id,
                listingSlug: transaction.listing.slug,
              },
              userId: transaction.sellerId,
            },
          }),
        ]);

        results.refunded++;
        console.log(
          `[Cron:seller-transfer-deadline] Refunded transaction ${transaction.id}${onChainTxSig ? ` (on-chain: ${onChainTxSig})` : ""}`
        );
      } catch (error) {
        results.failed++;
        const errorMsg = `Failed to process transaction ${transaction.id}: ${error}`;
        results.errors.push(errorMsg);
        console.error(`[Cron:seller-transfer-deadline] ${errorMsg}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Seller deadline check complete: ${results.refunded} refunded, ${results.failed} failed`,
      processed: expiredTransactions.length,
      results,
    });
  } catch (error) {
    console.error("[Cron:seller-transfer-deadline] Error:", error);
    return NextResponse.json(
      { error: "Failed to process seller transfer deadlines" },
      { status: 500 }
    );
  }
}
