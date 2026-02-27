import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthToken } from '@/lib/auth';

/**
 * GET /api/offers/listing/[listingId]
 * Get offers for a specific listing (seller sees all, buyers see only their own)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { listingId: string } }
) {
  try {
    const session = await getAuthToken(req);
    if (!session?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { listingId } = params;
    const userId = session.id as string;

    // Check if user is the listing seller
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { sellerId: true },
    });

    if (!listing) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    // Seller sees all offers; others see only their own
    const where: { listingId: string; buyerId?: string } = { listingId };
    if (listing.sellerId !== userId) {
      where.buyerId = userId;
    }

    const offers = await prisma.offer.findMany({
      where,
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
  } catch (error) {
    console.error('Error fetching listing offers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch offers' },
      { status: 500 }
    );
  }
}
