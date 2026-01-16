import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

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
