import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// DELETE /api/admin/reset-listings
// Deletes all listings and related data (bids, offers, transactions, etc.)
// Requires authenticated user (add admin check in production)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // In production, add admin role check here:
    // if (!session.user.isAdmin) {
    //   return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    // }

    // Delete in order due to foreign key constraints
    const results = {
      watchlist: await prisma.watchlist.deleteMany({}),
      bids: await prisma.bid.deleteMany({}),
      offers: await prisma.offer.deleteMany({}),
      pendingWithdrawals: await prisma.pendingWithdrawal.deleteMany({}),
      uploads: await prisma.upload.deleteMany({}),
      reviews: await prisma.review.deleteMany({}),
      disputes: await prisma.dispute.deleteMany({}),
      transactions: await prisma.transaction.deleteMany({}),
      listings: await prisma.listing.deleteMany({}),
      notifications: await prisma.notification.deleteMany({}),
    };

    return NextResponse.json({
      success: true,
      message: "All listings and related data deleted",
      deleted: {
        watchlist: results.watchlist.count,
        bids: results.bids.count,
        offers: results.offers.count,
        pendingWithdrawals: results.pendingWithdrawals.count,
        uploads: results.uploads.count,
        reviews: results.reviews.count,
        disputes: results.disputes.count,
        transactions: results.transactions.count,
        listings: results.listings.count,
        notifications: results.notifications.count,
      },
    });
  } catch (error) {
    console.error("Error resetting listings:", error);
    return NextResponse.json(
      { error: "Failed to reset listings" },
      { status: 500 }
    );
  }
}
