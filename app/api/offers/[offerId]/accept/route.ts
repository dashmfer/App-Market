import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calculatePlatformFee, safeAmountToLamports } from '@/lib/solana';
import { validateCsrfRequest, csrfError } from '@/lib/csrf';
import { withRateLimitAsync } from '@/lib/rate-limit';

/**
 * POST /api/offers/[offerId]/accept
 * Accept an offer (seller only)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { offerId: string } }
) {
  try {
    // SECURITY: CSRF validation
    const csrf = validateCsrfRequest(req);
    if (!csrf.valid) {
      return csrfError(csrf.error || 'CSRF validation failed');
    }

    // SECURITY: Rate limit financial operations
    const rateLimitResult = await (withRateLimitAsync('write', 'offer-accept'))(req);
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

    // Get offer with listing
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            sellerId: true,
            status: true,
            currency: true,
          },
        },
        buyer: {
          select: {
            id: true,
            name: true,
            email: true,
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

    // Only seller can accept
    if (offer.listing.sellerId !== session.id as string) {
      return NextResponse.json(
        { error: 'Only the seller can accept this offer' },
        { status: 403 }
      );
    }

    // Can only accept active offers
    if (offer.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Offer is not active' },
        { status: 400 }
      );
    }

    // Listing must be active
    if (offer.listing.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Listing is not active' },
        { status: 400 }
      );
    }

    // Check if offer has expired
    if (new Date() > offer.deadline) {
      // Auto-expire the offer
      await prisma.offer.update({
        where: { id: offerId },
        data: {
          status: 'EXPIRED',
          expiredAt: new Date(),
        },
      });

      return NextResponse.json(
        { error: 'Offer has expired' },
        { status: 400 }
      );
    }

    // SECURITY FIX: Use safeAmountToLamports to avoid floating-point precision loss
    const offerAmount = safeAmountToLamports(offer.amount);
    const platformFee = calculatePlatformFee(offerAmount, offer.listing.currency);
    const sellerProceeds = offerAmount - platformFee;

    // Get buyer's wallet address for reservation tracking
    const buyerWithWallet = await prisma.user.findUnique({
      where: { id: offer.buyerId },
      select: { walletAddress: true },
    });

    // Use interactive transaction to prevent race conditions (double-acceptance)
    const { updatedOffer, transaction } = await prisma.$transaction(async (tx) => {
      // Re-check listing status atomically to prevent concurrent accepts
      const freshListing = await tx.listing.findUnique({
        where: { id: offer.listingId },
        select: { status: true },
      });
      if (!freshListing || freshListing.status !== 'ACTIVE') {
        throw new Error('LISTING_NO_LONGER_ACTIVE');
      }

      // SECURITY FIX: Atomic offer status guard inside transaction to prevent double-accept race
      const offerGuard = await tx.offer.updateMany({
        where: { id: offerId, status: 'ACTIVE' },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });
      if (offerGuard.count === 0) {
        throw new Error('OFFER_NO_LONGER_ACTIVE');
      }

      const updatedOffer = await tx.offer.findUnique({
        where: { id: offerId },
      });

      const transaction = await tx.transaction.create({
        data: {
          listingId: offer.listingId,
          buyerId: offer.buyerId,
          sellerId: offer.listing.sellerId,
          salePrice: offerAmount,
          platformFee,
          sellerProceeds,
          currency: offer.listing.currency,
          paymentMethod: offer.listing.currency === "USDC" ? "USDC" : offer.listing.currency === "APP" ? "APP" : "SOL",
          status: 'IN_ESCROW',
        },
      });

      await tx.listing.update({
        where: { id: offer.listingId },
        data: {
          status: 'RESERVED' as any,
          reservedBuyerId: offer.buyerId,
          reservedBuyerWallet: buyerWithWallet?.walletAddress || null,
          reservedAt: new Date(),
        } as any,
      });

      await tx.offer.updateMany({
        where: {
          listingId: offer.listingId,
          id: { not: offerId },
          status: 'ACTIVE',
        },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });

      return { updatedOffer, transaction };
    });

    // Notify buyer that their offer was accepted
    await prisma.notification.create({
      data: {
        userId: offer.buyerId,
        type: 'OFFER_ACCEPTED',
        title: 'Offer Accepted!',
        message: `Your offer on "${offer.listing.title}" was accepted! The listing is now reserved for you.`,
        data: {
          offerId: offer.id,
          listingId: offer.listingId,
          transactionId: transaction.id,
        },
      },
    });

    return NextResponse.json({
      offer: updatedOffer,
      transaction,
    });
  } catch (error) {
    console.error('Error accepting offer:', error);
    return NextResponse.json(
      { error: 'Failed to accept offer' },
      { status: 500 }
    );
  }
}
