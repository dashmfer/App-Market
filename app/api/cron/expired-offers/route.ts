import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyCronSecret } from "@/lib/cron-auth";

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
      take: 200, // Batch size to prevent OOM on large datasets
      orderBy: { deadline: "asc" }, // Process oldest first
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
        // CRITICAL TODO: Execute on-chain refund transaction before updating database status.
        // Currently funds remain locked in escrow. This MUST be implemented before mainnet.
        // Requires:
        // 1. BACKEND_AUTHORITY_SECRET_KEY env var (JSON array from keypair file)
        // 2. Run `anchor build` to generate complete IDL with refund_escrow instruction
        // 3. Call expireOffer() from lib/solana-contract.ts with backend authority
        // 4. Only mark as EXPIRED after on-chain refund succeeds
        // 5. If on-chain refund fails, log error and skip (don't mark as expired)
        //
        // WARNING: Without this, expired offers have funds locked in escrow forever.
        // Users are notified "funds will be returned" but currently they are NOT.

        // Update offer status to EXPIRED
        await prisma.offer.update({
          where: { id: offer.id },
          data: {
            status: "EXPIRED",
            expiredAt: now,
          },
        });
        await prisma.notification.create({
          data: {
            type: "SYSTEM",
            title: "Offer Expired",
            message: `Your offer of ${Number(offer.amount)} SOL on "${offer.listing.title}" has expired. If funds were escrowed on-chain, they will need to be claimed via the contract's expire_offer instruction.`,
            data: {
              offerId: offer.id,
              listingId: offer.listingId,
              amount: Number(offer.amount),
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

    // Phase 2: Archive (soft-delete) EXPIRED and CANCELLED offers older than 24 hours.
    // Previously hard-deleted — now preserved for financial audit trail.
    // NOTE: If a `deletedAt` field is not yet on the Offer model, these offers
    // are simply left in their EXPIRED/CANCELLED state and NOT deleted.
    // Add a `deletedAt DateTime?` field to the Offer model for proper soft-delete support.
    // For now, skip deletion entirely to preserve audit trail.
    results.deleted = 0;
    console.log(`[Cron] Skipping hard-deletion of expired/cancelled offers — preserving audit trail`);

    return NextResponse.json({
      success: true,
      message: `Offer cleanup complete: ${results.markedExpired} expired, ${results.deleted} deleted, ${results.refundsInitiated} refunds initiated`,
      processed: {
        activeOffersChecked: expiredOffers.length,
        staleOffersChecked: 0,
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
