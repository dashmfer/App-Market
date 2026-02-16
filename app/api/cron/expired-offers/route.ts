import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyCronSecret } from "@/lib/cron-auth";
import {
  getBackendAuthority,
  getSolanaConnection,
  executeOnChainExpireOffer,
} from "@/lib/cron-helpers";

/**
 * Cron Job: Expired Offers Cleanup
 *
 * Marks ACTIVE offers past their deadline as EXPIRED with on-chain refund.
 * Preserves expired offers for financial audit trail (no hard deletion).
 *
 * Security:
 * - Executes on-chain offer refund before marking as expired
 * - Uses idempotent atomic status transition (updateMany WHERE status = ACTIVE)
 * - Wraps status update + notification in $transaction
 *
 * Runs every 10 minutes.
 */

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    const authority = getBackendAuthority();
    const connection = authority ? getSolanaConnection() : null;

    const expiredOffers = await prisma.offer.findMany({
      where: {
        status: "ACTIVE",
        deadline: { lt: now },
      },
      include: {
        listing: {
          select: { title: true, onChainId: true },
        },
        buyer: {
          select: { id: true, username: true, walletAddress: true },
        },
      },
      take: 100,
      orderBy: { deadline: "asc" },
    });

    const results = {
      markedExpired: 0,
      refundsOnChain: 0,
      refundsSkipped: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const offer of expiredOffers) {
      try {
        // IDEMPOTENCY: Atomically claim — only succeeds if still ACTIVE
        const claimed = await prisma.offer.updateMany({
          where: { id: offer.id, status: "ACTIVE" },
          data: { status: "EXPIRING" as any },
        });

        if (claimed.count === 0) continue;

        // Execute on-chain offer expiry/refund if possible
        let onChainTxSig: string | null = null;
        if (
          authority &&
          connection &&
          offer.listing.onChainId &&
          offer.buyer.walletAddress &&
          offer.onChainId
        ) {
          const offerSeed = parseInt(offer.onChainId);
          if (isNaN(offerSeed)) {
            console.error(`[Cron:expired-offers] Invalid onChainId "${offer.onChainId}" for offer ${offer.id}`);
            results.refundsSkipped++;
            // Skip on-chain but still expire in DB below
          }
          onChainTxSig = isNaN(offerSeed) ? null : await executeOnChainExpireOffer(
            connection,
            authority,
            offer.listing.onChainId,
            offer.buyer.walletAddress,
            offerSeed
          );

          if (onChainTxSig) {
            results.refundsOnChain++;
          } else {
            // On-chain refund failed — revert status for retry
            await prisma.offer.updateMany({
              where: { id: offer.id, status: "EXPIRING" as any },
              data: { status: "ACTIVE" },
            });
            results.failed++;
            results.errors.push(
              `On-chain refund failed for offer ${offer.id} — will retry`
            );
            continue;
          }
        } else {
          results.refundsSkipped++;
        }

        // Finalize as EXPIRED with notification
        await prisma.$transaction([
          prisma.offer.update({
            where: { id: offer.id },
            data: { status: "EXPIRED", expiredAt: now },
          }),
          prisma.notification.create({
            data: {
              type: "SYSTEM",
              title: "Offer Expired",
              message: `Your offer of ${Number(offer.amount)} SOL on "${offer.listing.title}" has expired.${onChainTxSig ? " Funds have been returned to your wallet." : " If funds were escrowed on-chain, they will need to be claimed via the contract's expire_offer instruction."}`,
              data: {
                offerId: offer.id,
                listingId: offer.listingId,
                amount: Number(offer.amount),
                onChainTx: onChainTxSig,
              },
              userId: offer.buyerId,
            },
          }),
        ]);

        results.markedExpired++;
        console.log(
          `[Cron:expired-offers] Expired offer ${offer.id}${onChainTxSig ? ` (refund tx: ${onChainTxSig})` : ""}`
        );
      } catch (error) {
        results.failed++;
        const errorMsg = `Failed to expire offer ${offer.id}: ${error}`;
        results.errors.push(errorMsg);
        console.error(`[Cron:expired-offers] ${errorMsg}`);
      }
    }

    // No hard deletion — preserve for audit trail
    console.log(
      `[Cron:expired-offers] Skipping hard-deletion — preserving audit trail`
    );

    return NextResponse.json({
      success: true,
      message: `Offer cleanup complete: ${results.markedExpired} expired, ${results.refundsOnChain} on-chain refunds, ${results.failed} failed`,
      processed: {
        activeOffersChecked: expiredOffers.length,
        staleOffersChecked: 0,
      },
      results,
    });
  } catch (error) {
    console.error("[Cron:expired-offers] Error:", error);
    return NextResponse.json(
      { error: "Failed to process offer cleanup" },
      { status: 500 }
    );
  }
}
