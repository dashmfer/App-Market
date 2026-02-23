import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { audit, auditContext } from '@/lib/audit';
import { validateCsrfRequest, csrfError } from '@/lib/csrf';
import { withRateLimitAsync } from '@/lib/rate-limit';

/**
 * POST /api/withdrawals/[withdrawalId]/claim
 * Claim a pending withdrawal
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { withdrawalId: string } }
) {
  try {
    // SECURITY: Validate CSRF token for state-changing financial request
    const csrfValidation = validateCsrfRequest(req);
    if (!csrfValidation.valid) {
      return csrfError(csrfValidation.error || 'CSRF validation failed');
    }

    // SECURITY: Rate limit withdrawal claims
    const rateLimitResult = await (withRateLimitAsync('write', 'withdrawal-claim'))(req);
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

    const { withdrawalId } = params;

    // Get withdrawal
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

    if (!withdrawal) {
      return NextResponse.json(
        { error: 'Withdrawal not found' },
        { status: 404 }
      );
    }

    // Only owner can claim
    if (withdrawal.userId !== session.id as string) {
      return NextResponse.json(
        { error: 'Not authorized to claim this withdrawal' },
        { status: 403 }
      );
    }

    // Already claimed
    if (withdrawal.claimed) {
      return NextResponse.json(
        { error: 'Withdrawal already claimed' },
        { status: 400 }
      );
    }

    // SECURITY: Atomic claim - use updateMany with claimed: false condition
    // to prevent double-claim race condition between concurrent requests
    const claimResult = await prisma.pendingWithdrawal.updateMany({
      where: { id: withdrawalId, claimed: false },
      data: {
        claimed: true,
        claimedAt: new Date(),
      },
    });

    if (claimResult.count === 0) {
      return NextResponse.json(
        { error: 'Withdrawal already claimed' },
        { status: 409 }
      );
    }

    const updatedWithdrawal = await prisma.pendingWithdrawal.findUnique({
      where: { id: withdrawalId },
    });

    // NOTE: The actual on-chain withdrawal should be handled by the smart contract
    // This endpoint just marks it as claimed in the database
    // The frontend should call the smart contract's withdraw_funds instruction

    await audit({
      action: "WITHDRAWAL_CLAIMED",
      severity: "INFO",
      userId: session.id as string,
      targetId: withdrawalId,
      targetType: "PendingWithdrawal",
      detail: `Withdrawal claimed: ${Number(withdrawal.amount)} ${withdrawal.currency}`,
      metadata: { amount: Number(withdrawal.amount), listingId: withdrawal.listingId },
    });

    return NextResponse.json({
      success: true,
      withdrawal: updatedWithdrawal,
      message: 'Withdrawal claimed successfully',
    });
  } catch (error) {
    console.error('Error claiming withdrawal:', error);
    return NextResponse.json(
      { error: 'Failed to claim withdrawal' },
      { status: 500 }
    );
  }
}
