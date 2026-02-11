import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calculatePlatformFee } from '@/lib/solana';
import { validateCsrfRequest, csrfError } from '@/lib/csrf';

/**
 * POST /api/offers/[offerId]/accept
 * Accept an offer (seller only)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { offerId: string } }
) {
  try {
    // SECURITY: Validate CSRF token
    const csrfValidation = validateCsrfRequest(req);
    if (!csrfValidation.valid) {
      return csrfError(csrfValidation.error || 'CSRF validation failed');
    }

    const token = await getAuthToken(req);

    if (!token?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { offerId } = params;

    // Use Serializable transaction to prevent race conditions (double-acceptance, TOCTOU)
    const { updatedOffer, transaction, offer } = await prisma.$transaction(async (tx) => {
      // Get offer with listing (inside transaction to eliminate TOCTOU)
      const offer = await tx.offer.findUnique({
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
        throw new Error('OFFER_NOT_FOUND');
      }

      // Only seller can accept
      if (offer.listing.sellerId !== (token.id as string)) {
        throw new Error('NOT_SELLER');
      }

      // Can only accept active offers
      if (offer.status !== 'ACTIVE') {
        throw new Error('OFFER_NOT_ACTIVE');
      }

      // Listing must be active
      if (offer.listing.status !== 'ACTIVE') {
        throw new Error('LISTING_NOT_ACTIVE');
      }

      // Check if offer has expired
      if (new Date() > offer.deadline) {
        // Auto-expire the offer
        await tx.offer.update({
          where: { id: offerId },
          data: {
            status: 'EXPIRED',
            expiredAt: new Date(),
          },
        });

        throw new Error('OFFER_EXPIRED');
      }

      // Calculate fees (3% for APP token, 5% for others)
      const platformFee = calculatePlatformFee(Number(offer.amount), offer.currency);
      const sellerProceeds = Number(offer.amount) - platformFee;

      // Get buyer's wallet address for reservation tracking
      const buyerWithWallet = await tx.user.findUnique({
        where: { id: offer.buyerId },
        select: { walletAddress: true },
      });

      const updatedOffer = await tx.offer.update({
        where: { id: offerId },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });

      // SECURITY: Since offers are not backed by on-chain escrow, the
      // transaction starts as PENDING (awaiting buyer payment), not IN_ESCROW.
      // The buyer must complete the on-chain payment before escrow is confirmed.
      const transaction = await tx.transaction.create({
        data: {
          listingId: offer.listingId,
          buyerId: offer.buyerId,
          sellerId: offer.listing.sellerId,
          salePrice: Number(offer.amount),
          platformFee,
          sellerProceeds,
          currency: offer.currency,
          paymentMethod: offer.currency === "USDC" ? "USDC" : offer.currency === "APP" ? "APP" : "SOL",
          status: 'PENDING',
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

      return { updatedOffer, transaction, offer };
    }, { isolationLevel: 'Serializable' });

    // Notify buyer that their offer was accepted
    await prisma.notification.create({
      data: {
        userId: offer.buyerId,
        type: 'OFFER_ACCEPTED',
        title: 'Offer Accepted!',
        message: `Your offer on "${offer.listing.title}" was accepted! Please complete payment to finalize the purchase.`,
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
    const message = error instanceof Error ? error.message : '';
    if (message === 'OFFER_NOT_FOUND') {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }
    if (message === 'NOT_SELLER') {
      return NextResponse.json({ error: 'Only the seller can accept this offer' }, { status: 403 });
    }
    if (message === 'OFFER_NOT_ACTIVE') {
      return NextResponse.json({ error: 'Offer is not active' }, { status: 400 });
    }
    if (message === 'LISTING_NOT_ACTIVE' || message === 'LISTING_NO_LONGER_ACTIVE') {
      return NextResponse.json({ error: 'Listing is not active' }, { status: 400 });
    }
    if (message === 'OFFER_EXPIRED') {
      return NextResponse.json({ error: 'Offer has expired' }, { status: 400 });
    }
    console.error('Error accepting offer:', error);
    return NextResponse.json(
      { error: 'Failed to accept offer' },
      { status: 500 }
    );
  }
}
