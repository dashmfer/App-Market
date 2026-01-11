import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// POST /api/transactions/[id]/confirm - Confirm transfer item
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const transactionId = params.id;
    const body = await request.json();
    const { asset, action, evidence } = body; // action: "sellerConfirm", "buyerConfirm", "buyerDispute"

    // Get transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        listing: true,
        buyer: true,
        seller: true,
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Check authorization
    const isBuyer = transaction.buyerId === session.user.id;
    const isSeller = transaction.sellerId === session.user.id;

    if (!isBuyer && !isSeller) {
      return NextResponse.json(
        { error: "Not authorized for this transaction" },
        { status: 403 }
      );
    }

    // Get current checklist
    const checklist = transaction.transferChecklist as Record<string, any>;
    
    if (!checklist[asset]) {
      return NextResponse.json(
        { error: "Invalid asset" },
        { status: 400 }
      );
    }

    // Update checklist based on action
    if (action === "sellerConfirm") {
      if (!isSeller) {
        return NextResponse.json(
          { error: "Only seller can mark as transferred" },
          { status: 403 }
        );
      }
      checklist[asset].confirmedBySeller = true;
      checklist[asset].sellerEvidence = evidence;
      checklist[asset].sellerConfirmedAt = new Date().toISOString();
    } else if (action === "buyerConfirm") {
      if (!isBuyer) {
        return NextResponse.json(
          { error: "Only buyer can confirm receipt" },
          { status: 403 }
        );
      }
      checklist[asset].confirmedByBuyer = true;
      checklist[asset].completed = true;
      checklist[asset].buyerConfirmedAt = new Date().toISOString();
    }

    // Update transaction
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        transferChecklist: checklist,
        status: "TRANSFER_IN_PROGRESS",
        transferStartedAt: transaction.transferStartedAt || new Date(),
      },
    });

    // Check if all items confirmed
    const allConfirmed = Object.values(checklist)
      .filter((item: any) => item !== null && item.required)
      .every((item: any) => item.completed);

    if (allConfirmed) {
      // All transfers complete - release escrow
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: "COMPLETED",
          transferCompletedAt: new Date(),
          releasedAt: new Date(),
        },
      });

      // Mint ownership NFT (placeholder - would call Solana program)
      // await mintOwnershipNFT(transaction);

      // Notify both parties
      await prisma.notification.create({
        data: {
          type: "TRANSFER_COMPLETED",
          title: "Transfer Complete!",
          message: `All assets for "${transaction.listing.title}" have been transferred successfully.`,
          data: { transactionId },
          userId: transaction.sellerId,
        },
      });

      await prisma.notification.create({
        data: {
          type: "TRANSFER_COMPLETED",
          title: "Transfer Complete!",
          message: `You now own "${transaction.listing.title}". Funds have been released to the seller.`,
          data: { transactionId },
          userId: transaction.buyerId,
        },
      });
    } else if (action === "sellerConfirm") {
      // Notify buyer to confirm
      await prisma.notification.create({
        data: {
          type: "TRANSFER_STARTED",
          title: "Asset transferred - Please confirm",
          message: `The seller has marked ${asset} as transferred for "${transaction.listing.title}". Please confirm receipt.`,
          data: { transactionId, asset },
          userId: transaction.buyerId,
        },
      });
    }

    return NextResponse.json({
      success: true,
      checklist,
      allConfirmed,
    });
  } catch (error) {
    console.error("Error confirming transfer:", error);
    return NextResponse.json(
      { error: "Failed to confirm transfer" },
      { status: 500 }
    );
  }
}
