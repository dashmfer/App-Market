import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/offers/[offerId]/cancel
 * Cancel an offer (buyer only)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { offerId: string } }
) {
  try {
    const token = await getAuthToken(req);

    if (!token?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { offerId } = params;

    // Get offer
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        listing: {
          select: {
            title: true,
            sellerId: true,
          },
        },
      },
    });

    if (!offer) {
      return NextResponse.json(
        { error: 'Offer not found' },
        { status: 404 }
      );
    }

    // Only buyer can cancel
    if (offer.buyerId !== token.id as string) {
      return NextResponse.json(
        { error: 'Only the buyer can cancel this offer' },
        { status: 403 }
      );
    }

    // Can only cancel active offers
    if (offer.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Offer is not active' },
        { status: 400 }
      );
    }

    // Update offer status
    const updatedOffer = await prisma.offer.update({
      where: { id: offerId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    // Notify seller
    await prisma.notification.create({
      data: {
        userId: offer.listing.sellerId,
        type: 'SYSTEM',
        title: 'Offer Cancelled',
        message: `An offer on "${offer.listing.title}" was cancelled`,
        data: {
          offerId: offer.id,
          listingId: offer.listingId,
        },
      },
    });

    return NextResponse.json(updatedOffer);
  } catch (error) {
    console.error('Error cancelling offer:', error);
    return NextResponse.json(
      { error: 'Failed to cancel offer' },
      { status: 500 }
    );
  }
}
