import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthToken } from "@/lib/auth";
import { validateCsrfRequest, csrfError } from "@/lib/csrf";
import { withRateLimitAsync } from "@/lib/rate-limit";

// POST /api/listings/[slug]/cancel - Cancel a listing
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    // SECURITY: CSRF validation for state-changing endpoint
    const csrf = validateCsrfRequest(request);
    if (!csrf.valid) {
      return csrfError(csrf.error || "CSRF validation failed");
    }

    const rateLimitResult = await (withRateLimitAsync('write', 'listing-cancel'))(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: 429, headers: rateLimitResult.headers }
      );
    }

    const token = await getAuthToken(request);

    if (!token?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = token.id as string;
    const { slug } = params;

    // Find the listing
    const listing = await prisma.listing.findUnique({
      where: { slug },
      include: {
        _count: {
          select: { bids: true },
        },
      },
    });

    if (!listing) {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 }
      );
    }

    // Check ownership
    if (listing.sellerId !== userId) {
      return NextResponse.json(
        { error: "You can only cancel your own listings" },
        { status: 403 }
      );
    }

    // Check if there are any bids
    if (listing._count.bids > 0) {
      return NextResponse.json(
        { error: "Cannot cancel a listing with bids. Please wait for the auction to end." },
        { status: 400 }
      );
    }

    // SECURITY FIX: Atomic cancel with status guard to prevent TOCTOU race
    const cancelResult = await prisma.listing.updateMany({
      where: { slug, status: "ACTIVE", sellerId: userId },
      data: {
        status: "CANCELLED",
      },
    });

    if (cancelResult.count === 0) {
      return NextResponse.json(
        { error: "Listing is no longer active or does not belong to you" },
        { status: 409 }
      );
    }

    const cancelledListing = await prisma.listing.findUnique({
      where: { slug },
    });

    return NextResponse.json({
      listing: cancelledListing,
      message: "Listing cancelled successfully"
    });
  } catch (error) {
    console.error("Error cancelling listing:", error);
    return NextResponse.json(
      { error: "Failed to cancel listing" },
      { status: 500 }
    );
  }
}
