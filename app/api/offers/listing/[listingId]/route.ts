import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthToken } from '@/lib/auth';

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

    // SECURITY: Require auth — only the listing seller can view all offers
    const token = await getAuthToken(req);
    if (!token?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify caller is the seller
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { sellerId: true },
    });
    if (!listing || listing.sellerId !== token.id as string) {
      return NextResponse.json({ error: "Only the seller can view listing offers" }, { status: 403 });
    }

    const offers = await prisma.offer.findMany({
      where: {
        listingId,
        buyer: { deletedAt: null },
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
      take: 100,
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
