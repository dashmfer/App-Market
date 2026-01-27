import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = "force-dynamic";

/**
 * GET /api/withdrawals
 * Get current user's pending withdrawals
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const withdrawals = await prisma.pendingWithdrawal.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            slug: true,
            thumbnailUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate totals
    const unclaimed = withdrawals.filter(w => !w.claimed);
    const claimed = withdrawals.filter(w => w.claimed);
    const totalUnclaimed = unclaimed.reduce((sum, w) => sum + w.amount, 0);
    const totalClaimed = claimed.reduce((sum, w) => sum + w.amount, 0);

    return NextResponse.json({
      withdrawals,
      unclaimed,
      claimed,
      stats: {
        totalUnclaimed,
        totalClaimed,
        unclaimedCount: unclaimed.length,
        claimedCount: claimed.length,
      },
    });
  } catch (error) {
    console.error('Error fetching withdrawals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch withdrawals' },
      { status: 500 }
    );
  }
}
