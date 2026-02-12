import prisma from "@/lib/prisma";
import { PLATFORM_CONFIG } from "@/lib/config";

/**
 * Calculate and record referral earnings when a transaction completes.
 *
 * Referral logic:
 * - Referrers earn 2% of the FIRST transaction only (first sale OR first purchase)
 * - This 2% comes from App Market's 5% platform fee (not additional)
 * - If both buyer AND seller were referred: both referrers get 2% each, platform keeps 1%
 * - If only one was referred: referrer gets 2%, platform keeps 3%
 *
 * @param transactionId - The completed transaction ID
 * @param salePrice - The total sale price
 * @param buyerId - The buyer's user ID
 * @param sellerId - The seller's user ID
 * @param currency - The transaction currency (SOL, USDC, APP)
 * @returns Object with referral earnings details
 */

// SECURITY: Integer-safe referral math — same pattern as lib/solana.ts
function getDecimals(currency?: string): number {
  return currency === "USDC" ? 6 : 9;
}

export async function processReferralEarnings(
  transactionId: string,
  salePrice: number,
  buyerId: string,
  sellerId: string,
  currency?: string
): Promise<{
  buyerReferralEarning: number;
  sellerReferralEarning: number;
  totalReferralPayout: number;
  platformFeeAfterReferrals: number;
}> {
  // SECURITY [C6]: Prevent self-referral — if the buyer's referrer IS the seller
  // (or vice versa), skip that referral payout entirely.
  const commissionRateBps = PLATFORM_CONFIG.referral.commissionRateBps; // 200 = 2%
  const platformFeeBps = PLATFORM_CONFIG.fees.platformFeeBps; // 500 = 5%
  const base = Math.pow(10, getDecimals(currency));
  const salePriceUnits = Math.round(salePrice * base);
  const platformFeeUnits = Math.floor(salePriceUnits * platformFeeBps / 10000);
  const platformFee = platformFeeUnits / base;
  const currencyLabel = currency || "SOL";

  // SECURITY [M3]: Wrap entire referral processing in a Serializable transaction
  // to prevent double-processing of referral payouts under concurrent requests
  const { buyerReferralEarning, sellerReferralEarning } = await prisma.$transaction(async (tx) => {
    let buyerReferralEarning = 0;
    let sellerReferralEarning = 0;

    // Check if buyer was referred AND atomically claim first transaction flag
    const buyerReferral = await tx.referral.findUnique({
      where: { referredUserId: buyerId },
      include: {
        referrer: { select: { id: true, walletAddress: true } },
      },
    });

    if (buyerReferral) {
      // SECURITY [C6]: Block self-referral — referrer must not be the buyer themselves
      // or the counterparty (seller) in this transaction
      if (buyerReferral.referrerId === buyerId || buyerReferral.referrerId === sellerId) {
        if (process.env.NODE_ENV === 'development') console.log(`[Referral] Blocked self/counterparty referral for buyer ${buyerId}`);
      } else {
      // Atomic check-and-set: only claim if firstTransactionPaid is still false
      const claimResult = await tx.referral.updateMany({
        where: {
          id: buyerReferral.id,
          firstTransactionPaid: false, // Atomic: only update if not yet paid
        },
        data: {
          firstTransactionPaid: true,
          status: "ACTIVE",
          convertedAt: new Date(),
        },
      });

      if (claimResult.count > 0) {
        // Successfully claimed - this is buyer's first transaction
        // SECURITY: Integer-safe commission calculation
        const earningUnits = Math.floor(salePriceUnits * commissionRateBps / 10000);
        buyerReferralEarning = earningUnits / base;

        // Create the earning record
        await tx.referralEarning.create({
          data: {
            referralId: buyerReferral.id,
            transactionId,
            saleAmount: salePrice,
            commissionRate: commissionRateBps / 10000,
            earnedAmount: buyerReferralEarning,
            status: "AVAILABLE", // Immediately available since transaction is complete
          },
        });

        // Update the referral total earnings
        await tx.referral.update({
          where: { id: buyerReferral.id },
          data: {
            totalEarnings: { increment: buyerReferralEarning },
          },
        });

        // Update referrer's total earnings
        await tx.user.update({
          where: { id: buyerReferral.referrerId },
          data: {
            referralEarnings: { increment: buyerReferralEarning },
          },
        });

        // Notify the referrer
        await tx.notification.create({
          data: {
            userId: buyerReferral.referrerId,
            type: "REFERRAL_EARNED",
            title: "Referral Bonus Earned!",
            message: `You earned ${buyerReferralEarning.toFixed(4)} ${currencyLabel} from your referral's first purchase!`,
            data: {
              transactionId,
              amount: buyerReferralEarning,
              referralId: buyerReferral.id,
              type: "buyer_purchase",
            },
          },
        });

        if (process.env.NODE_ENV === 'development') console.log(`[Referral] Buyer referrer ${buyerReferral.referrerId} earned ${buyerReferralEarning} ${currencyLabel}`);
      }
      } // end self-referral guard
    }

    // Check if seller was referred AND atomically claim first transaction flag
    const sellerReferral = await tx.referral.findUnique({
      where: { referredUserId: sellerId },
      include: {
        referrer: { select: { id: true, walletAddress: true } },
      },
    });

    if (sellerReferral) {
      // SECURITY [C6]: Block self-referral for seller side
      if (sellerReferral.referrerId === sellerId || sellerReferral.referrerId === buyerId) {
        if (process.env.NODE_ENV === 'development') console.log(`[Referral] Blocked self/counterparty referral for seller ${sellerId}`);
      } else {
      // Atomic check-and-set: only claim if firstTransactionPaid is still false
      const claimResult = await tx.referral.updateMany({
        where: {
          id: sellerReferral.id,
          firstTransactionPaid: false, // Atomic: only update if not yet paid
        },
        data: {
          firstTransactionPaid: true,
          status: "ACTIVE",
          convertedAt: new Date(),
        },
      });

      if (claimResult.count > 0) {
        // Successfully claimed - this is seller's first transaction
        // SECURITY: Integer-safe commission calculation
        const earningUnits = Math.floor(salePriceUnits * commissionRateBps / 10000);
        sellerReferralEarning = earningUnits / base;

        // Create the earning record
        await tx.referralEarning.create({
          data: {
            referralId: sellerReferral.id,
            transactionId,
            saleAmount: salePrice,
            commissionRate: commissionRateBps / 10000,
            earnedAmount: sellerReferralEarning,
            status: "AVAILABLE",
          },
        });

        // Update the referral total earnings
        await tx.referral.update({
          where: { id: sellerReferral.id },
          data: {
            totalEarnings: { increment: sellerReferralEarning },
          },
        });

        // Update referrer's total earnings
        await tx.user.update({
          where: { id: sellerReferral.referrerId },
          data: {
            referralEarnings: { increment: sellerReferralEarning },
          },
        });

        // Notify the referrer
        await tx.notification.create({
          data: {
            userId: sellerReferral.referrerId,
            type: "REFERRAL_EARNED",
            title: "Referral Bonus Earned!",
            message: `You earned ${sellerReferralEarning.toFixed(4)} ${currencyLabel} from your referral's first sale!`,
            data: {
              transactionId,
              amount: sellerReferralEarning,
              referralId: sellerReferral.id,
              type: "seller_sale",
            },
          },
        });

        if (process.env.NODE_ENV === 'development') console.log(`[Referral] Seller referrer ${sellerReferral.referrerId} earned ${sellerReferralEarning} ${currencyLabel}`);
      }
      } // end self-referral guard
    }

    // SECURITY [F-6]: Cap total referral payouts to never exceed platform fee
    const totalPayout = buyerReferralEarning + sellerReferralEarning;
    if (totalPayout > platformFee) {
      const scale = platformFee / totalPayout;
      buyerReferralEarning = Math.floor(buyerReferralEarning * scale * base) / base;
      sellerReferralEarning = Math.floor(sellerReferralEarning * scale * base) / base;
    }

    return { buyerReferralEarning, sellerReferralEarning };
  }, { isolationLevel: 'Serializable' });

  const totalReferralPayout = buyerReferralEarning + sellerReferralEarning;
  const platformFeeAfterReferrals = platformFee - totalReferralPayout;

  if (process.env.NODE_ENV === 'development') console.log(`[Referral] Transaction ${transactionId} referral summary:`, {
    salePrice,
    currency: currencyLabel,
    platformFee,
    buyerReferralEarning,
    sellerReferralEarning,
    totalReferralPayout,
    platformFeeAfterReferrals,
  });

  return {
    buyerReferralEarning,
    sellerReferralEarning,
    totalReferralPayout,
    platformFeeAfterReferrals,
  };
}
