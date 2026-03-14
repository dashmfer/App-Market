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
    // SECURITY: CSRF protection for financial state-changing endpoint
    const csrf = validateCsrfRequest(req);
    if (!csrf.valid) {
      return csrfError(csrf.error || "CSRF validation failed");
    }

    const token = await getAuthToken(req);

    if (!token?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { withdrawalId } = params;

    // Get withdrawal for authorization check
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
    if (withdrawal.userId !== (token!.id as string)) {
      return NextResponse.json(
        { error: 'Not authorized to claim this withdrawal' },
        { status: 403 }
      );
    }

    // SECURITY: Atomic update — prevents double-claim race condition by combining
    // the "not yet claimed" check and the update into a single atomic operation.
    // If two concurrent requests both pass the auth check above, only one will
    // match the WHERE clause (claimed: false) and actually perform the update.
    const updateResult = await prisma.pendingWithdrawal.updateMany({
      where: {
        id: withdrawalId,
        claimed: false, // Only claim if not already claimed
      },
      data: {
        claimed: true,
        claimedAt: new Date(),
      },
    });

    if (updateResult.count === 0) {
      return NextResponse.json(
        { error: 'Withdrawal already claimed' },
        { status: 400 }
      );
    }

    // Re-fetch the updated withdrawal for response
    const updatedWithdrawal = await prisma.pendingWithdrawal.findUnique({
      where: { id: withdrawalId },
    });

    // NOTE: The actual on-chain withdrawal should be handled by the smart contract
    // This endpoint just marks it as claimed in the database
    // The frontend should call the smart contract's withdraw_funds instruction

    await audit({
      action: "WITHDRAWAL_CLAIMED",
      severity: "INFO",
      userId: (token!.id as string),
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
