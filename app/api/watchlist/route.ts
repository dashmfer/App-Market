import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthToken } from "@/lib/auth";

// GET /api/watchlist - Get user's watchlist
export async function GET(request: NextRequest) {
  try {
    const token = await getAuthToken(request);
    if (!token?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = token.id as string;

    const watchlist = await prisma.watchlist.findMany({
      where: { userId },
      include: {
        listing: {
          include: {
            seller: {
              select: {
                id: true,
                name: true,
                displayName: true,
                username: true,
                image: true,
                isVerified: true,
              },
            },
            _count: {
              select: { bids: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Transform to return just listings with watchlist info
    const listings = watchlist.map((w: typeof watchlist[number]) => ({
      ...w.listing,
      watchlistId: w.id,
      watchlistedAt: w.createdAt,
    }));

    return NextResponse.json({ listings });
  } catch (error: any) {
    console.error("Error fetching watchlist:", error);
    return NextResponse.json(
      { error: "Failed to fetch watchlist" },
      { status: 500 }
    );
  }
}

// POST /api/watchlist - Add listing to watchlist
export async function POST(request: NextRequest) {
  try {
    const token = await getAuthToken(request);
    if (!token?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = token.id as string;
    const body = await request.json();
    const { listingId } = body;

    if (!listingId) {
      return NextResponse.json(
        { error: "Listing ID is required" },
        { status: 400 }
      );
    }

    // Check if listing exists
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 }
      );
    }

    // Check if already watchlisted
    const existing = await prisma.watchlist.findUnique({
      where: {
        userId_listingId: {
          userId,
          listingId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Already in watchlist", watchlistId: existing.id },
        { status: 400 }
      );
    }

    // Create watchlist entry
    const watchlist = await prisma.watchlist.create({
      data: {
        userId,
        listingId,
      },
    });

    return NextResponse.json({
      success: true,
      watchlistId: watchlist.id,
      message: "Added to watchlist",
    });
  } catch (error: any) {
    console.error("Error adding to watchlist:", error);
    return NextResponse.json(
      { error: "Failed to add to watchlist" },
      { status: 500 }
    );
  }
}

// DELETE /api/watchlist - Remove listing from watchlist
export async function DELETE(request: NextRequest) {
  try {
    const token = await getAuthToken(request);
    if (!token?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = token.id as string;
    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get("listingId");

    if (!listingId) {
      return NextResponse.json(
        { error: "Listing ID is required" },
        { status: 400 }
      );
    }

    // Find and delete
    const existing = await prisma.watchlist.findUnique({
      where: {
        userId_listingId: {
          userId,
          listingId,
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Not in watchlist" },
        { status: 404 }
      );
    }

    await prisma.watchlist.delete({
      where: { id: existing.id },
    });

    return NextResponse.json({
      success: true,
      message: "Removed from watchlist",
    });
  } catch (error: any) {
    console.error("Error removing from watchlist:", error);
    return NextResponse.json(
      { error: "Failed to remove from watchlist" },
      { status: 500 }
    );
  }
}
