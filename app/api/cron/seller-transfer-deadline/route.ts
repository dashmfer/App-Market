import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

/**
 * Cron Job: Seller Transfer Deadline Enforcement
 *
 * Automatically refunds buyer if seller doesn't start the transfer
 * within the deadline (3 days after purchase).
 *
 * This protects buyers from sellers who take payment but never deliver.
 *
 * Runs every hour to check for expired seller deadlines.
 */

const SELLER_TRANSFER_DEADLINE_DAYS = 3; // Seller must start transfer within 3 days
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

  try {
    const now = new Date();
    const deadlineThreshold = new Date(
      now.getTime() - SELLER_TRANSFER_DEADLINE_DAYS * 24 * 60 * 60 * 1000
    );

    // Find transactions where:
    // 1. Status indicates payment received but transfer not started
    // 2. Seller hasn't started transfer (transferStartedAt is null)
    // 3. Transaction was created more than X days ago
    // 4. No dispute has been opened
    const expiredTransactions = await withRetry(
      async () => prisma.transaction.findMany({
        where: {
          status: {
            in: ["PAID", "IN_ESCROW", "TRANSFER_PENDING", "FUNDED"],
          },
          transferStartedAt: null,
          paidAt: {
            not: null,
            lt: deadlineThreshold,
          },
          dispute: null,
        },
        include: {
          listing: {
            select: {
              id: true,
              title: true,
              slug: true,
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
      }),
      "Find expired transactions"
    );

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
      errors: [] as string[],
    };

    for (const transaction of expiredTransactions) {
      try {
        // Update transaction to REFUNDED status
        await withRetry(
          () => prisma.transaction.update({
            where: { id: transaction.id },
            data: {
              status: "REFUNDED",
              refundedAt: now,
              refundReason: "Seller did not start transfer within deadline",
            },
          }),
          `Update transaction ${transaction.id}`
        );

        // Restore listing to active status
        await withRetry(
          () => prisma.listing.update({
            where: { id: transaction.listingId },
            data: {
              status: "ACTIVE",
              reservedBuyerId: null,
              reservedBuyerWallet: null,
              reservedAt: null,
            },
          }),
          `Restore listing ${transaction.listingId}`
        );

        // Notify buyer of refund
        await withRetry(
          () => prisma.notification.create({
            data: {
              type: "REFUND_PROCESSED",
              title: "Refund Issued - Seller Did Not Transfer",
              message: `The seller did not start the transfer for "${transaction.listing.title}" within ${SELLER_TRANSFER_DEADLINE_DAYS} days. Your payment has been refunded.`,
              data: {
                transactionId: transaction.id,
                listingSlug: transaction.listing.slug,
                refundAmount: transaction.salePrice,
                reason: "seller_transfer_deadline_expired",
              },
              userId: transaction.buyerId,
            },
          }),
          `Notify buyer ${transaction.buyerId}`
        );

        // Notify seller of cancellation
        await withRetry(
          () => prisma.notification.create({
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
          `Notify seller ${transaction.sellerId}`
        );

        results.refunded++;
        console.log(`[Cron] Refunded transaction ${transaction.id} - seller transfer deadline expired`);
      } catch (error) {
        results.failed++;
        const errorMsg = `Failed to process transaction ${transaction.id}: ${error}`;
        results.errors.push(errorMsg);
        console.error(`[Cron] ${errorMsg}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Seller deadline check complete: ${results.refunded} refunded, ${results.failed} failed`,
      processed: expiredTransactions.length,
      results,
    });
  } catch (error) {
    console.error("[Cron] Seller transfer deadline error:", error);
    return NextResponse.json(
      { error: "Failed to process seller transfer deadlines" },
      { status: 500 }
    );
  }
}
