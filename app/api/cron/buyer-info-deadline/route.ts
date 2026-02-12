import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyCronSecret } from "@/lib/cron-auth";

/**
 * Cron Job: Buyer Info Deadline Enforcement
 *
 * Monitors buyer information submission deadlines (48 hours after purchase).
 * If deadline passes without buyer providing required info:
 * 1. Mark buyerInfoStatus as DEADLINE_PASSED
 * 2. Activate fallback transfer process
 * 3. Notify both parties
 *
 * Runs every 15 minutes.
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

  try {
    const now = new Date();

    // Find transactions where:
    // 1. Buyer info deadline has passed
    // 2. Status is still PENDING
    // 3. Transaction is in a state that requires buyer info
    const expiredTransactions = await prisma.transaction.findMany({
      where: {
        buyerInfoStatus: "PENDING",
        buyerInfoDeadline: {
          not: null,
          lt: now,
        },
        status: {
          in: ["FUNDED", "IN_ESCROW", "TRANSFER_PENDING"],
        },
      },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            slug: true,
            requiredBuyerInfo: true,
          },
        },
        buyer: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        seller: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
      take: 100, // Batch size to prevent OOM on large datasets
      orderBy: { buyerInfoDeadline: "asc" }, // Process oldest first
    });

    if (expiredTransactions.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No buyer info deadlines have expired",
        processed: 0,
      });
    }

    const results = {
      processed: 0,
      fallbackActivated: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const transaction of expiredTransactions) {
      try {
        // Update transaction to mark deadline passed and activate fallback
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            buyerInfoStatus: "DEADLINE_PASSED",
            fallbackTransferUsed: true,
            transferMethods: {
              ...(transaction.transferMethods as object || {}),
              fallbackReason: "Buyer info deadline passed",
              fallbackActivatedAt: now.toISOString(),
            },
          },
        });

        // Notify buyer that deadline passed
        await prisma.notification.create({
          data: {
            type: "BUYER_INFO_DEADLINE",
            title: "Buyer Info Deadline Passed",
            message: `The 48-hour deadline to submit your information for "${transaction.listing.title}" has passed. The seller will use an alternative transfer method.`,
            data: {
              transactionId: transaction.id,
              listingSlug: transaction.listing.slug,
            },
            userId: transaction.buyerId,
          },
        });

        // Notify seller that fallback process is active
        await prisma.notification.create({
          data: {
            type: "FALLBACK_TRANSFER_ACTIVE",
            title: "Fallback Transfer Process Active",
            message: `The buyer did not submit required information for "${transaction.listing.title}" within 48 hours. Please proceed with the fallback transfer process.`,
            data: {
              transactionId: transaction.id,
              listingSlug: transaction.listing.slug,
            },
            userId: transaction.sellerId,
          },
        });

        results.processed++;
        results.fallbackActivated++;
        console.log(`[Cron] Buyer info deadline passed for transaction ${transaction.id}`);
      } catch (error) {
        results.failed++;
        const errorMsg = `Failed to process transaction ${transaction.id}: ${error}`;
        results.errors.push(errorMsg);
        console.error(`[Cron] ${errorMsg}`);
      }
    }

    // Also send reminders for transactions approaching deadline (6 hours remaining)
    const reminderThreshold = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    const upcomingDeadlines = await prisma.transaction.findMany({
      where: {
        buyerInfoStatus: "PENDING",
        buyerInfoDeadline: {
          gt: now,
          lte: reminderThreshold,
        },
        status: {
          in: ["FUNDED", "IN_ESCROW", "TRANSFER_PENDING"],
        },
      },
      include: {
        listing: {
          select: {
            title: true,
            slug: true,
          },
        },
      },
    });

    let remindersSent = 0;
    for (const transaction of upcomingDeadlines) {
      // Check if we already sent a 6-hour reminder
      const existingReminder = await prisma.notification.findFirst({
        where: {
          userId: transaction.buyerId,
          type: "BUYER_INFO_REMINDER",
          data: {
            path: ["transactionId"],
            equals: transaction.id,
          },
          createdAt: {
            gte: new Date(now.getTime() - 7 * 60 * 60 * 1000), // Within last 7 hours
          },
        },
      });

      if (!existingReminder) {
        await prisma.notification.create({
          data: {
            type: "BUYER_INFO_REMINDER",
            title: "Reminder: Submit Your Information",
            message: `You have less than 6 hours to submit required information for "${transaction.listing.title}". After the deadline, the seller will use a fallback transfer method.`,
            data: {
              transactionId: transaction.id,
              listingSlug: transaction.listing.slug,
              hoursRemaining: 6,
            },
            userId: transaction.buyerId,
          },
        });
        remindersSent++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Buyer info deadline check complete: ${results.processed} deadlines enforced, ${remindersSent} reminders sent`,
      processed: expiredTransactions.length,
      remindersSent,
      results,
    });
  } catch (error) {
    console.error("[Cron] Buyer info deadline error:", error);
    return NextResponse.json(
      { error: "Failed to process buyer info deadlines" },
      { status: 500 }
    );
  }
}
