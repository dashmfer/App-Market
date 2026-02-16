import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { validateCsrfRequest, csrfError } from '@/lib/csrf';
import { withRateLimitAsync, getClientIp } from "@/lib/rate-limit";

const MAX_OFFER_AMOUNT = 1_000_000; // 1M SOL cap to prevent overflow in fee calculations

const createOfferSchema = z.object({
  listingId: z.string(),
  amount: z.number().positive().max(MAX_OFFER_AMOUNT, `Offer amount cannot exceed ${MAX_OFFER_AMOUNT}`),
  deadline: z.string().datetime(),
  onChainTx: z.string().min(32).max(128).optional(),
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

    // SECURITY: Rate limit
    const rateLimitResult = await (withRateLimitAsync('write', 'offers'))(req);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: 429, headers: rateLimitResult.headers }
      );
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

    // Deadline must be in the future
    if (new Date(validatedData.deadline) <= new Date()) {
      return NextResponse.json(
        { error: 'Offer deadline must be in the future' },
        { status: 400 }
      );
    }

    // On-chain escrow: Buyer signs place_offer tx on frontend, sends tx hash here.
    // If onChainTx is provided, the offer is backed by locked funds on-chain.
    // PRE-MAINNET: Once on-chain escrow is fully wired, reject offers without onChainTx.
    const onChainTx = validatedData.onChainTx || null;

    // Use a serializable transaction to prevent race condition where listing
    // becomes sold between the check and the offer creation.
    const result = await prisma.$transaction(async (tx) => {
      const listing = await tx.listing.findUnique({
        where: { id: validatedData.listingId },
        select: {
          id: true,
          title: true,
          status: true,
          sellerId: true,
        },
      });

      if (!listing) {
        return { error: 'Listing not found', status: 404 } as const;
      }

      if (listing.status !== 'ACTIVE') {
        return { error: 'Listing is not active', status: 400 } as const;
      }

      if (listing.sellerId === session.user.id) {
        return { error: 'Cannot make offer on your own listing', status: 400 } as const;
      }

      const offer = await tx.offer.create({
        data: {
          amount: validatedData.amount,
          deadline: new Date(validatedData.deadline),
          listingId: validatedData.listingId,
          buyerId: session.user.id,
          status: 'ACTIVE',
          ...(onChainTx ? { onChainTx } : {}),
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

      // Create notification for seller within the same transaction
      await tx.notification.create({
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

      return { offer, listing } as const;
    }, { isolationLevel: 'Serializable' });

    if ('error' in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    const { offer } = result;

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
