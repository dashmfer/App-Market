import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { validateCsrfRequest, csrfError } from '@/lib/csrf';

const createOfferSchema = z.object({
  listingId: z.string(),
  amount: z.number().positive(),
  deadline: z.string().datetime(),
});

/**
 * POST /api/offers
 * Create a new offer on a listing
 */
export async function POST(req: NextRequest) {
  try {
    // SECURITY: Validate CSRF token for state-changing request
    const csrfValidation = validateCsrfRequest(req);
    if (!csrfValidation.valid) {
      return csrfError(csrfValidation.error || 'CSRF validation failed');
    }

    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validatedData = createOfferSchema.parse(body);

    // Check if listing exists and is active
    const listing = await prisma.listing.findUnique({
      where: { id: validatedData.listingId },
      select: {
        id: true,
        title: true,
        status: true,
        sellerId: true,
      },
    });

    if (!listing) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    if (listing.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Listing is not active' },
        { status: 400 }
      );
    }

    // Can't make offer on own listing
    if (listing.sellerId === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot make offer on your own listing' },
        { status: 400 }
      );
    }

    // TODO: Call Solana contract place_offer instruction here
    // This will throw MaxConsecutiveOffersExceeded if buyer has 10 consecutive offers

    // Create offer in database
    const offer = await prisma.offer.create({
      data: {
        amount: validatedData.amount,
        deadline: new Date(validatedData.deadline),
        listingId: validatedData.listingId,
        buyerId: session.user.id,
        status: 'ACTIVE',
      },
      include: {
        buyer: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
          },
        },
        listing: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });

    // Create notification for seller
    await prisma.notification.create({
      data: {
        userId: listing.sellerId,
        type: 'SYSTEM',
        title: 'New Offer Received',
        message: `You received an offer of ${validatedData.amount} SOL on "${listing.title}"`,
        data: {
          offerId: offer.id,
          listingId: listing.id,
          amount: validatedData.amount,
        },
      },
    });

    return NextResponse.json(offer, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      );
    }

    // Handle Solana contract errors
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check for MaxConsecutiveOffersExceeded error from contract
    if (errorMessage.includes('MaxConsecutiveOffersExceeded') ||
        errorMessage.includes('Maximum consecutive offers')) {
      return NextResponse.json(
        {
          error: 'You have reached the maximum of 10 consecutive offers on this listing. Please cancel one of your existing offers or wait for another buyer to outbid you.',
          code: 'MAX_CONSECUTIVE_OFFERS'
        },
        { status: 429 } // 429 Too Many Requests
      );
    }

    console.error('Error creating offer:', error);
    return NextResponse.json(
      { error: 'Failed to create offer' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/offers
 * Get current user's offers
 * Query params:
 * - type=received: offers on user's listings
 * - type=sent: offers user has made (default)
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

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'sent';

    if (type === 'received') {
      // Get offers on listings owned by the user
      const offers = await prisma.offer.findMany({
        where: {
          listing: {
            sellerId: session.user.id,
          },
        },
        include: {
          buyer: {
            select: {
              id: true,
              name: true,
              username: true,
              image: true,
            },
          },
          listing: {
            select: {
              id: true,
              title: true,
              slug: true,
              thumbnailUrl: true,
              status: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return NextResponse.json({ offers });
    } else {
      // Get offers made by the user
      const offers = await prisma.offer.findMany({
        where: {
          buyerId: session.user.id,
        },
        include: {
          buyer: {
            select: {
              id: true,
              name: true,
              username: true,
              image: true,
            },
          },
          listing: {
            select: {
              id: true,
              title: true,
              slug: true,
              thumbnailUrl: true,
              status: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return NextResponse.json({ offers });
    }
  } catch (error) {
    console.error('Error fetching offers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch offers' },
      { status: 500 }
    );
  }
}
