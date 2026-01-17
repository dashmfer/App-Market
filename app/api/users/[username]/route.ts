import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    // Try to find by username first, then by ID
    let user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        name: true,
        displayName: true,
        username: true,
        image: true,
        bio: true,
        isVerified: true,
        totalSales: true,
        createdAt: true,
        listings: {
          where: {
            status: "ACTIVE",
          },
          select: {
            id: true,
            slug: true,
            title: true,
            tagline: true,
            thumbnailUrl: true,
            category: true,
            techStack: true,
            startingPrice: true,
            buyNowPrice: true,
            buyNowEnabled: true,
            endTime: true,
            currentBid: true,
            _count: {
              select: { bids: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    // If not found by username, try finding by ID
    if (!user) {
      user = await prisma.user.findUnique({
        where: { id: username },
        select: {
          id: true,
          name: true,
          displayName: true,
          username: true,
          image: true,
          bio: true,
          isVerified: true,
          totalSales: true,
          createdAt: true,
          listings: {
            where: {
              status: "ACTIVE",
            },
            select: {
              id: true,
              slug: true,
              title: true,
              tagline: true,
              thumbnailUrl: true,
              category: true,
              techStack: true,
              startingPrice: true,
              buyNowPrice: true,
              buyNowEnabled: true,
              endTime: true,
              currentBid: true,
              _count: {
                select: { bids: true },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}
