import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// GET /api/categories - Get category counts
export async function GET(request: NextRequest) {
  try {
    // Get all active listings with their categories
    const listings = await prisma.listing.findMany({
      where: {
        status: "ACTIVE",
        endTime: { gt: new Date() },
      },
      select: {
        categories: true,
      },
    });

    // Count occurrences of each category
    const counts: Record<string, number> = {};
    listings.forEach((listing) => {
      listing.categories.forEach((category) => {
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
