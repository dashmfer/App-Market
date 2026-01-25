import { NextResponse } from "next/server";
import prisma from "@/lib/db";

// GET /api/stats - Get platform-wide statistics
export async function GET() {
  try {
    // Get aggregate stats from the database
    const [
      totalSales,
      totalVolume,
      activeSellers,
      activeListings,
      avgSaleTime,
    ] = await Promise.all([
      // Total completed sales
      prisma.transaction.count({
        where: { status: "COMPLETED" },
      }),

      // Total volume (sum of all completed sale prices)
      prisma.transaction.aggregate({
        where: { status: "COMPLETED" },
        _sum: { salePrice: true },
      }),

      // Active sellers (users with at least one active listing)
      prisma.user.count({
        where: {
          listings: {
            some: { status: "ACTIVE" },
          },
        },
      }),

      // Active listings count
      prisma.listing.count({
        where: { status: "ACTIVE" },
      }),

      // Average sale time (from listing creation to transaction completion)
      prisma.$queryRaw<{ avg_days: number }[]>`
        SELECT AVG(
          EXTRACT(EPOCH FROM (t."transferCompletedAt" - l."createdAt")) / 86400
        ) as avg_days
        FROM "Transaction" t
        JOIN "Listing" l ON t."listingId" = l.id
        WHERE t.status = 'COMPLETED'
        AND t."transferCompletedAt" IS NOT NULL
      `,
    ]);

    // Calculate average sale time in days (default to 7 if no data)
    const avgDays = avgSaleTime[0]?.avg_days
      ? Math.round(avgSaleTime[0].avg_days)
      : 7;

    return NextResponse.json({
      projectsSold: totalSales,
      totalVolume: totalVolume._sum.salePrice || 0,
      activeSellers,
      activeListings,
      avgSaleTime: avgDays,
    });
  } catch (error) {
    console.error("Error fetching platform stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
