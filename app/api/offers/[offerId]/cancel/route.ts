import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateCsrfRequest, csrfError } from '@/lib/csrf';
import { withRateLimitAsync } from "@/lib/rate-limit";

/**
 * POST /api/offers/[offerId]/cancel
 * Cancel an offer (buyer only)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { offerId: string } }
) {
  try {
    // SECURITY: CSRF validation for state-changing endpoint
    const csrf = validateCsrfRequest(req);
    if (!csrf.valid) {
      return csrfError(csrf.error || 'CSRF validation failed');
    }

    const rateLimitResult = await (withRateLimitAsync('write', 'offer-cancel'))(req);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: 429, headers: rateLimitResult.headers }
      );
    }

    const session = await getAuthToken(req);

    if (!session?.id) {
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
    if (offer.buyerId !== session.id as string) {
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

    // SECURITY FIX WA-7: Atomic update with status guard to prevent TOCTOU race
    const cancelResult = await prisma.offer.updateMany({
      where: { id: offerId, status: 'ACTIVE' },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    if (cancelResult.count === 0) {
      return NextResponse.json(
        { error: 'Offer is no longer active' },
        { status: 409 }
      );
    }

    const updatedOffer = await prisma.offer.findUnique({
      where: { id: offerId },
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
