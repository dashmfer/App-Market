import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
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

    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
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
    if (withdrawal.userId !== session.user.id) {
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

    // Update withdrawal status
    const updatedWithdrawal = await prisma.pendingWithdrawal.update({
      where: { id: withdrawalId },
      data: {
        claimed: true,
        claimedAt: new Date(),
      },
    });

    // NOTE: The actual on-chain withdrawal should be handled by the smart contract
    // This endpoint just marks it as claimed in the database
    // The frontend should call the smart contract's withdraw_funds instruction

    await audit({
      action: "WITHDRAWAL_CLAIMED",
      severity: "INFO",
      userId: session.user.id,
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
    console.error('Error claiming withdrawal:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to claim withdrawal' },
      { status: 500 }
    );
  }
}
