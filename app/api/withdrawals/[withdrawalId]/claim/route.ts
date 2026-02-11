import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { validateCsrfRequest, csrfError } from '@/lib/csrf';

/**
 * POST /api/withdrawals/[withdrawalId]/claim
 * Claim a pending withdrawal
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { withdrawalId: string } }
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

    const { withdrawalId } = params;

    // Atomic check-and-update: only claim if not yet claimed and belongs to user
    const result = await prisma.pendingWithdrawal.updateMany({
      where: {
        id: withdrawalId,
        userId: token.id as string,
        claimed: false, // Atomic: only update if not yet claimed
      },
      data: {
        claimed: true,
        claimedAt: new Date(),
      },
    });

    if (result.count === 0) {
      // Either doesn't exist, wrong user, or already claimed
      return NextResponse.json(
        { error: 'Withdrawal not found or already claimed' },
        { status: 404 }
      );
    }

    // Fetch the updated withdrawal for audit logging
    const withdrawal = await prisma.pendingWithdrawal.findUnique({
      where: { id: withdrawalId },
      include: {
        listing: {
          select: {
            title: true,
          },
        },
      },
    });

    const updatedWithdrawal = withdrawal;

    // NOTE: The actual on-chain withdrawal should be handled by the smart contract
    // This endpoint just marks it as claimed in the database
    // The frontend should call the smart contract's withdraw_funds instruction

    if (withdrawal) {
      await audit({
        action: "WITHDRAWAL_CLAIMED",
        severity: "INFO",
        userId: token.id as string,
        targetId: withdrawalId,
        targetType: "PendingWithdrawal",
        detail: `Withdrawal claimed: ${Number(withdrawal.amount)} ${withdrawal.currency}`,
        metadata: { amount: Number(withdrawal.amount), listingId: withdrawal.listingId },
      });
    }

    return NextResponse.json({
      success: true,
      withdrawal: updatedWithdrawal,
      message: 'Withdrawal claimed successfully',
    });
  } catch (error) {
    console.error('Error claiming withdrawal:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to claim withdrawal' },
      { status: 500 }
    );
  }
}
