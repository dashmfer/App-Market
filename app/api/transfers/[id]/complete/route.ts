import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

interface ChecklistItem {
  id: string;
  required: boolean;
  sellerConfirmed: boolean;
  buyerConfirmed: boolean;
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
        listing: true,
        seller: {
          select: { walletAddress: true },
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

    // Notify seller
    await prisma.notification.create({
      data: {
        userId: transaction.sellerId,
        type: "PAYMENT_RECEIVED",
        title: "Payment Released!",
        message: `Congratulations! The buyer has completed the transfer. ${transaction.sellerProceeds} ${transaction.currency} has been released to your wallet.`,
        data: {
          transactionId: transaction.id,
          amount: transaction.sellerProceeds,
          currency: transaction.currency,
        },
      },
    });

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
