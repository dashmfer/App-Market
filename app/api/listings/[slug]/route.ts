import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthToken } from "@/lib/auth";

// GET /api/listings/[slug] - Get a single listing by slug
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;

    const listing = await prisma.listing.findUnique({
      where: { slug },
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            username: true,
            walletAddress: true,
            image: true,
            isVerified: true,
            totalSales: true,
            createdAt: true,
          },
        },
        bids: {
          orderBy: { amount: "desc" },
          take: 10,
          include: {
            bidder: {
              select: {
                id: true,
                name: true,
                username: true,
                walletAddress: true,
              },
            },
          },
        },
        _count: {
          select: {
            bids: true,
            watchlist: true,
          },
        },
      },
    });

    if (!listing) {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 }
      );
    }

    // Get current highest bid
    const currentBid = listing.bids[0]?.amount || listing.startingPrice;

    return NextResponse.json({
      listing: {
        ...listing,
        currentBid,
        bidCount: listing._count.bids,
      },
    });
  } catch (error) {
    console.error("Error fetching listing:", error);
    return NextResponse.json(
      { error: "Failed to fetch listing" },
      { status: 500 }
    );
  }
}

// PUT /api/listings/[slug] - Update a listing
export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
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
        { error: "You can only edit your own listings" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, tagline, description } = body;

    // Update the listing
    const updatedListing = await prisma.listing.update({
      where: { slug },
      data: {
        ...(title && { title }),
        ...(tagline !== undefined && { tagline }),
        ...(description && { description }),
      },
    });

    return NextResponse.json({ listing: updatedListing });
  } catch (error) {
    console.error("Error updating listing:", error);
    return NextResponse.json(
      { error: "Failed to update listing" },
      { status: 500 }
    );
  }
}
