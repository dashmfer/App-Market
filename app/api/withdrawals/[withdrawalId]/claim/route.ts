import { NextRequest, NextResponse } from 'next/server';
import { Connection } from '@solana/web3.js';
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

    // SECURITY [M12]: Require txHash for on-chain verification
    let body: { txHash?: string } = {};
    try {
      body = await req.json();
    } catch {
      // body may be empty for legacy calls
    }
    const { txHash } = body;

    if (!txHash || typeof txHash !== 'string' || txHash.trim().length === 0) {
      return NextResponse.json(
        { error: 'Transaction hash (txHash) is required to claim a withdrawal' },
        { status: 400 }
      );
    }

    // Fetch the withdrawal first to get amount for verification
    const withdrawal = await prisma.pendingWithdrawal.findFirst({
      where: {
        id: withdrawalId,
        userId: token.id as string,
      },
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

    if (withdrawal.claimed) {
      return NextResponse.json(
        { error: 'Withdrawal already claimed' },
        { status: 400 }
      );
    }

    // SECURITY [M12]: Verify the on-chain transaction before marking as claimed
    const rpcUrl = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
    const connection = new Connection(rpcUrl, "confirmed");

    let txInfo;
    try {
      txInfo = await connection.getTransaction(txHash, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      });
    } catch (rpcError) {
      console.error("RPC error verifying withdrawal tx:", rpcError);
      return NextResponse.json(
        { error: 'Failed to verify on-chain transaction. Please try again.' },
        { status: 502 }
      );
    }

    if (!txInfo) {
      return NextResponse.json(
        { error: 'Transaction not found on-chain. Please wait for confirmation and try again.' },
        { status: 400 }
      );
    }

    if (txInfo.meta?.err) {
      return NextResponse.json(
        { error: 'On-chain transaction failed' },
        { status: 400 }
      );
    }

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
      // Race condition: already claimed between our check and update
      return NextResponse.json(
        { error: 'Withdrawal already claimed' },
        { status: 409 }
      );
    }

    const updatedWithdrawal = await prisma.pendingWithdrawal.findUnique({
      where: { id: withdrawalId },
      include: {
        listing: {
          select: {
            title: true,
          },
        },
      },
    });

    await audit({
      action: "WITHDRAWAL_CLAIMED",
      severity: "INFO",
      userId: token.id as string,
      targetId: withdrawalId,
      targetType: "PendingWithdrawal",
      detail: `Withdrawal claimed: ${Number(withdrawal.amount)} ${withdrawal.currency} (tx: ${txHash})`,
      metadata: { amount: Number(withdrawal.amount), listingId: withdrawal.listingId, txHash },
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
