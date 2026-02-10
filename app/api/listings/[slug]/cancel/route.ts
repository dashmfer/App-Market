import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthToken } from "@/lib/auth";
import { validateCsrfRequest, csrfError } from '@/lib/csrf';

// POST /api/listings/[slug]/cancel - Cancel a listing
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    // SECURITY: Validate CSRF token
    const csrfValidation = validateCsrfRequest(request);
    if (!csrfValidation.valid) {
      return csrfError(csrfValidation.error || 'CSRF validation failed');
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

    // Check if listing can be cancelled
    if (listing.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Only active listings can be cancelled" },
        { status: 400 }
      );
    }

    // Check if there are any bids
    if (listing._count.bids > 0) {
      return NextResponse.json(
        { error: "Cannot cancel a listing with bids. Please wait for the auction to end." },
        { status: 400 }
      );
    }

    // Cancel the listing
    const cancelledListing = await prisma.listing.update({
      where: { slug },
      data: {
        status: "CANCELLED",
      },
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
