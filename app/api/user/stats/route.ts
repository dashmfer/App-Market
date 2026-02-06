import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/user/stats - Get current user's dashboard stats
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch all stats in parallel
    const [
      user,
      activeListings,
      pendingTransfers,
      pendingTransferDetails,
      recentActivity,
      activeListingsData,
    ] = await Promise.all([
      // User stats
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          totalSales: true,
          totalPurchases: true,
          totalVolume: true,
          rating: true,
          ratingCount: true,
        },
      }),

      // Count active listings (owned or as accepted collaborator, not expired)
      prisma.listing.count({
        where: {
          AND: [
            { status: "ACTIVE" },
            { endTime: { gt: new Date() } },
            {
              OR: [
                { sellerId: userId },
                {
                  collaborators: {
                    some: {
                      userId: userId,
                      status: "ACCEPTED",
                    },
                  },
                },
              ],
            },
          ],
        },
      }),

      // Count pending transfers (as seller or buyer)
      prisma.transaction.count({
        where: {
          OR: [{ sellerId: userId }, { buyerId: userId }],
          status: {
            in: ["TRANSFER_PENDING", "TRANSFER_IN_PROGRESS", "IN_ESCROW"],
          },
        },
      }),

      // Pending transfer details (IDs for linking)
      prisma.transaction.findMany({
        where: {
          OR: [{ sellerId: userId }, { buyerId: userId }],
          status: {
            in: ["TRANSFER_PENDING", "TRANSFER_IN_PROGRESS", "IN_ESCROW"],
          },
        },
        select: {
          id: true,
          listing: { select: { title: true } },
          status: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),

      // Recent activity (notifications)
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          data: true,
          read: true,
          createdAt: true,
        },
      }),

      // Active listings with bid info (owned or as accepted collaborator, not expired)
      prisma.listing.findMany({
        where: {
          AND: [
            { status: "ACTIVE" },
            { endTime: { gt: new Date() } },
            {
              OR: [
                { sellerId: userId },
                {
                  collaborators: {
                    some: {
                      userId: userId,
                      status: "ACCEPTED",
                    },
                  },
                },
              ],
            },
          ],
        },
        orderBy: { endTime: "asc" },
        take: 5,
        select: {
          id: true,
          slug: true,
          title: true,
          endTime: true,
          startingPrice: true,
          sellerId: true,
          bids: {
            orderBy: { amount: "desc" },
            take: 1,
            select: { amount: true },
          },
          _count: {
            select: { bids: true },
          },
        },
      }),
    ]);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Transform active listings
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const listings = activeListingsData.map((listing: typeof activeListingsData[number]) => {
      const endTime = new Date(listing.endTime);
      let status = "active";

      if (endTime <= now) {
        status = "expired";
      } else if (endTime <= in24Hours) {
        status = "ending_soon";
      }

      return {
        id: listing.id,
        slug: listing.slug,
        title: listing.title,
        endTime: listing.endTime,
        currentBid: listing.bids[0]?.amount || listing.startingPrice,
        bidCount: listing._count.bids,
        status,
      };
    });

    // Transform activity
    const activity = recentActivity.map((notif: typeof recentActivity[number]) => {
      let type = "system";
      if (notif.type.includes("BID")) type = "bid";
      else if (notif.type.includes("SALE") || notif.type.includes("COMPLETED")) type = "sale";
      else if (notif.type.includes("TRANSFER")) type = "transfer";

      return {
        id: notif.id,
        type,
        title: notif.title,
        message: notif.message,
        amount: (notif.data as any)?.amount || null,
        time: notif.createdAt,
      };
    });

    return NextResponse.json({
      stats: {
        totalSales: user.totalSales,
        totalPurchases: user.totalPurchases,
        totalVolume: Number(user.totalVolume),
        activeListings,
        pendingTransfers,
        rating: user.rating,
        ratingCount: user.ratingCount,
      },
      recentActivity: activity,
      activeListings: listings,
      pendingTransferDetails,
    });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch user stats" },
      { status: 500 }
    );
  }
}
