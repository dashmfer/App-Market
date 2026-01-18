import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// This endpoint should be called by a cron job every hour
// POST /api/cron/buyer-info-deadlines
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret (optional security measure)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const sixHoursFromNow = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Find transactions with pending buyer info
    const pendingTransactions = await prisma.transaction.findMany({
      where: {
        buyerInfoStatus: "PENDING",
        buyerInfoDeadline: { not: null },
      },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            sellerId: true,
          },
        },
      },
    });

    const results = {
      deadlinePassed: 0,
      reminders24h: 0,
      reminders6h: 0,
    };

    for (const transaction of pendingTransactions) {
      const deadline = transaction.buyerInfoDeadline!;

      // Check if deadline has passed
      if (deadline < now) {
        // Update status to DEADLINE_PASSED
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            buyerInfoStatus: "DEADLINE_PASSED",
          },
        });

        // Notify buyer
        await prisma.notification.create({
          data: {
            userId: transaction.buyerId,
            type: "BUYER_INFO_DEADLINE",
            title: "Buyer Info Deadline Passed",
            message: `The 48-hour deadline to provide your information for "${transaction.listing.title}" has passed. The seller will use the fallback transfer process.`,
            link: `/dashboard/transfers/${transaction.id}`,
          },
        });

        // Notify seller
        await prisma.notification.create({
          data: {
            userId: transaction.listing.sellerId,
            type: "BUYER_INFO_DEADLINE",
            title: "Buyer Info Deadline Passed",
            message: `The buyer didn't provide their information for "${transaction.listing.title}" within 48 hours. You can now use the fallback transfer process.`,
            link: `/dashboard/transfers/${transaction.id}`,
          },
        });

        results.deadlinePassed++;
      }
      // Check for 6-hour reminder
      else if (deadline <= sixHoursFromNow && deadline > now) {
        // Check if reminder already sent (we can use a simple check based on notifications)
        const existingReminder = await prisma.notification.findFirst({
          where: {
            userId: transaction.buyerId,
            type: "BUYER_INFO_REMINDER",
            link: `/dashboard/transfers/${transaction.id}`,
            createdAt: {
              gte: new Date(now.getTime() - 5 * 60 * 60 * 1000), // Within last 5 hours
            },
          },
        });

        if (!existingReminder) {
          await prisma.notification.create({
            data: {
              userId: transaction.buyerId,
              type: "BUYER_INFO_REMINDER",
              title: "⚠️ 6 Hours Left to Submit Info",
              message: `You have less than 6 hours to provide your information for "${transaction.listing.title}". Submit now to avoid the fallback transfer process.`,
              link: `/dashboard/transfers/${transaction.id}/buyer-info`,
            },
          });
          results.reminders6h++;
        }
      }
      // Check for 24-hour reminder
      else if (deadline <= twentyFourHoursFromNow && deadline > sixHoursFromNow) {
        const existingReminder = await prisma.notification.findFirst({
          where: {
            userId: transaction.buyerId,
            type: "BUYER_INFO_REMINDER",
            link: `/dashboard/transfers/${transaction.id}`,
            createdAt: {
              gte: new Date(now.getTime() - 23 * 60 * 60 * 1000), // Within last 23 hours
            },
          },
        });

        if (!existingReminder) {
          await prisma.notification.create({
            data: {
              userId: transaction.buyerId,
              type: "BUYER_INFO_REMINDER",
              title: "24 Hours Left to Submit Info",
              message: `Reminder: You have 24 hours left to provide your information for "${transaction.listing.title}".`,
              link: `/dashboard/transfers/${transaction.id}/buyer-info`,
            },
          });
          results.reminders24h++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed: pendingTransactions.length,
      ...results,
    });
  } catch (error) {
    console.error("Error processing buyer info deadlines:", error);
    return NextResponse.json(
      { error: "Failed to process deadlines" },
      { status: 500 }
    );
  }
}
