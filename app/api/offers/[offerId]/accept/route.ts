import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calculatePlatformFee } from '@/lib/solana';

/**
 * POST /api/offers/[offerId]/accept
 * Accept an offer (seller only)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { offerId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
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
    if (offer.listing.sellerId !== session.user.id) {
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

    // Calculate fees (3% for APP token, 5% for others)
    const platformFee = calculatePlatformFee(offer.amount, offer.listing.currency);
    const sellerProceeds = offer.amount - platformFee;

    // Get buyer's wallet address for reservation tracking
    const buyerWithWallet = await prisma.user.findUnique({
      where: { id: offer.buyerId },
      select: { walletAddress: true },
    });

    // Update offer and create transaction
    const [updatedOffer, transaction] = await prisma.$transaction([
      // Accept offer
      prisma.offer.update({
        where: { id: offerId },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
      }),
      // Create transaction
      prisma.transaction.create({
        data: {
          listingId: offer.listingId,
          buyerId: offer.buyerId,
          sellerId: offer.listing.sellerId,
          salePrice: offer.amount,
          platformFee,
          sellerProceeds,
          currency: offer.listing.currency,
          paymentMethod: 'SOLANA',
          status: 'IN_ESCROW',
        },
      }),
      // Update listing status to RESERVED and set reserved buyer info
      prisma.listing.update({
        where: { id: offer.listingId },
        data: {
          status: 'RESERVED' as any,
          reservedBuyerId: offer.buyerId,
          reservedBuyerWallet: buyerWithWallet?.walletAddress || null,
          reservedAt: new Date(),
        } as any,
      }),
      // Cancel all other active offers on this listing
      prisma.offer.updateMany({
        where: {
          listingId: offer.listingId,
          id: { not: offerId },
          status: 'ACTIVE',
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
      }),
    ]);

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
