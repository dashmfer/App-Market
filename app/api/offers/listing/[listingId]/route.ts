import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/offers/listing/[listingId]
 * Get all offers for a specific listing
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { listingId: string } }
) {
  try {
    const { listingId } = params;

    const offers = await prisma.offer.findMany({
      where: {
        listingId,
      },
      include: {
        buyer: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
            rating: true,
            totalPurchases: true,
          },
        },
      },
      orderBy: {
        amount: 'desc', // Highest offers first
      },
    });

    return NextResponse.json(offers);
  } catch (error: any) {
    console.error('Error fetching listing offers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch offers' },
      { status: 500 }
    );
  }
}
