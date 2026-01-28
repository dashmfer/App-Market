import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Runs every hour to expire stale offers
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
          select: { id: true },
        },
      },
    });

    let expired = 0;

    for (const offer of expiredOffers) {
      try {
        await prisma.offer.update({
          where: { id: offer.id },
          data: {
            status: "EXPIRED",
            expiredAt: now,
          },
        });

        // Notify buyer their offer expired
        await prisma.notification.create({
          data: {
            userId: offer.buyer.id,
            type: "OFFER_EXPIRED",
            title: "Offer Expired",
            message: `Your offer on "${offer.listing.title}" has expired. You can make a new offer if the listing is still available.`,
            data: { listingSlug: offer.listing.slug },
          },
        });

        // TODO: Trigger on-chain refund of offer escrow to buyer wallet

        expired++;
      } catch (err) {
        console.error(`Error expiring offer ${offer.id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      processed: expiredOffers.length,
      expired,
    });
  } catch (error) {
    console.error("Error processing offer expiry:", error);
    return NextResponse.json(
      { error: "Failed to process offer expiry" },
      { status: 500 }
    );
  }
}
