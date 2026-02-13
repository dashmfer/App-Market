import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { PLATFORM_CONFIG } from "@/lib/config";
import { verifyCronSecret } from "@/lib/cron-auth";
import {
  withRetry,
  getBackendAuthority,
  getSolanaConnection,
  executeOnChainRelease,
} from "@/lib/cron-helpers";

/**
 * Cron Job: Escrow Auto-Release
 *
 * Automatically releases funds to seller if buyer doesn't confirm receipt
 * or open a dispute within the transfer deadline (7 days by default).
 *
 * Security:
 * - Executes on-chain escrow release before updating DB
 * - Uses idempotent atomic status transition (updateMany WHERE status IN [...])
 * - Wraps all DB mutations in a $transaction for consistency
 *
 * Runs every hour to check for expired transfer deadlines.
 */

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!PLATFORM_CONFIG.escrow.autoReleaseEnabled) {
    return NextResponse.json({
      success: true,
      message: "Auto-release is disabled",
      processed: 0,
    });
  }

  try {
    const now = new Date();
    const deadlineDays = PLATFORM_CONFIG.escrow.transferDeadlineDays;

    const authority = getBackendAuthority();
    const connection = authority ? getSolanaConnection() : null;

    const eligibleTransactions = await withRetry(
      async () =>
        prisma.transaction.findMany({
          where: {
            status: {
              in: ["TRANSFER_IN_PROGRESS", "AWAITING_CONFIRMATION"],
            },
            transferStartedAt: {
              not: null,
              lt: new Date(
                now.getTime() - deadlineDays * 24 * 60 * 60 * 1000
              ),
            },
            dispute: null,
          },
          include: {
            listing: {
              select: {
                title: true,
                onChainId: true,
              },
            },
            buyer: {
              select: { id: true, username: true, walletAddress: true },
            },
            seller: {
              select: { id: true, username: true, walletAddress: true },
            },
          },
          take: 100,
          orderBy: { transferStartedAt: "asc" },
        }),
      "Find eligible transactions"
    );

    if (eligibleTransactions.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No transactions eligible for auto-release",
        processed: 0,
      });
    }

    const results = {
      released: 0,
      failed: 0,
      onChainSuccess: 0,
      onChainSkipped: 0,
      errors: [] as string[],
    };

    for (const transaction of eligibleTransactions) {
      try {
        // IDEMPOTENCY: Atomically claim this transaction — only succeeds if status is still eligible
        const claimed = await prisma.transaction.updateMany({
          where: {
            id: transaction.id,
            status: { in: ["TRANSFER_IN_PROGRESS", "AWAITING_CONFIRMATION"] },
          },
          data: { status: "COMPLETING" as any },
        });

        if (claimed.count === 0) {
          continue; // Already processed by another cron instance
        }

        // Execute on-chain escrow release if we have the authority and listing has on-chain data
        let onChainTxSig: string | null = null;
        if (
          authority &&
          connection &&
          transaction.listing.onChainId &&
          transaction.seller.walletAddress &&
          transaction.buyer.walletAddress
        ) {
          onChainTxSig = await executeOnChainRelease(
            connection,
            authority,
            transaction.listing.onChainId,
            transaction.seller.walletAddress,
            transaction.buyer.walletAddress
          );

          if (onChainTxSig) {
            results.onChainSuccess++;
          } else {
            // On-chain release failed — revert the status claim so it can retry next run
            await prisma.transaction.updateMany({
              where: { id: transaction.id, status: "COMPLETING" as any },
              data: { status: "AWAITING_CONFIRMATION" },
            });
            results.failed++;
            results.errors.push(
              `On-chain release failed for ${transaction.id} — will retry next run`
            );
            continue;
          }
        } else {
          results.onChainSkipped++;
        }

        // Validate salePrice before stats increment
        const salePrice = Number(transaction.salePrice);
        if (isNaN(salePrice) || salePrice <= 0) {
          results.errors.push(
            `Invalid salePrice for transaction ${transaction.id}: ${transaction.salePrice}`
          );
        }

        // Wrap all DB mutations in a transaction for consistency
        await prisma.$transaction([
          prisma.transaction.update({
            where: { id: transaction.id },
            data: {
              status: "COMPLETED",
              transferCompletedAt: now,
              releasedAt: now,
              onChainTx: onChainTxSig || undefined,
            },
          }),
          ...(salePrice > 0
            ? [
                prisma.user.update({
                  where: { id: transaction.sellerId },
                  data: {
                    totalSales: { increment: 1 },
                    totalVolume: { increment: salePrice },
                  },
                }),
              ]
            : []),
          prisma.user.update({
            where: { id: transaction.buyerId },
            data: { totalPurchases: { increment: 1 } },
          }),
          prisma.notification.create({
            data: {
              type: "PAYMENT_RECEIVED",
              title: "Funds Auto-Released",
              message: `The transfer for "${transaction.listing.title}" has been automatically confirmed after the confirmation period expired.${onChainTxSig ? " Funds released on-chain." : ""}`,
              data: {
                transactionId: transaction.id,
                autoRelease: true,
                amount: Number(transaction.sellerProceeds),
                onChainTx: onChainTxSig,
              },
              userId: transaction.sellerId,
            },
          }),
          prisma.notification.create({
            data: {
              type: "TRANSFER_COMPLETED",
              title: "Transfer Confirmed (Auto)",
              message: `The transfer for "${transaction.listing.title}" has been automatically confirmed. Funds have been released to the seller.`,
              data: {
                transactionId: transaction.id,
                autoRelease: true,
                onChainTx: onChainTxSig,
              },
              userId: transaction.buyerId,
            },
          }),
        ]);

        results.released++;
        console.log(
          `[Cron:escrow-auto-release] Released transaction ${transaction.id}${onChainTxSig ? ` (on-chain: ${onChainTxSig})` : ""}`
        );
      } catch (error) {
        results.failed++;
        const errorMsg = `Failed to release transaction ${transaction.id}: ${error}`;
        results.errors.push(errorMsg);
        console.error(`[Cron:escrow-auto-release] ${errorMsg}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Auto-release complete: ${results.released} released, ${results.failed} failed`,
      processed: eligibleTransactions.length,
      results,
    });
  } catch (error) {
    console.error("[Cron:escrow-auto-release] Error:", error);
    return NextResponse.json(
      { error: "Failed to process auto-release" },
      { status: 500 }
    );
  }
}
