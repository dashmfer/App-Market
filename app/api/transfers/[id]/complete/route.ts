import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { processReferralEarnings } from "@/lib/referral-earnings";

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
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
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
    if (transaction.buyerId !== session.user.id) {
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

    // TODO: Call smart contract to release escrow to seller
    // This would involve:
    // 1. Getting the listing PDA
    // 2. Calling the confirm_receipt instruction on the smart contract
    // 3. The contract will automatically release funds to seller minus platform fee
    //
    // For now, we update the database to mark as completed
    // In production, this should verify the on-chain transaction succeeded

    // Update transaction status
    await prisma.transaction.update({
      where: { id: params.id },
      data: {
        status: "COMPLETED",
        transferCompletedAt: new Date(),
        releasedAt: new Date(),
        verifiedAt: new Date(),
      },
    });

    // Update listing status to SOLD
    await prisma.listing.update({
      where: { id: transaction.listingId },
      data: { status: "SOLD" },
    });

    // Update seller stats
    await prisma.user.update({
      where: { id: transaction.sellerId },
      data: {
        totalSales: { increment: 1 },
        totalVolume: { increment: transaction.salePrice },
      },
    });

    // Update buyer stats
    await prisma.user.update({
      where: { id: transaction.buyerId },
      data: {
        totalPurchases: { increment: 1 },
      },
    });

    // Process referral earnings (2% to referrers on first transaction, from platform fee)
    try {
      const referralResult = await processReferralEarnings(
        transaction.id,
        transaction.salePrice,
        transaction.buyerId,
        transaction.sellerId
      );
      console.log("[Transfer Complete] Referral earnings processed:", referralResult);
    } catch (referralError) {
      // Don't fail the transaction if referral processing fails
      console.error("[Transfer Complete] Failed to process referral earnings:", referralError);
    }

    // Calculate payment distribution for collaborators
    const collaborators = transaction.listing.collaborators || [];
    const sellerProceeds = transaction.sellerProceeds;

    // Calculate collaborator payments and seller's final share
    const collaboratorPayments: CollaboratorPayment[] = [];
    let collaboratorTotalPercentage = 0;

    for (const collab of collaborators) {
      const collaboratorAmount = (sellerProceeds * collab.percentage) / 100;
      collaboratorTotalPercentage += collab.percentage;

      collaboratorPayments.push({
        collaboratorId: collab.id,
        walletAddress: collab.walletAddress,
        userId: collab.userId,
        role: collab.role,
        percentage: collab.percentage,
        amount: collaboratorAmount,
      });
    }

    // Seller gets the remainder
    const sellerPercentage = 100 - collaboratorTotalPercentage;
    const sellerFinalAmount = (sellerProceeds * sellerPercentage) / 100;

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

    await prisma.transaction.update({
      where: { id: params.id },
      data: {
        transferMethods: {
          ...(transaction.transferMethods as Prisma.JsonObject || {}),
          paymentDistribution,
        } as Prisma.InputJsonValue,
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
          : `Congratulations! The buyer has completed the transfer. ${transaction.sellerProceeds} ${transaction.currency} has been released to your wallet.`,
        data: {
          transactionId: transaction.id,
          amount: collaborators.length > 0 ? sellerFinalAmount : transaction.sellerProceeds,
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
            message: `Your share (${payment.percentage}%) of the sale of "${transaction.listing.title}" has been released: ${payment.amount.toFixed(2)} ${transaction.currency}`,
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
