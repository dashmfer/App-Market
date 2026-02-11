import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { validateCsrfRequest, csrfError } from '@/lib/csrf';
import { withRateLimitAsync, getClientIp } from "@/lib/rate-limit";
import { audit, auditContext } from '@/lib/audit';

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

    // SECURITY: Rate limit
    const rateLimitResult = await (withRateLimitAsync('write', 'offers'))(req);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: 429, headers: rateLimitResult.headers }
      );
    }

    const token = await getAuthToken(req);

    if (!token?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validatedData = createOfferSchema.parse(body);

    // Deadline must be in the future and within 30 days
    const deadlineDate = new Date(validatedData.deadline);
    if (deadlineDate <= new Date()) {
      return NextResponse.json(
        { error: 'Offer deadline must be in the future' },
        { status: 400 }
      );
    }
    const maxDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    if (deadlineDate > maxDeadline) {
      return NextResponse.json(
        { error: 'Offer deadline cannot be more than 30 days in the future' },
        { status: 400 }
      );
    }

    // Wrap listing check + offer count + offer create in Serializable transaction
    // to prevent race conditions (e.g., bypassing offer limits)
    const { offer, listing } = await prisma.$transaction(async (tx) => {
      // Check if listing exists and is active
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
        throw new Error('LISTING_NOT_FOUND');
      }

      if (listing.status !== 'ACTIVE') {
        throw new Error('LISTING_NOT_ACTIVE');
      }

      // Can't make offer on own listing
      if (listing.sellerId === token.id as string) {
        throw new Error('OWN_LISTING');
      }

      // SECURITY: Offers are currently database-only (no on-chain escrow).
      // To prevent spam offers that lock seller listings, enforce strict limits:
      // - Max 3 active offers per buyer per listing
      // - Max 10 total active offers per buyer across all listings
      const activeOffersOnListing = await tx.offer.count({
        where: {
          buyerId: token.id as string,
          listingId: validatedData.listingId,
          status: 'ACTIVE',
        },
      });

      if (activeOffersOnListing >= 3) {
        throw new Error('MAX_OFFERS_ON_LISTING');
      }

      const totalActiveOffers = await tx.offer.count({
        where: {
          buyerId: token.id as string,
          status: 'ACTIVE',
        },
      });

      if (totalActiveOffers >= 10) {
        throw new Error('MAX_TOTAL_OFFERS');
      }

      // TODO: Call Solana contract place_offer instruction to create on-chain escrow.
      // Without on-chain escrow, offers are not backed by locked funds.
      // Requires: Complete IDL, offer escrow PDA creation, buyer signature.

      // Create offer in database
      const offer = await tx.offer.create({
        data: {
          amount: validatedData.amount,
          deadline: new Date(validatedData.deadline),
          listingId: validatedData.listingId,
          buyerId: token.id as string,
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

      return { offer, listing };
    }, { isolationLevel: 'Serializable' });

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

    await audit({
      action: "OFFER_CREATED",
      severity: "INFO",
      userId: token.id as string,
      targetId: offer.id,
      targetType: "Offer",
      detail: `Offer of ${validatedData.amount} on listing ${validatedData.listingId}`,
      metadata: { listingId: validatedData.listingId, amount: validatedData.amount },
      ...auditContext(req.headers),
    });

    return NextResponse.json(offer, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      );
    }

    // Handle transaction validation errors
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage === 'LISTING_NOT_FOUND') {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }
    if (errorMessage === 'LISTING_NOT_ACTIVE') {
      return NextResponse.json({ error: 'Listing is not active' }, { status: 400 });
    }
    if (errorMessage === 'OWN_LISTING') {
      return NextResponse.json({ error: 'Cannot make offer on your own listing' }, { status: 400 });
    }
    if (errorMessage === 'MAX_OFFERS_ON_LISTING') {
      return NextResponse.json(
        { error: 'You already have the maximum of 3 active offers on this listing. Cancel an existing offer first.' },
        { status: 429 }
      );
    }
    if (errorMessage === 'MAX_TOTAL_OFFERS') {
      return NextResponse.json(
        { error: 'You have reached the maximum of 10 active offers. Cancel an existing offer first.' },
        { status: 429 }
      );
    }

    // Handle Solana contract errors

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
    const token = await getAuthToken(req);

    if (!token?.id) {
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
            sellerId: token.id as string,
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
        take: 50,
      });

      return NextResponse.json({ offers });
    } else {
      // Get offers made by the user
      const offers = await prisma.offer.findMany({
        where: {
          buyerId: token.id as string,
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
        take: 50,
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
