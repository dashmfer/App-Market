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
 * @returns Object with referral earnings details
 */
export async function processReferralEarnings(
  transactionId: string,
  salePrice: number,
  buyerId: string,
  sellerId: string
): Promise<{
  buyerReferralEarning: number;
  sellerReferralEarning: number;
  totalReferralPayout: number;
  platformFeeAfterReferrals: number;
}> {
  const commissionRate = PLATFORM_CONFIG.referral.commissionRateBps / 10000; // 0.02 = 2%
  const platformFeeRate = PLATFORM_CONFIG.fees.platformFeeBps / 10000; // 0.05 = 5%
  const platformFee = salePrice * platformFeeRate;

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
        buyerReferralEarning = salePrice * commissionRate;

        // Create the earning record
        await tx.referralEarning.create({
          data: {
            referralId: buyerReferral.id,
            transactionId,
            saleAmount: salePrice,
            commissionRate,
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
            message: `You earned ${buyerReferralEarning.toFixed(4)} SOL from your referral's first purchase!`,
            data: {
              transactionId,
              amount: buyerReferralEarning,
              referralId: buyerReferral.id,
              type: "buyer_purchase",
            },
          },
        });

        console.log(`[Referral] Buyer referrer ${buyerReferral.referrerId} earned ${buyerReferralEarning} SOL`);
      }
    }

    // Check if seller was referred AND atomically claim first transaction flag
    const sellerReferral = await tx.referral.findUnique({
      where: { referredUserId: sellerId },
      include: {
        referrer: { select: { id: true, walletAddress: true } },
      },
    });

    if (sellerReferral) {
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
        sellerReferralEarning = salePrice * commissionRate;

        // Create the earning record
        await tx.referralEarning.create({
          data: {
            referralId: sellerReferral.id,
            transactionId,
            saleAmount: salePrice,
            commissionRate,
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
            message: `You earned ${sellerReferralEarning.toFixed(4)} SOL from your referral's first sale!`,
            data: {
              transactionId,
              amount: sellerReferralEarning,
              referralId: sellerReferral.id,
              type: "seller_sale",
            },
          },
        });

        console.log(`[Referral] Seller referrer ${sellerReferral.referrerId} earned ${sellerReferralEarning} SOL`);
      }
    }

    return { buyerReferralEarning, sellerReferralEarning };
  }, { isolationLevel: 'Serializable' });

  const totalReferralPayout = buyerReferralEarning + sellerReferralEarning;
  const platformFeeAfterReferrals = platformFee - totalReferralPayout;

  console.log(`[Referral] Transaction ${transactionId} referral summary:`, {
    salePrice,
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
