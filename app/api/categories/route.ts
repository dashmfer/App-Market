import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// GET /api/categories - Get category counts
export async function GET(request: NextRequest) {
  try {
    // Get counts for each category (only active and non-expired listings)
    const categoryCounts = await prisma.listing.groupBy({
      by: ["category"],
      where: {
        status: "ACTIVE",
        endTime: { gt: new Date() },
      },
      _count: {
        category: true,
      },
    });

    // Transform to a map for easy lookup
    const counts: Record<string, number> = {};
    categoryCounts.forEach((item) => {
      counts[item.category] = item._count.category;
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
