import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "sellers"; // sellers, buyers, or rated
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);

    if (type === "sellers") {
      // Top sellers by total sales
      const topSellers = await prisma.user.findMany({
        where: {
          totalSales: { gt: 0 },
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          name: true,
          image: true,
          isVerified: true,
          totalSales: true,
          rating: true,
          ratingCount: true,
          sellerLevel: true,
          successRate: true,
          createdAt: true,
        },
        orderBy: { totalSales: "desc" },
        take: limit,
      });

      return NextResponse.json({
        type: "sellers",
        leaderboard: topSellers.map((user: typeof topSellers[number], index: number) => ({
          rank: index + 1,
          id: user.id,
          username: user.username,
          displayName: user.displayName || user.name,
          image: user.image,
          isVerified: user.isVerified,
          totalSales: user.totalSales,
          rating: user.rating,
          ratingCount: user.ratingCount,
          sellerLevel: user.sellerLevel,
          successRate: user.successRate,
          memberSince: user.createdAt,
        })),
      });
    }

    if (type === "buyers") {
      // Top buyers by total purchases
      const topBuyers = await prisma.user.findMany({
        where: {
          totalPurchases: { gt: 0 },
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          name: true,
          image: true,
          isVerified: true,
          totalPurchases: true,
          rating: true,
          ratingCount: true,
          createdAt: true,
        },
        orderBy: { totalPurchases: "desc" },
        take: limit,
      });

      return NextResponse.json({
        type: "buyers",
        leaderboard: topBuyers.map((user: typeof topBuyers[number], index: number) => ({
          rank: index + 1,
          id: user.id,
          username: user.username,
          displayName: user.displayName || user.name,
          image: user.image,
          isVerified: user.isVerified,
          totalPurchases: user.totalPurchases,
          rating: user.rating,
          ratingCount: user.ratingCount,
          memberSince: user.createdAt,
        })),
      });
    }

    if (type === "rated") {
      // Top rated users (minimum 3 reviews)
      const topRated = await prisma.user.findMany({
        where: {
          ratingCount: { gte: 3 },
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          name: true,
          image: true,
          isVerified: true,
          totalSales: true,
          rating: true,
          ratingCount: true,
          sellerLevel: true,
          createdAt: true,
        },
        orderBy: [{ rating: "desc" }, { ratingCount: "desc" }],
        take: limit,
      });

      return NextResponse.json({
        type: "rated",
        leaderboard: topRated.map((user: typeof topRated[number], index: number) => ({
          rank: index + 1,
          id: user.id,
          username: user.username,
          displayName: user.displayName || user.name,
          image: user.image,
          isVerified: user.isVerified,
          totalSales: user.totalSales,
          rating: user.rating,
          ratingCount: user.ratingCount,
          sellerLevel: user.sellerLevel,
          memberSince: user.createdAt,
        })),
      });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error: any) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
