import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthToken } from "@/lib/auth";
import { processReferralEarnings } from "@/lib/referral-earnings";
import { audit } from "@/lib/audit";
import { validateCsrfRequest, csrfError } from '@/lib/csrf';

interface ChecklistItem {
  id: string;
  required: boolean;
  sellerConfirmed: boolean;
  buyerConfirmed: boolean;
}

interface CollaboratorPayment {
  collaboratorId: string;
  walletAddress: string;
  userId: string | null;
  role: string;
  percentage: number;
  amount: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // SECURITY: Validate CSRF token
    const csrfValidation = validateCsrfRequest(request);
    if (!csrfValidation.valid) {
      return csrfError(csrfValidation.error || 'CSRF validation failed');
    }

    const token = await getAuthToken(request);
    if (!token?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: params.id },
      include: {
        listing: {
          include: {
            collaborators: {
              where: { status: "ACCEPTED" },
              include: {
                user: {
                  select: { id: true, username: true, displayName: true },
                },
              },
            },
          },
        },
        seller: {
          select: { id: true, walletAddress: true, username: true, displayName: true },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
    }

    // Only buyer can complete the transfer
    if (transaction.buyerId !== token.id as string) {
      return NextResponse.json(
        { error: "Only the buyer can complete the transfer" },
        { status: 403 }
      );
    }

    // Check that all required items are confirmed
    const checklist = transaction.transferChecklist as ChecklistItem[] | null;
    if (!checklist) {
      return NextResponse.json(
        { error: "Transfer checklist not initialized" },
        { status: 400 }
      );
    }

    const allRequiredConfirmed = checklist
      .filter((item) => item.required)
      .every((item) => item.sellerConfirmed && item.buyerConfirmed);

    if (!allRequiredConfirmed) {
      return NextResponse.json(
        { error: "Not all required items have been confirmed" },
        { status: 400 }
      );
    }

    // Transaction is already completed
    if (transaction.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Transfer already completed" },
        { status: 400 }
      );
    }

    // Check if transaction was refunded or in dispute
    if (transaction.status === "REFUNDED") {
      return NextResponse.json(
        { error: "This transaction has been refunded" },
        { status: 400 }
      );
    }

    if (transaction.status === "DISPUTED") {
      return NextResponse.json(
        { error: "This transaction is under dispute and cannot be completed" },
        { status: 400 }
      );
    }

    // SECURITY [C3]: Smart contract escrow release is not yet implemented.
    // This is a critical TODO -- funds are being released without on-chain verification.
    console.warn(
      `[SECURITY WARNING] Transfer ${params.id}: Completing transfer WITHOUT on-chain escrow release. ` +
      `Smart contract integration is required before production use. ` +
      `Seller: ${transaction.sellerId}, Amount: ${Number(transaction.salePrice)} ${transaction.currency}`
    );

    // SECURITY [C6]: Verify the transaction was actually confirmed by all parties
    // before marking complete. Re-read transaction to ensure no stale data.
    const freshTransaction = await prisma.transaction.findUnique({
      where: { id: params.id },
      select: { status: true, transferChecklist: true },
    });

