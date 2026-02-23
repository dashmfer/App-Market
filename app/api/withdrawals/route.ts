import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = "force-dynamic";

/**
 * GET /api/withdrawals
 * Get current user's pending withdrawals
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthToken(req);

    if (!session?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const withdrawals = await prisma.pendingWithdrawal.findMany({
      where: {
        userId: session.id as string,
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
      take: 50,
    });

    // Calculate totals
    const unclaimed = withdrawals.filter((w: { claimed: boolean }) => !w.claimed);
    const claimed = withdrawals.filter((w: { claimed: boolean }) => w.claimed);
    const totalUnclaimed = unclaimed.reduce((sum: number, w: any) => sum + Number(w.amount), 0);
    const totalClaimed = claimed.reduce((sum: number, w: any) => sum + Number(w.amount), 0);

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
