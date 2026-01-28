import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Runs every 6 hours to check for expired transfer deadlines
// POST /api/cron/transfer-deadlines
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Find transactions where the transfer deadline has passed (created > 7 days ago)
    // and still in a transfer-pending state
    const expiredTransactions = await prisma.transaction.findMany({
      where: {
        createdAt: { lt: sevenDaysAgo },
        status: {
          in: ["TRANSFER_PENDING", "TRANSFER_IN_PROGRESS", "IN_ESCROW"],
        },
      },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            slug: true,
            sellerId: true,
          },
        },
      },
    });

    const results = {
      expired: 0,
      refunded: 0,
      errors: 0,
    };

    for (const transaction of expiredTransactions) {
      try {
        // Check if seller has confirmed ANY items
        const checklist = transaction.transferChecklist as any[] | null;
        const sellerStartedTransfer = checklist?.some((item: any) => item.sellerConfirmed);

        if (!sellerStartedTransfer) {
          // Seller never started transferring — auto-refund buyer
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: {
              status: "REFUNDED",
              transferCompletedAt: now,
            },
          });

          // Restore listing to active
          await prisma.listing.update({
            where: { id: transaction.listingId },
            data: { status: "ACTIVE" },
          });

          // Notify buyer of refund
          await prisma.notification.create({
            data: {
              userId: transaction.buyerId,
              type: "TRANSFER_EXPIRED",
              title: "Transfer Expired — Refund Initiated",
              message: `The seller did not transfer "${transaction.listing.title}" within the 7-day deadline. Your refund has been initiated.`,
              data: { transactionId: transaction.id, listingSlug: transaction.listing.slug },
            },
          });

          // Notify seller
          await prisma.notification.create({
            data: {
              userId: transaction.listing.sellerId,
              type: "TRANSFER_EXPIRED",
              title: "Transfer Deadline Expired",
              message: `You did not complete the transfer for "${transaction.listing.title}" within 7 days. The buyer has been refunded and the listing has been relisted.`,
              data: { transactionId: transaction.id, listingSlug: transaction.listing.slug },
            },
          });

          // TODO: Trigger actual on-chain refund from escrow wallet to buyer wallet
          // In production, this should call a server-side Solana transaction to send
          // the escrowed SOL back to transaction.buyer.walletAddress

          results.refunded++;
        } else {
          // Seller started but didn't finish — mark as expired, needs manual resolution
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: "DISPUTED" },
          });

          // Notify buyer
          await prisma.notification.create({
            data: {
              userId: transaction.buyerId,
              type: "TRANSFER_EXPIRED",
              title: "Transfer Deadline Expired",
              message: `The transfer deadline for "${transaction.listing.title}" has passed. The transfer is incomplete and has been escalated for review. You may open a dispute.`,
              data: { transactionId: transaction.id, listingSlug: transaction.listing.slug },
            },
          });

          // Notify seller
          await prisma.notification.create({
            data: {
              userId: transaction.listing.sellerId,
              type: "TRANSFER_EXPIRED",
              title: "Transfer Deadline Expired",
              message: `The 7-day transfer deadline for "${transaction.listing.title}" has passed with incomplete transfers. This has been escalated for review.`,
              data: { transactionId: transaction.id, listingSlug: transaction.listing.slug },
            },
          });
        }

        results.expired++;
      } catch (err) {
        console.error(`Error processing expired transaction ${transaction.id}:`, err);
        results.errors++;
      }
    }

    return NextResponse.json({
      success: true,
      processed: expiredTransactions.length,
      ...results,
    });
  } catch (error) {
    console.error("Error processing transfer deadlines:", error);
    return NextResponse.json(
      { error: "Failed to process transfer deadlines" },
      { status: 500 }
    );
  }
}