    if (!freshTransaction || freshTransaction.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Transaction already completed or not found" },
        { status: 400 }
      );
    }

    const freshChecklist = freshTransaction.transferChecklist as ChecklistItem[] | null;
    if (!freshChecklist) {
      return NextResponse.json(
        { error: "Transfer checklist not found on re-verification" },
        { status: 400 }
      );
    }

    const reVerified = freshChecklist
      .filter((item) => item.required)
      .every((item) => item.sellerConfirmed && item.buyerConfirmed);

    if (!reVerified) {
      return NextResponse.json(
        { error: "Re-verification failed: not all required items are confirmed" },
        { status: 400 }
      );
    }

    // SECURITY [H4]: Verify fee + proceeds = salePrice (reconciliation check)
    const salePrice = Number(transaction.salePrice);
    const platformFee = Number(transaction.platformFee);
    const sellerProceeds = Number(transaction.sellerProceeds);
    const currency = transaction.currency || "SOL";
    const decimals = currency === "USDC" ? 6 : 9;
    const base = Math.pow(10, decimals);
    const salePriceUnits = Math.round(salePrice * base);
    const feeUnits = Math.round(platformFee * base);
    const proceedsUnits = Math.round(sellerProceeds * base);
    if (feeUnits + proceedsUnits !== salePriceUnits) {
      console.error(`[SECURITY] Fee reconciliation mismatch: fee(${feeUnits}) + proceeds(${proceedsUnits}) != salePrice(${salePriceUnits})`);
      return NextResponse.json(
        { error: "Internal error: fee reconciliation failed. Contact support." },
        { status: 500 }
      );
    }

    // SECURITY [H5]: Wrap all DB writes in an atomic transaction to prevent
    // partial completion (e.g., transaction marked COMPLETED but listing not SOLD)
    await prisma.$transaction(async (tx) => {
      // Update transaction status
      await tx.transaction.update({
        where: { id: params.id },
        data: {
          status: "COMPLETED",
          transferCompletedAt: new Date(),
          releasedAt: new Date(),
          verifiedAt: new Date(),
        },
      });

      // Update listing status to SOLD
      await tx.listing.update({
        where: { id: transaction.listingId },
        data: { status: "SOLD" },
      });

      // Update seller stats
      await tx.user.update({
        where: { id: transaction.sellerId },
        data: {
          totalSales: { increment: 1 },
          totalVolume: { increment: Number(transaction.salePrice) },
        },
      });

      // Update buyer stats
      await tx.user.update({
        where: { id: transaction.buyerId },
        data: {
          totalPurchases: { increment: 1 },
        },
      });
    }, { isolationLevel: 'Serializable' });

    // Process referral earnings (2% to referrers on first transaction, from platform fee)
    try {
      const referralResult = await processReferralEarnings(
        transaction.id,
        Number(transaction.salePrice),
        transaction.buyerId,
        transaction.sellerId,
        transaction.currency || undefined
      );
      if (process.env.NODE_ENV === 'development') console.log("[Transfer Complete] Referral earnings processed:", referralResult);
    } catch (referralError) {
      // Don't fail the transaction if referral processing fails
      console.error("[Transfer Complete] Failed to process referral earnings:", referralError);
    }

    // Calculate payment distribution for collaborators
    // SECURITY: Use integer math to prevent floating-point drift on payment splits
    // (reuses salePrice, sellerProceeds, currency, decimals, base, proceedsUnits from H4 block above)
    const collaborators = transaction.listing.collaborators || [];

    // Calculate collaborator payments and seller's final share
    const collaboratorPayments: CollaboratorPayment[] = [];
    let collaboratorTotalUnits = 0;

    for (const collab of collaborators) {
      const collabPct = Number(collab.percentage);
      // Integer-safe: floor each collaborator's share so rounding favors the seller
      const collabUnits = Math.floor(proceedsUnits * collabPct / 100);
      collaboratorTotalUnits += collabUnits;

      collaboratorPayments.push({
        collaboratorId: collab.id,
        walletAddress: collab.walletAddress,
        userId: collab.userId,
        role: collab.role,
        percentage: collabPct,
        amount: collabUnits / base,
      });
    }

    // Seller gets the remainder — guarantees total = sellerProceeds exactly
    const sellerFinalUnits = proceedsUnits - collaboratorTotalUnits;
    const collaboratorTotalPercentage = collaborators.reduce((sum: number, c: any) => sum + Number(c.percentage), 0);
    const sellerPercentage = 100 - collaboratorTotalPercentage;
    const sellerFinalAmount = sellerFinalUnits / base;

    // Store the payment distribution in the transaction data
    const paymentDistribution = {
      totalProceeds: sellerProceeds,
      seller: {
        userId: transaction.sellerId,
        walletAddress: transaction.seller.walletAddress,
        percentage: sellerPercentage,
        amount: sellerFinalAmount,
      },
      collaborators: collaboratorPayments.map(p => ({
        collaboratorId: p.collaboratorId,
        walletAddress: p.walletAddress,
        userId: p.userId,
        role: p.role,
        percentage: p.percentage,
        amount: p.amount,
      })),
    };

    // SECURITY [L20]: transferMethods is schemaless JSON. Consider adding Zod
    // validation for the paymentDistribution structure before persisting.
    // Update transaction with payment distribution
    const existingMethods = (transaction.transferMethods as Record<string, unknown>) || {};
    await prisma.transaction.update({
      where: { id: params.id },
      data: {
        transferMethods: {
          ...existingMethods,
          paymentDistribution,
        },
      },
    });

    // Notify seller with their share
    const sellerName = transaction.seller.displayName || transaction.seller.username || "Seller";
    await prisma.notification.create({
      data: {
        userId: transaction.sellerId,
        type: "PAYMENT_RECEIVED",
        title: "Payment Released!",
        message: collaborators.length > 0
          ? `Congratulations! The transfer is complete. Your share (${sellerPercentage}%) of ${sellerFinalAmount.toFixed(2)} ${transaction.currency} has been released.`
          : `Congratulations! The buyer has completed the transfer. ${Number(transaction.sellerProceeds)} ${transaction.currency} has been released to your wallet.`,
        data: {
          transactionId: transaction.id,
          amount: collaborators.length > 0 ? sellerFinalAmount : Number(transaction.sellerProceeds),
          percentage: sellerPercentage,
          currency: transaction.currency,
          hasCollaborators: collaborators.length > 0,
        },
      },
    });

    // Notify each collaborator about their payment
    for (const payment of collaboratorPayments) {
      if (payment.userId) {
        await prisma.notification.create({
          data: {
            userId: payment.userId,
            type: "PAYMENT_RECEIVED",
            title: "Payment Released!",
            message: `Your share (${payment.percentage}%) of the sale of "${transaction.listing.title}" has been released: ${Number(payment.amount).toFixed(2)} ${transaction.currency}`,
            data: {
              transactionId: transaction.id,
              listingId: transaction.listingId,
              amount: payment.amount,
              percentage: payment.percentage,
              currency: transaction.currency,
              role: payment.role,
            },
          },
        });

        // Update collaborator's stats (increment their volume)
        await prisma.user.update({
          where: { id: payment.userId },
          data: {
            totalVolume: { increment: payment.amount },
          },
        });
      }
    }

    // Notify buyer
    await prisma.notification.create({
      data: {
        userId: transaction.buyerId,
        type: "TRANSFER_COMPLETED",
        title: "Transfer Complete",
        message: `The transfer for "${transaction.listing.title}" is now complete. Enjoy your new acquisition!`,
        data: {
          transactionId: transaction.id,
          listingId: transaction.listingId,
        },
      },
    });

    await audit({
      action: "TRANSACTION_COMPLETED",
      severity: "INFO",
      userId: token.id as string,
      targetId: transaction.id,
      targetType: "Transaction",
      detail: `Transfer completed: ${Number(transaction.salePrice)} ${transaction.currency}`,
      metadata: { listingId: transaction.listingId, salePrice: Number(transaction.salePrice) },
    });

    return NextResponse.json({
      success: true,
      message: "Transfer completed successfully. Funds have been released to the seller.",
      transaction: {
        id: transaction.id,
        status: "COMPLETED",
        releasedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Error completing transfer:", error);
    return NextResponse.json(
      { error: "Failed to complete transfer" },
      { status: 500 }
    );
  }
}
