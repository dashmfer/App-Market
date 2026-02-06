import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ADMIN SECRET - Must be set in environment variables
const ADMIN_SECRET = process.env.ADMIN_SECRET;

// DELETE /api/admin/reset-listings
// Delete all listings: DELETE /api/admin/reset-listings?all=true (with X-Admin-Secret header)
// Delete specific listing: DELETE /api/admin/reset-listings?id=LISTING_ID (with X-Admin-Secret header)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    // SECURITY: Read admin secret from header instead of query string
    // This prevents the secret from being logged in server access logs
    const secret = request.headers.get("X-Admin-Secret");
    const listingId = searchParams.get("id");
    const deleteAll = searchParams.get("all") === "true";

    // SECURITY: Use constant-time comparison to prevent timing attacks
    if (!ADMIN_SECRET || !secret || secret.length !== ADMIN_SECRET.length) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let isValidSecret = false;
    try {
      isValidSecret = timingSafeEqual(
        Buffer.from(secret),
        Buffer.from(ADMIN_SECRET)
      );
    } catch {
      isValidSecret = false;
    }

    if (!isValidSecret) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Also require authentication AND admin role
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // SECURITY: Verify user is an admin in the database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    // Delete specific listing
    if (listingId && !deleteAll) {
      const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        select: { id: true, title: true },
      });

      if (!listing) {
        return NextResponse.json({ error: "Listing not found" }, { status: 404 });
      }

      // Delete related data first
      await prisma.watchlist.deleteMany({ where: { listingId } });
      await prisma.bid.deleteMany({ where: { listingId } });
      await prisma.offer.deleteMany({ where: { listingId } });
      await prisma.pendingWithdrawal.deleteMany({ where: { listingId } });

      // Delete transaction and its related data
      const transaction = await prisma.transaction.findUnique({ where: { listingId } });
      if (transaction) {
        await prisma.upload.deleteMany({ where: { transactionId: transaction.id } });
        await prisma.review.deleteMany({ where: { transactionId: transaction.id } });
        await prisma.dispute.deleteMany({ where: { transactionId: transaction.id } });
        await prisma.transaction.delete({ where: { listingId } });
      }

      await prisma.listing.delete({ where: { id: listingId } });

      return NextResponse.json({
        success: true,
        message: `Listing "${listing.title}" deleted`,
        deletedId: listingId,
      });
    }

    // Delete ALL listings (requires all=true flag)
    if (deleteAll) {
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
    }

    return NextResponse.json(
      { error: "Specify ?id=LISTING_ID to delete one, or ?all=true to delete all" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error in admin reset:", error);
    return NextResponse.json(
      { error: "Failed to delete" },
      { status: 500 }
    );
  }
}
