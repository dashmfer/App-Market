import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/profile/[userId]
 * Get user profile by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        username: true,
        image: true,
        bio: true,
        displayName: true,
        websiteUrl: true,
        discordHandle: true,
        githubUsername: true,
        githubVerified: true,
        discordVerified: true,
        walletVerified: true,
        totalSales: true,
        totalPurchases: true,
        totalVolume: true,
        rating: true,
        ratingCount: true,
        createdAt: true,
        // Get recent listings
        listings: {
          where: {
            status: {
              in: ['ACTIVE', 'SOLD', 'ENDED'],
            },
          },
          take: 6,
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            title: true,
            slug: true,
            thumbnailUrl: true,
            categories: true,
            status: true,
            startingPrice: true,
            buyNowPrice: true,
            currency: true,
          },
        },
        // Get reviews
        reviewsReceived: {
          take: 10,
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                username: true,
                image: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user profile' },
      { status: 500 }
    );
  }
}
