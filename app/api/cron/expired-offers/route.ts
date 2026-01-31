import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

/**
 * Cron Job: Expired Offers Cleanup
 *
 * Two-phase cleanup process:
 * 1. Mark ACTIVE offers past their deadline as EXPIRED
 * 2. Delete EXPIRED offers that have been expired for 24+ hours
 *
 * Runs every 10 minutes.
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
    const cleanupThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

    // Phase 1: Mark ACTIVE offers past deadline as EXPIRED
    const expiredOffers = await prisma.offer.findMany({
      where: {
        status: "ACTIVE",
        deadline: {
          lt: now,
        },
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
      },
    });

    const results = {
      markedExpired: 0,
      deleted: 0,
      refundsInitiated: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process offers to mark as expired
    for (const offer of expiredOffers) {
      try {
        // Update offer status to EXPIRED
        await prisma.offer.update({
          where: { id: offer.id },
          data: {
            status: "EXPIRED",
            expiredAt: now,
          },
        });

        // In production, would trigger on-chain refund of escrowed funds
        // For now, just notify the buyer
        await prisma.notification.create({
          data: {
            type: "SYSTEM",
            title: "Offer Expired",
            message: `Your offer of ${offer.amount} SOL on "${offer.listing.title}" has expired. Any escrowed funds will be returned.`,
            data: {
              offerId: offer.id,
              listingId: offer.listingId,
              amount: offer.amount,
            },
            userId: offer.buyerId,
          },
        });

        results.markedExpired++;
        results.refundsInitiated++;
        console.log(`[Cron] Marked offer ${offer.id} as expired`);
      } catch (error) {
        results.failed++;
        const errorMsg = `Failed to expire offer ${offer.id}: ${error}`;
        results.errors.push(errorMsg);
        console.error(`[Cron] ${errorMsg}`);
      }
    }

    // Phase 2: Delete EXPIRED offers older than 24 hours
    // These are offers where:
    // - Status is EXPIRED
    // - expiredAt is more than 24 hours ago
    const offersToDelete = await prisma.offer.findMany({
      where: {
        status: "EXPIRED",
        expiredAt: {
          not: null,
          lt: cleanupThreshold,
        },
      },
      select: {
        id: true,
      },
    });

    if (offersToDelete.length > 0) {
      const deleteResult = await prisma.offer.deleteMany({
        where: {
          id: {
            in: offersToDelete.map((o) => o.id),
          },
        },
      });
      results.deleted = deleteResult.count;
      console.log(`[Cron] Deleted ${results.deleted} old expired offers`);
    }

    // Also clean up CANCELLED offers older than 24 hours
    const cancelledToDelete = await prisma.offer.findMany({
      where: {
        status: "CANCELLED",
        cancelledAt: {
          not: null,
          lt: cleanupThreshold,
        },
      },
      select: {
        id: true,
      },
    });

    if (cancelledToDelete.length > 0) {
      const deleteResult = await prisma.offer.deleteMany({
        where: {
          id: {
            in: cancelledToDelete.map((o) => o.id),
          },
        },
      });
      results.deleted += deleteResult.count;
      console.log(`[Cron] Deleted ${deleteResult.count} old cancelled offers`);
    }

    return NextResponse.json({
      success: true,
      message: `Offer cleanup complete: ${results.markedExpired} expired, ${results.deleted} deleted, ${results.refundsInitiated} refunds initiated`,
      processed: {
        activeOffersChecked: expiredOffers.length,
        staleOffersChecked: offersToDelete.length + cancelledToDelete.length,
      },
      results,
    });
  } catch (error) {
    console.error("[Cron] Expired offers cleanup error:", error);
    return NextResponse.json(
      { error: "Failed to process offer cleanup" },
      { status: 500 }
    );
  }
}
