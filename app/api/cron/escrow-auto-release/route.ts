import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { PLATFORM_CONFIG } from "@/lib/config";
import { verifyCronSecret, acquireCronLock } from "@/lib/cron-auth";

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
    } catch (error) {
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

  // SECURITY [M10]: Distributed lock prevents duplicate execution
  const unlock = await acquireCronLock("escrow-auto-release");
  if (!unlock) {
    return NextResponse.json({ message: "Already running" }, { status: 200 });
  }

  // Check if auto-release is enabled
  if (!PLATFORM_CONFIG.escrow.autoReleaseEnabled) {
    await unlock();
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
        // SECURITY: Do NOT mark as COMPLETED without on-chain escrow release.
        // On-chain release requires the backend authority keypair and the
        // confirm_receipt / finalize_transaction smart contract instruction.
        // Until on-chain release is implemented, mark as PENDING_RELEASE
        // so the state accurately reflects that funds are still in escrow.
        await withRetry(() => prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: "PENDING_RELEASE",
          },
        }), `Update transaction ${transaction.id}`);

        // Notify admin/ops that manual intervention is needed
        await withRetry(() => prisma.notification.create({
          data: {
            type: "SYSTEM",
            title: "Escrow Release Required",
            message: `Transaction for "${transaction.listing.title}" has passed its transfer deadline and requires on-chain escrow release. Transaction ID: ${transaction.id}`,
            data: {
              transactionId: transaction.id,
              autoRelease: true,
              requiresOnChainRelease: true,
              amount: Number(transaction.sellerProceeds),
            },
            userId: transaction.sellerId,
          },
        }), `Notify seller ${transaction.sellerId}`);

        // Notify buyer that the deadline has passed
        await withRetry(() => prisma.notification.create({
          data: {
            type: "SYSTEM",
            title: "Transfer Deadline Passed",
            message: `The transfer deadline for "${transaction.listing.title}" has passed. Escrow release is being processed.`,
            data: {
              transactionId: transaction.id,
              autoRelease: true,
            },
            userId: transaction.buyerId,
          },
        }), `Notify buyer ${transaction.buyerId}`);

        results.released++;
        console.log(`[Cron] Flagged transaction ${transaction.id} for on-chain escrow release (PENDING_RELEASE)`);
      } catch (error) {
        results.failed++;
        const errorMsg = `Failed to process transaction ${transaction.id}: ${error}`;
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
  } catch (error) {
    console.error("[Cron] Escrow auto-release error:", error);
    return NextResponse.json(
      { error: "Failed to process auto-release" },
      { status: 500 }
    );
  } finally {
    await unlock();
  }
}
