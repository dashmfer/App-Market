import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyCronSecret, acquireCronLock } from "@/lib/cron-auth";

/**
 * Cron Job: Super Badge Qualification
 *
 * Evaluates users for Super Seller and Super Buyer status based on criteria:
 *
 * Super Seller:
 * - At least 5 completed sales
 * - Rating of 4.5 or higher (with at least 3 reviews)
 * - Total volume of $5,000 SOL equivalent or more
 * - No disputes lost in the past 90 days
 *
 * Super Buyer:
 * - At least 5 completed purchases
 * - No disputes initiated that were resolved against them
 * - Account older than 30 days
 *
 * Runs daily.
 */

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// Qualification thresholds
const SUPER_SELLER_MIN_SALES = 5;
const SUPER_SELLER_MIN_RATING = 4.5;
const SUPER_SELLER_MIN_REVIEWS = 3;
const SUPER_SELLER_MIN_VOLUME = 5000; // in base currency units
const SUPER_BUYER_MIN_PURCHASES = 5;
const SUPER_BUYER_MIN_ACCOUNT_AGE_DAYS = 30;

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
  const unlock = await acquireCronLock("super-badge-qualification");
  if (!unlock) {
    return NextResponse.json({ message: "Already running" }, { status: 200 });
  }

  console.log("[Cron] Starting super badge qualification check...");

  const results = {
    newSuperSellers: 0,
    newSuperBuyers: 0,
    revokedSuperSellers: 0,
    revokedSuperBuyers: 0,
    errors: [] as string[],
  };

  try {
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // ============================================
    // SUPER SELLER QUALIFICATION
    // ============================================

    // Find users who qualify for Super Seller but don't have it yet
    const potentialSuperSellers = await withRetry(
      async () => prisma.user.findMany({
        where: {
          isSuperSeller: false,
          totalSales: { gte: SUPER_SELLER_MIN_SALES },
          rating: { gte: SUPER_SELLER_MIN_RATING },
          ratingCount: { gte: SUPER_SELLER_MIN_REVIEWS },
          totalVolume: { gte: SUPER_SELLER_MIN_VOLUME },
        },
        select: {
          id: true,
          username: true,
          totalSales: true,
          rating: true,
          totalVolume: true,
        },
      }),
      "Fetch potential super sellers"
    );

    // Check for disputes lost in past 90 days
    for (const user of potentialSuperSellers) {
      try {
        const recentDisputesLost = await withRetry(
          async () => prisma.dispute.count({
            where: {
              respondentId: user.id,
              status: "RESOLVED",
              resolution: { in: ["FULL_REFUND", "PARTIAL_REFUND"] },
              resolvedAt: { gte: ninetyDaysAgo },
            },
          }),
          `Check disputes for user ${user.id}`
        );

        if ((recentDisputesLost as number) === 0) {
          // Qualify as Super Seller
          await withRetry(
            () => prisma.user.update({
              where: { id: user.id },
              data: {
                isSuperSeller: true,
                superSellerAt: now,
              },
            }),
            `Grant super seller to ${user.id}`
          );

          // Send notification
          await prisma.notification.create({
            data: {
              userId: user.id,
              type: "SYSTEM",
              title: "Congratulations! You're now a Super Seller!",
              message: "You've achieved Super Seller status based on your excellent sales record, high ratings, and trusted history. This badge will be displayed on all your listings.",
              data: { badgeType: "superSeller" },
            },
          });

          results.newSuperSellers++;
          console.log(`[Cron] Granted Super Seller badge`);
        }
      } catch (error) {
        results.errors.push(`Failed to process super seller for ${user.id}: ${error}`);
      }
    }

    // Check if any existing Super Sellers should lose status
    const existingSuperSellers = await withRetry(
      async () => prisma.user.findMany({
        where: {
          isSuperSeller: true,
        },
        select: {
          id: true,
          username: true,
          rating: true,
          ratingCount: true,
        },
      }),
      "Fetch existing super sellers"
    );

    for (const user of existingSuperSellers) {
      try {
        // Check for recent lost disputes
        const recentDisputesLost = await withRetry(
          async () => prisma.dispute.count({
            where: {
              respondentId: user.id,
              status: "RESOLVED",
              resolution: { in: ["FULL_REFUND", "PARTIAL_REFUND"] },
              resolvedAt: { gte: ninetyDaysAgo },
            },
          }),
          `Check disputes for super seller ${user.id}`
        );

        // Revoke if rating dropped below threshold or lost disputes
        const shouldRevoke = (recentDisputesLost as number) > 0 ||
          (user.ratingCount >= SUPER_SELLER_MIN_REVIEWS && Number(user.rating) < SUPER_SELLER_MIN_RATING);

        if (shouldRevoke) {
          await withRetry(
            () => prisma.user.update({
              where: { id: user.id },
              data: {
                isSuperSeller: false,
                superSellerAt: null,
              },
            }),
            `Revoke super seller from ${user.id}`
          );

          await prisma.notification.create({
            data: {
              userId: user.id,
              type: "SYSTEM",
              title: "Super Seller Status Update",
              message: "Your Super Seller status has been temporarily removed. Continue providing excellent service to regain it.",
              data: { badgeType: "superSeller", action: "revoked" },
            },
          });

          results.revokedSuperSellers++;
          console.log(`[Cron] Revoked Super Seller badge`);
        }
      } catch (error) {
        results.errors.push(`Failed to check super seller status for ${user.id}: ${error}`);
      }
    }

    // ============================================
    // SUPER BUYER QUALIFICATION
    // ============================================

    // Find users who qualify for Super Buyer but don't have it yet
    const potentialSuperBuyers = await withRetry(
      async () => prisma.user.findMany({
        where: {
          isSuperBuyer: false,
          totalPurchases: { gte: SUPER_BUYER_MIN_PURCHASES },
          createdAt: { lte: thirtyDaysAgo },
        },
        select: {
          id: true,
          username: true,
          totalPurchases: true,
        },
      }),
      "Fetch potential super buyers"
    );

    for (const user of potentialSuperBuyers) {
      try {
        // Check for disputes initiated by buyer that were resolved against them
        const disputesLostAsBuyer = await withRetry(
          () => prisma.dispute.count({
            where: {
              initiatorId: user.id,
              status: "RESOLVED",
              resolution: "RELEASE_TO_SELLER",
            },
          }),
          `Check buyer disputes for ${user.id}`
        );

        if (disputesLostAsBuyer === 0) {
          // Qualify as Super Buyer
          await withRetry(
            () => prisma.user.update({
              where: { id: user.id },
              data: {
                isSuperBuyer: true,
                superBuyerAt: now,
              },
            }),
            `Grant super buyer to ${user.id}`
          );

          await prisma.notification.create({
            data: {
              userId: user.id,
              type: "SYSTEM",
              title: "Congratulations! You're now a Super Buyer!",
              message: "You've achieved Super Buyer status based on your excellent purchase history. Sellers will see this badge and trust your transactions.",
              data: { badgeType: "superBuyer" },
            },
          });

          results.newSuperBuyers++;
          console.log(`[Cron] Granted Super Buyer badge`);
        }
      } catch (error) {
        results.errors.push(`Failed to process super buyer for ${user.id}: ${error}`);
      }
    }

    // Check existing Super Buyers for revocation
    const existingSuperBuyers = await withRetry(
      async () => prisma.user.findMany({
        where: {
          isSuperBuyer: true,
        },
        select: {
          id: true,
          username: true,
        },
      }),
      "Fetch existing super buyers"
    );

    for (const user of existingSuperBuyers) {
      try {
        // Check for recent disputes lost as buyer
        const recentDisputesLost = await withRetry(
          async () => prisma.dispute.count({
            where: {
              initiatorId: user.id,
              status: "RESOLVED",
              resolution: "RELEASE_TO_SELLER",
              resolvedAt: { gte: ninetyDaysAgo },
            },
          }),
          `Check recent disputes for super buyer ${user.id}`
        );

        if ((recentDisputesLost as number) > 0) {
          await withRetry(
            () => prisma.user.update({
              where: { id: user.id },
              data: {
                isSuperBuyer: false,
                superBuyerAt: null,
              },
            }),
            `Revoke super buyer from ${user.id}`
          );

          await prisma.notification.create({
            data: {
              userId: user.id,
              type: "SYSTEM",
              title: "Super Buyer Status Update",
              message: "Your Super Buyer status has been temporarily removed. Continue making trusted purchases to regain it.",
              data: { badgeType: "superBuyer", action: "revoked" },
            },
          });

          results.revokedSuperBuyers++;
          console.log(`[Cron] Revoked Super Buyer badge`);
        }
      } catch (error) {
        results.errors.push(`Failed to check super buyer status for ${user.id}: ${error}`);
      }
    }

    console.log("[Cron] Super badge qualification completed:", results);

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error("[Cron] Super badge qualification failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Super badge qualification failed",
        details: error instanceof Error ? error.message : String(error),
        partialResults: results,
      },
      { status: 500 }
    );
  } finally {
    await unlock();
  }
}
