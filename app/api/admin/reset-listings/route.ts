import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthToken } from "@/lib/auth";
import { audit, auditContext } from "@/lib/audit";
import { validateCsrfRequest, csrfError } from '@/lib/csrf';

// ADMIN SECRET - Must be set in environment variables
const ADMIN_SECRET = process.env.ADMIN_SECRET;

/**
 * Validate admin secret from Authorization header
 * Expected format: "Bearer <admin_secret>"
 */
function validateAdminSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !ADMIN_SECRET) {
    return false;
  }

  // Support both "Bearer <secret>" and raw "<secret>" formats
  const secret = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  // SECURITY: Use constant-time comparison to prevent timing attacks
  if (secret.length !== ADMIN_SECRET.length) {
    return false;
  }

  try {
    return timingSafeEqual(
      Buffer.from(secret),
      Buffer.from(ADMIN_SECRET)
    );
  } catch {
    return false;
  }
}

// DELETE /api/admin/reset-listings
// Delete all listings: DELETE /api/admin/reset-listings?all=true (with Authorization: Bearer <secret>)
// Delete specific listing: DELETE /api/admin/reset-listings?id=LISTING_ID (with Authorization: Bearer <secret>)
export async function DELETE(request: NextRequest) {
  try {
    // SECURITY: Validate CSRF token
    const csrfValidation = validateCsrfRequest(request);
    if (!csrfValidation.valid) {
      return csrfError(csrfValidation.error || 'CSRF validation failed');
    }

    // SECURITY: Validate admin secret from Authorization header (not query params)
    if (!validateAdminSecret(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get("id");
    const deleteAll = searchParams.get("all") === "true";

    // Also require authentication AND admin role
    const token = await getAuthToken(request);
    if (!token?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // SECURITY: Verify user is an admin in the database
    const user = await prisma.user.findUnique({
      where: { id: token.id as string },
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

      await audit({
        action: "ADMIN_RESET_LISTINGS",
        severity: "WARN",
        userId: token.id as string,
        targetId: listingId,
        targetType: "listing",
        detail: `Admin deleted listing "${listing.title}"`,
        ...auditContext(request.headers),
      });

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

      await audit({
        action: "ADMIN_RESET_LISTINGS",
        severity: "CRITICAL",
        userId: token.id as string,
        detail: `Admin deleted ALL listings (${results.listings.count} listings)`,
        metadata: { listings: results.listings.count, transactions: results.transactions.count },
        ...auditContext(request.headers),
      });

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
