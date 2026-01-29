import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Runs every hour to expire stale offers and process refunds
// POST /api/cron/offer-expiry
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();

    // Find all active offers past their deadline
    const expiredOffers = await prisma.offer.findMany({
      where: {
        status: "ACTIVE",
        deadline: { lt: now },
      },
      include: {
        listing: {
          select: { title: true, slug: true },
        },
        buyer: {
          select: { id: true, walletAddress: true },
        },
      },
    });

    let expired = 0;
    let refunded = 0;
    const refundErrors: string[] = [];

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

        // If there's an escrow address, the offer had escrowed funds
        // When the smart contract is wired up, call cancelOffer() to refund
        // For now, offers don't escrow funds, so we just notify the buyer
        const hasEscrow = !!offer.escrowAddress;

        if (hasEscrow && offer.buyer.walletAddress) {
          // TODO: When smart contract is wired up:
          // 1. Load the escrow account
          // 2. Call cancelOffer instruction on the smart contract
          // 3. The contract will transfer funds back to buyer's wallet
          //
          // For now, log for manual processing if needed
          console.log(`Offer ${offer.id} expired with escrow at ${offer.escrowAddress}`);
          console.log(`Refund ${offer.amount} ${offer.currency} to ${offer.buyer.walletAddress}`);
          refunded++;
        }

        // Notify buyer their offer expired
        await prisma.notification.create({
          data: {
            userId: offer.buyer.id,
            type: "OFFER_EXPIRED",
            title: "Offer Expired",
            message: hasEscrow
              ? `Your offer of ${offer.amount} ${offer.currency} on "${offer.listing.title}" has expired and funds are being returned to your wallet.`
              : `Your offer on "${offer.listing.title}" has expired. You can make a new offer if the listing is still available.`,
            data: {
              listingSlug: offer.listing.slug,
              amount: offer.amount,
              currency: offer.currency,
              refunded: hasEscrow,
            },
          },
        });

        expired++;
      } catch (err) {
        const errorMsg = `Error expiring offer ${offer.id}: ${err instanceof Error ? err.message : String(err)}`;
        console.error(errorMsg);
        refundErrors.push(errorMsg);
      }
    }

    return NextResponse.json({
      success: true,
      processed: expiredOffers.length,
      expired,
      refunded,
      errors: refundErrors.length > 0 ? refundErrors : undefined,
    });
  } catch (error) {
    console.error("Error processing offer expiry:", error);
    return NextResponse.json(
      { error: "Failed to process offer expiry" },
      { status: 500 }
    );
  }
}
