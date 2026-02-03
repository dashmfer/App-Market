import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { ListingStatus } from "@/lib/prisma-enums";

// GET /api/categories - Get category counts
export async function GET(request: NextRequest) {
  try {
    // Get all publicly visible listings (ACTIVE only, not expired)
    // Must match the same criteria as /api/listings public view
    const listings = await prisma.listing.findMany({
      where: {
        status: ListingStatus.ACTIVE,
        endTime: { gt: new Date() },
      },
      select: {
        categories: true,
      },
    });

    // Count occurrences of each category
    const counts: Record<string, number> = {};
    listings.forEach((listing: { categories: string[] }) => {
      listing.categories.forEach((category: string) => {
        counts[category] = (counts[category] || 0) + 1;
      });
    });

    return NextResponse.json({ counts });
  } catch (error) {
    console.error("Error fetching category counts:", error);
    return NextResponse.json(
      { error: "Failed to fetch category counts" },
      { status: 500 }
    );
  }
}
