import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthToken } from "@/lib/auth";
import { isValidSolanaAddress } from "@/lib/validation";
import { validateCsrfRequest, csrfError } from '@/lib/csrf';

/**
 * POST /api/listings/[slug]/reserve
 * Reserve a listing for a specific wallet address (seller only)
 * This allows sellers to reserve listings for buyers who may not be registered users yet
 */
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
    const currentUserId = token?.id as string | undefined;

    if (!currentUserId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { slug } = params;
    const body = await request.json();
    const { walletAddress } = body;

    if (!walletAddress || typeof walletAddress !== "string") {
      return NextResponse.json(
        { error: "Wallet address is required" },
        { status: 400 }
      );
    }

    // Validate wallet address format (Solana Base58 validation)
    if (!isValidSolanaAddress(walletAddress)) {
      return NextResponse.json(
        { error: "Invalid wallet address format" },
        { status: 400 }
      );
    }

    // Get the listing
    const listing = await prisma.listing.findUnique({
      where: { slug },
      select: {
        id: true,
        sellerId: true,
        status: true,
        title: true,
      },
    });

    if (!listing) {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 }
      );
    }

    // Only seller can reserve
    if (listing.sellerId !== currentUserId) {
      return NextResponse.json(
        { error: "Only the seller can reserve this listing" },
        { status: 403 }
      );
    }

    // Can only reserve active listings
    if (listing.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Listing is not active" },
        { status: 400 }
      );
    }

    // Check if the wallet belongs to an existing user
    const existingUser = await prisma.user.findUnique({
      where: { walletAddress },
      select: { id: true },
    });

    // Update the listing to reserved status
    const updatedListing = await prisma.listing.update({
      where: { id: listing.id },
      data: {
        status: "RESERVED" as any,
        reservedBuyerWallet: walletAddress,
        reservedBuyerId: existingUser?.id || null,
        reservedAt: new Date(),
      } as any,
    });

    // If the buyer is a registered user, send them a notification
    if (existingUser) {
      await prisma.notification.create({
        data: {
          userId: existingUser.id,
          type: "LISTING_RESERVED",
          title: "Listing Reserved For You!",
          message: `"${listing.title}" has been reserved for you. Visit the seller's profile or your purchases to view it.`,
          data: {
            listingId: listing.id,
            slug: slug,
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      listing: updatedListing,
      buyerIsRegistered: !!existingUser,
    });
  } catch (error) {
    console.error("Error reserving listing:", error);
    return NextResponse.json(
      { error: "Failed to reserve listing" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/listings/[slug]/reserve
 * Remove reservation from a listing (seller only)
 */
export async function DELETE(
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
    const currentUserId = token?.id as string | undefined;

    if (!currentUserId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { slug } = params;

    // Get the listing
    const listing = await prisma.listing.findUnique({
      where: { slug },
      select: {
        id: true,
        sellerId: true,
        status: true,
      },
    });

    if (!listing) {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 }
      );
    }

    // Only seller can remove reservation
    if (listing.sellerId !== currentUserId) {
      return NextResponse.json(
        { error: "Only the seller can manage this listing" },
        { status: 403 }
      );
    }

    // Can only unreserve reserved listings
    if (listing.status !== "RESERVED") {
      return NextResponse.json(
        { error: "Listing is not reserved" },
        { status: 400 }
      );
    }

    // Update the listing back to active
    const updatedListing = await prisma.listing.update({
      where: { id: listing.id },
      data: {
        status: "ACTIVE" as any,
        reservedBuyerWallet: null,
        reservedBuyerId: null,
        reservedAt: null,
      } as any,
    });

    return NextResponse.json({
      success: true,
      listing: updatedListing,
    });
  } catch (error) {
    console.error("Error removing reservation:", error);
    return NextResponse.json(
      { error: "Failed to remove reservation" },
      { status: 500 }
    );
  }
}
