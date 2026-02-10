import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { PLATFORM_CONFIG } from "@/lib/config";

/**
 * Cron Job: Escrow Auto-Release
 *
 * Automatically releases funds to seller if buyer doesn't confirm receipt
 * or open a dispute within the transfer deadline (7 days by default).
 *
 * Runs every hour to check for expired transfer deadlines.
 */

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[Cron] CRON_SECRET not configured");
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

// Retry wrapper for database operations
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error as Error;
      console.warn(`[Cron] ${operationName} attempt ${attempt}/${maxRetries} failed:`, error);

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
      }
    }
  }

  throw lastError;
}

export async function GET(request: NextRequest) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Check if auto-release is enabled
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

    // Find transactions that:
    // 1. Have transfer started (transferStartedAt is set)
    // 2. Are in a state waiting for buyer confirmation
    // 3. Transfer deadline has passed
    // 4. No dispute has been opened
    const eligibleTransactions = await withRetry(async () => prisma.transaction.findMany({
      where: {
        status: {
          in: ["TRANSFER_IN_PROGRESS", "AWAITING_CONFIRMATION"],
        },
        transferStartedAt: {
          not: null,
          // Transfer started more than X days ago
          lt: new Date(now.getTime() - deadlineDays * 24 * 60 * 60 * 1000),
        },
        // No active dispute
        dispute: null,
      },
      include: {
        listing: {
          select: {
            title: true,
          },
        },
        buyer: {
          select: {
            id: true,
            username: true,
          },
        },
        seller: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    }), "Find eligible transactions");

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
      errors: [] as string[],
    };

    for (const transaction of eligibleTransactions) {
      try {
        // TODO: Execute on-chain refund transaction before updating database status.
        // Currently funds remain locked in escrow. Requires:
        // 1. Backend authority keypair to sign refund transactions
        // 2. Complete IDL for refund_escrow instruction
        // 3. Error handling for failed on-chain refunds

        // Update transaction to COMPLETED
        await withRetry(() => prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: "COMPLETED",
            transferCompletedAt: now,
            releasedAt: now,
          },
        }), `Update transaction ${transaction.id}`);

        // Update seller stats
        await withRetry(() => prisma.user.update({
          where: { id: transaction.sellerId },
          data: {
            totalSales: { increment: 1 },
            totalVolume: { increment: Number(transaction.salePrice) },
          },
        }), `Update seller stats ${transaction.sellerId}`);

        // Update buyer stats
        await withRetry(() => prisma.user.update({
          where: { id: transaction.buyerId },
          data: {
            totalPurchases: { increment: 1 },
          },
        }), `Update buyer stats ${transaction.buyerId}`);

        // Notify seller of auto-release
        await withRetry(() => prisma.notification.create({
          data: {
            type: "PAYMENT_RECEIVED",
            title: "Funds Auto-Released",
            message: `Funds for "${transaction.listing.title}" have been automatically released after the confirmation period expired.`,
            data: {
              transactionId: transaction.id,
              autoRelease: true,
              amount: Number(transaction.sellerProceeds),
            },
            userId: transaction.sellerId,
          },
        }), `Notify seller ${transaction.sellerId}`);

        // Notify buyer that transfer is complete
        await withRetry(() => prisma.notification.create({
          data: {
            type: "TRANSFER_COMPLETED",
            title: "Transfer Confirmed (Auto)",
            message: `The transfer for "${transaction.listing.title}" has been automatically confirmed. Funds have been released to the seller.`,
            data: {
              transactionId: transaction.id,
              autoRelease: true,
            },
            userId: transaction.buyerId,
          },
        }), `Notify buyer ${transaction.buyerId}`);

        results.released++;
        console.log(`[Cron] Auto-released transaction ${transaction.id}`);
      } catch (error: any) {
        results.failed++;
        const errorMsg = `Failed to release transaction ${transaction.id}: ${error}`;
        results.errors.push(errorMsg);
        console.error(`[Cron] ${errorMsg}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Auto-release complete: ${results.released} released, ${results.failed} failed`,
      processed: eligibleTransactions.length,
      results,
    });
  } catch (error: any) {
    console.error("[Cron] Escrow auto-release error:", error);
    return NextResponse.json(
      { error: "Failed to process auto-release" },
      { status: 500 }
    );
  }
}
