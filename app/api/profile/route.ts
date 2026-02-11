import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAuthToken, revokeAllUserSessions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { validateCsrfRequest, csrfError } from '@/lib/csrf';
import { audit, auditContext } from '@/lib/audit';

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  username: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/, "Username must be lowercase letters, numbers, and underscores only").optional(),
  bio: z.string().max(500).optional(),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  discordHandle: z.string().max(50).optional(),
  image: z.string().url().optional(),
});

/**
 * GET /api/profile
 * Get current user's profile
 */
export async function GET(req: NextRequest) {
  try {
    // Use getAuthToken for JWT-based authentication (works better with credentials provider)
    const token = await getAuthToken(req);

    if (!token?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = token.id as string;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        image: true,
        bio: true,
        displayName: true,
        websiteUrl: true,
        discordHandle: true,
        walletAddress: true,
        githubUsername: true,
        githubVerified: true,
        discordVerified: true,
        walletVerified: true,
        twitterUsername: true,
        twitterVerified: true,
        totalSales: true,
        totalPurchases: true,
        totalVolume: true,
        rating: true,
        ratingCount: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/profile
 * Update current user's profile
 */
export async function PUT(req: NextRequest) {
  try {
    // SECURITY: Validate CSRF token
    const csrfValidation = validateCsrfRequest(req);
    if (!csrfValidation.valid) {
      return csrfError(csrfValidation.error || 'CSRF validation failed');
    }

    // Use getAuthToken for JWT-based authentication (works better with credentials provider)
    const token = await getAuthToken(req);

    if (!token?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = token.id as string;

    const body = await req.json();
    const validatedData = updateProfileSchema.parse(body);

    // Check username uniqueness if being updated
    if (validatedData.username) {
      const existingUser = await prisma.user.findFirst({
        where: {
          username: validatedData.username,
          id: { not: userId },
        },
      });
      if (existingUser) {
        return NextResponse.json(
          { error: 'Username is already taken' },
          { status: 400 }
        );
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: validatedData,
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        image: true,
        bio: true,
        displayName: true,
        websiteUrl: true,
        discordHandle: true,
        githubVerified: true,
        discordVerified: true,
        walletVerified: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/profile
 * Soft-delete current user's account.
 * Sets deletedAt, anonymizes PII, revokes all sessions.
 * Preserves transaction/review/dispute records for financial integrity.
 */
export async function DELETE(req: NextRequest) {
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

    const userId = token.id as string;

    // Check for active transactions that would block deletion
    const activeTransactions = await prisma.transaction.count({
      where: {
        OR: [
          { buyerId: userId },
          { sellerId: userId },
        ],
        status: {
          in: ['PENDING', 'FUNDED', 'PAID', 'IN_ESCROW', 'TRANSFER_PENDING', 'TRANSFER_IN_PROGRESS', 'AWAITING_CONFIRMATION', 'DISPUTED', 'AWAITING_PARTNER_DEPOSITS'],
        },
      },
    });

    if (activeTransactions > 0) {
      return NextResponse.json(
        { error: 'Cannot delete account while you have active transactions. Complete or cancel them first.' },
        { status: 400 }
      );
    }

    // Check for active listings
    const activeListings = await prisma.listing.count({
      where: {
        sellerId: userId,
        status: { in: ['ACTIVE', 'RESERVED', 'PENDING_REVIEW', 'PENDING_COLLABORATORS'] },
      },
    });

    if (activeListings > 0) {
      return NextResponse.json(
        { error: 'Cannot delete account while you have active listings. Cancel them first.' },
        { status: 400 }
      );
    }

    // SECURITY [C2]: Soft-delete — anonymize ALL PII fields.
    // Preserves the row for FK integrity but removes every piece of
    // personally-identifiable information (GDPR right-to-erasure).
    const anonSuffix = crypto.randomBytes(8).toString("hex");
    await prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        displayName: "Deleted User",
        name: null,
        bio: null,
        image: null,
        websiteUrl: null,
        discordHandle: null,
        discordVerified: false,
        // [C2] Fields that were previously not anonymized:
        email: null,
        username: `deleted_${anonSuffix}`,  // Must stay unique, so randomize
        walletAddress: null,
        twitterId: null,
        twitterUsername: null,
        twitterVerified: false,
        twitterLinkedAt: null,
        githubId: null,
        githubUsername: null,
        githubVerified: false,
        walletVerified: false,
        privyUserId: null,
      },
    });

    // Revoke all sessions so the user is logged out everywhere
    await revokeAllUserSessions(userId, "account_deleted");

    // Deactivate API keys
    await prisma.apiKey.updateMany({
      where: { userId },
      data: { isActive: false },
    });

    // Deactivate webhooks
    await prisma.webhook.updateMany({
      where: { userId },
      data: { isActive: false },
    });

    await audit({
      action: "USER_PROFILE_UPDATED",
      severity: "WARN",
      userId,
      targetId: userId,
      targetType: "User",
      detail: "Account soft-deleted by user",
      ...auditContext(req.headers),
    });

    return NextResponse.json({ success: true, message: 'Account deleted' });
  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    );
  }
}
