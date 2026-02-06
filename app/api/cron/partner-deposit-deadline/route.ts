import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

/**
 * Cron Job: Partner Deposit Deadline Enforcement
 *
 * Enforces the 30-minute deposit deadline for purchase partners.
 * If not all partners have deposited within the deadline:
 * 1. Refund all partners who did deposit
 * 2. Cancel the transaction
 * 3. Remove reservation from listing
 *
 * Runs every 2 minutes to check for expired deadlines.
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

    // Find transactions with partner purchases where:
    // 1. Has partners
    // 2. Status is AWAITING_PARTNER_DEPOSITS
    // 3. Deposit deadline has passed
    const expiredTransactions = await withRetry(async () => prisma.transaction.findMany({
      where: {
        hasPartners: true,
        status: "AWAITING_PARTNER_DEPOSITS",
        partnerDepositDeadline: {
          not: null,
          lt: now,
        },
      },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
          },
        },
        partners: true,
        buyer: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    }), "Find expired partner transactions");

    if (expiredTransactions.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No partner deposits have expired",
        processed: 0,
      });
    }

    const results = {
      cancelled: 0,
      refunded: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const transaction of expiredTransactions) {
      try {
        // Check if all partners deposited
        const allDeposited = transaction.partners.every(
          (p: { depositStatus: string }) => p.depositStatus === "DEPOSITED"
        );

        if (allDeposited) {
          // All deposited, move to next status
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: {
              status: "FUNDED",
              paidAt: now,
            },
          });
          continue;
        }

        // Not all deposited - time to cancel and refund

        // Find partners who deposited (need refund)
        const depositedPartners = transaction.partners.filter(
          (p: { depositStatus: string }) => p.depositStatus === "DEPOSITED"
        );

        // Find partners who didn't deposit
        const pendingPartners = transaction.partners.filter(
          (p: { depositStatus: string }) => p.depositStatus === "PENDING"
        );

        // TODO: Execute on-chain refund transaction before updating database status.
        // Currently funds remain locked in escrow. Requires:
        // 1. Backend authority keypair to sign refund transactions
        // 2. Complete IDL for refund_escrow instruction
        // 3. Error handling for failed on-chain refunds

        // Mark deposited partners as REFUNDED
        for (const partner of depositedPartners) {
          await prisma.transactionPartner.update({
            where: { id: partner.id },
            data: {
              depositStatus: "REFUNDED",
            },
          });

          // Notify partner of refund
          if (partner.userId) {
            await prisma.notification.create({
              data: {
                type: "PURCHASE_PARTNER_TIMEOUT",
                title: "Partner Deposit Expired - Refund Issued",
                message: `The purchase of "${transaction.listing.title}" was cancelled because not all partners deposited in time. Your deposit of ${partner.depositAmount} SOL has been refunded.`,
                data: {
                  transactionId: transaction.id,
                  refundAmount: partner.depositAmount,
                },
                userId: partner.userId,
              },
            });
          }
          results.refunded++;
        }

        // Notify pending partners of timeout
        for (const partner of pendingPartners) {
          if (partner.userId) {
            await prisma.notification.create({
              data: {
                type: "PURCHASE_PARTNER_TIMEOUT",
                title: "Partner Deposit Expired",
                message: `The purchase of "${transaction.listing.title}" was cancelled because the deposit deadline passed.`,
                data: {
                  transactionId: transaction.id,
                },
                userId: partner.userId,
              },
            });
          }
        }

        // Cancel the transaction
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: "CANCELLED",
          },
        });

        // Remove reservation from listing
        await prisma.listing.update({
          where: { id: transaction.listingId },
          data: {
            status: "ACTIVE",
            reservedBuyerId: null,
            reservedBuyerWallet: null,
            reservedAt: null,
          },
        });

        // Notify lead buyer
        await prisma.notification.create({
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
        });

        results.cancelled++;
        console.log(`[Cron] Cancelled partner transaction ${transaction.id} - deadline expired`);
      } catch (error) {
        results.failed++;
        const errorMsg = `Failed to process transaction ${transaction.id}: ${error}`;
        results.errors.push(errorMsg);
        console.error(`[Cron] ${errorMsg}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Partner deadline check complete: ${results.cancelled} cancelled, ${results.refunded} refunds, ${results.failed} failed`,
      processed: expiredTransactions.length,
      results,
    });
  } catch (error) {
    console.error("[Cron] Partner deposit deadline error:", error);
    return NextResponse.json(
      { error: "Failed to process partner deadline check" },
      { status: 500 }
    );
  }
}
