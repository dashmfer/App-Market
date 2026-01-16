import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  bio: z.string().max(500).optional(),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  discordHandle: z.string().max(50).optional(),
  image: z.string().url().optional(),
});

/**
 * GET /api/profile
 * Get current user's profile
 */
export async function GET(req: NextRequest) {
  try {
    // Use getAuthToken for JWT-based authentication (works better with credentials provider)
    const token = await getAuthToken(req);

    if (!token?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = token.id as string;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        image: true,
        bio: true,
        displayName: true,
        websiteUrl: true,
        discordHandle: true,
        walletAddress: true,
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
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/profile
 * Update current user's profile
 */
export async function PUT(req: NextRequest) {
  try {
    // Use getAuthToken for JWT-based authentication (works better with credentials provider)
    const token = await getAuthToken(req);

    if (!token?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = token.id as string;

    const body = await req.json();
    const validatedData = updateProfileSchema.parse(body);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: validatedData,
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        image: true,
        bio: true,
        displayName: true,
        websiteUrl: true,
        discordHandle: true,
        githubVerified: true,
        discordVerified: true,
        walletVerified: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
