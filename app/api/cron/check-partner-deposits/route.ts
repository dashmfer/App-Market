import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// This endpoint should be called by a cron job every minute
// It checks for expired partner deposit deadlines and handles refunds

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret (for production security)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // In production, verify the secret
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find all transactions with expired partner deposit deadlines
    const expiredTransactions = await prisma.transaction.findMany({
      where: {
        status: "AWAITING_PARTNER_DEPOSITS",
        partnerDepositDeadline: {
          lt: new Date(),
        },
      },
      include: {
        listing: { select: { id: true, title: true, slug: true, status: true } },
        partners: {
          include: {
            user: { select: { id: true } },
          },
        },
      },
    });

    const results = [];

    for (const transaction of expiredTransactions) {
      try {
        // Check if 100% was deposited (shouldn't happen, but edge case)
        const totalDeposited = transaction.partners
          .filter(p => p.depositStatus === "DEPOSITED")
          .reduce((sum, p) => sum + p.percentage, 0);

        if (totalDeposited === 100) {
          // All deposits completed, this shouldn't be in AWAITING status
          // Move to PAID status
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: {
              status: "PAID",
              paidAt: new Date(),
            },
          });

          // Update listing to SOLD
          await prisma.listing.update({
            where: { id: transaction.listing.id },
            data: { status: "SOLD" },
          });

          results.push({
            transactionId: transaction.id,
            action: "completed",
            message: "All deposits were complete, moved to PAID status",
          });
          continue;
        }

        // Deposits incomplete - process refunds
        // Mark all deposited partners as refunded
        await prisma.transactionPartner.updateMany({
          where: {
            transactionId: transaction.id,
            depositStatus: "DEPOSITED",
          },
          data: {
            depositStatus: "REFUNDED",
          },
        });

        // Cancel the transaction
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: "CANCELLED",
          },
        });

        // If listing was reserved/modified, restore it
        if (transaction.listing.status !== "ACTIVE") {
          await prisma.listing.update({
            where: { id: transaction.listing.id },
            data: { status: "ACTIVE" },
          });
        }

        // Notify all partners about the timeout
        const notifications = [];
        for (const partner of transaction.partners) {
          if (partner.userId) {
            notifications.push({
              userId: partner.userId,
              type: "PURCHASE_PARTNER_TIMEOUT" as const,
              title: "Purchase Partner Timeout",
              message: `The deposit window for "${transaction.listing.title}" has expired. All deposits will be refunded.`,
              data: {
                transactionId: transaction.id,
                listingId: transaction.listing.id,
                listingSlug: transaction.listing.slug,
              },
            });
          }
        }

        if (notifications.length > 0) {
          await prisma.notification.createMany({
            data: notifications,
          });
        }

        results.push({
          transactionId: transaction.id,
          action: "refunded",
          partnersNotified: notifications.length,
          message: `Deposit window expired. ${transaction.partners.filter(p => p.depositStatus === "DEPOSITED").length} partners refunded.`,
        });

        // TODO: In production, trigger actual on-chain refunds here
        // This would involve calling the smart contract to release deposited funds

      } catch (txError) {
        console.error(`Error processing transaction ${transaction.id}:`, txError);
        results.push({
          transactionId: transaction.id,
          action: "error",
          message: txError instanceof Error ? txError.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      processed: expiredTransactions.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in partner deposit cron:", error);
    return NextResponse.json(
      { error: "Failed to process expired deposits" },
      { status: 500 }
    );
  }
}

// Also support GET for manual checks
export async function GET(request: NextRequest) {
  return POST(request);
}
