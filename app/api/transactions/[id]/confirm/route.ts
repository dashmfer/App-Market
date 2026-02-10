import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hashEvidence } from "@/lib/validation";

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
    const { asset, action, evidence } = body; // action: "sellerConfirm", "buyerConfirm", "partnerConfirm"

    // Get transaction with partners for majority voting
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        listing: true,
        buyer: true,
        seller: true,
        partners: {
          where: { depositStatus: "DEPOSITED" },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // SECURITY: Validate transaction state allows confirmation
    const allowedStates = ['FUNDED', 'PAID', 'IN_ESCROW', 'TRANSFER_PENDING', 'TRANSFER_IN_PROGRESS', 'AWAITING_CONFIRMATION'];
    if (!allowedStates.includes(transaction.status)) {
      return NextResponse.json(
        { error: `Cannot confirm transfers in state: ${transaction.status}` },
        { status: 400 }
      );
    }

    // Check authorization - include partners for group purchases
    const isBuyer = transaction.buyerId === session.user.id;
    const isSeller = transaction.sellerId === session.user.id;
    const userPartner = transaction.partners.find((p: { userId: string | null }) => p.userId === session.user.id);
    const isPartner = !!userPartner;

    if (!isBuyer && !isSeller && !isPartner) {
      return NextResponse.json(
        { error: "Not authorized for this transaction" },
        { status: 403 }
      );
    }

    // Get current checklist (array format)
    const checklist = transaction.transferChecklist as Array<{
      id: string;
      label: string;
      description: string;
      iconType: string;
      required: boolean;
      sellerConfirmed: boolean;
      sellerConfirmedAt: string | null;
      sellerEvidence: string | null;
      sellerEvidenceHash?: string | null;
      buyerConfirmed: boolean;
      buyerConfirmedAt: string | null;
      partnerConfirmations?: Record<string, { confirmed: boolean; confirmedAt: string }>;
      majorityVote?: { totalVoters: number; confirmedCount: number; majorityNeeded: number; hasMajority: boolean };
    }>;

    if (!checklist || !Array.isArray(checklist)) {
      return NextResponse.json(
        { error: "Transfer checklist not initialized" },
        { status: 400 }
      );
    }

    const itemIndex = checklist.findIndex(item => item.id === asset);
    if (itemIndex === -1) {
      return NextResponse.json(
        { error: "Invalid asset" },
        { status: 400 }
      );
    }
    const item = checklist[itemIndex];

    // Update checklist based on action
    if (action === "sellerConfirm") {
      if (!isSeller) {
        return NextResponse.json(
          { error: "Only seller can mark as transferred" },
          { status: 403 }
        );
      }
      // SECURITY: Hash evidence for integrity
      const evidenceHash = evidence ? hashEvidence(evidence) : null;
      item.sellerConfirmed = true;
      item.sellerEvidence = evidence;
      item.sellerEvidenceHash = evidenceHash;
      item.sellerConfirmedAt = new Date().toISOString();
    } else if (action === "buyerConfirm" || action === "partnerConfirm") {
      // For group purchases, use majority voting
      if (transaction.hasPartners && transaction.partners.length > 0) {
        // Partner or lead buyer confirmation
        if (!isBuyer && !isPartner) {
          return NextResponse.json(
            { error: "Only buyer or partners can confirm receipt" },
            { status: 403 }
          );
        }

        // Track individual partner confirmation
        if (isPartner && userPartner) {
          await prisma.transactionPartner.update({
            where: { id: userPartner.id },
            data: {
              hasConfirmedTransfer: true,
              confirmedAt: new Date(),
            },
          });
        }

        // Track lead buyer confirmation separately
        if (isBuyer) {
          // Initialize partnerConfirmations if not present
          if (!item.partnerConfirmations) {
            item.partnerConfirmations = {};
          }
          item.partnerConfirmations.leadBuyer = {
            confirmed: true,
            confirmedAt: new Date().toISOString(),
          };
        }

        // Count confirmations for majority vote
        const updatedPartners = await prisma.transactionPartner.findMany({
          where: {
            transactionId,
            depositStatus: "DEPOSITED",
          },
        });

        const totalVoters = updatedPartners.length + 1; // Partners + lead buyer
        const confirmedCount = updatedPartners.filter((p: { hasConfirmedTransfer: boolean }) => p.hasConfirmedTransfer).length +
          (item.partnerConfirmations?.leadBuyer?.confirmed ? 1 : 0);
        const majorityNeeded = Math.floor(totalVoters / 2) + 1;

        item.majorityVote = {
          totalVoters,
          confirmedCount,
          majorityNeeded,
          hasMajority: confirmedCount >= majorityNeeded,
        };

        // Only mark as completed if majority reached
        if (confirmedCount >= majorityNeeded) {
          item.buyerConfirmed = true;
          item.buyerConfirmedAt = new Date().toISOString();
        }
      } else {
        // Single buyer - direct confirmation
        if (!isBuyer) {
          return NextResponse.json(
            { error: "Only buyer can confirm receipt" },
            { status: 403 }
          );
        }
        item.buyerConfirmed = true;
        item.buyerConfirmedAt = new Date().toISOString();
      }
    }

    // Update the item in the array
    checklist[itemIndex] = item;

    // Update transaction
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        transferChecklist: checklist,
        status: "TRANSFER_IN_PROGRESS",
        transferStartedAt: transaction.transferStartedAt || new Date(),
      },
    });

    // Check if all required items confirmed by both parties
    const allConfirmed = checklist
      .filter(item => item.required)
      .every(item => item.sellerConfirmed && item.buyerConfirmed);

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

      // Update seller stats
      await prisma.user.update({
        where: { id: transaction.sellerId },
        data: {
          totalSales: { increment: 1 },
          totalVolume: { increment: Number(transaction.salePrice) },
        },
      });

      // Update buyer stats
      await prisma.user.update({
        where: { id: transaction.buyerId },
        data: {
          totalPurchases: { increment: 1 },
          totalVolume: { increment: Number(transaction.salePrice) },
        },
      });

      // Notify seller
      await prisma.notification.create({
        data: {
          type: "TRANSFER_COMPLETED",
          title: "Transfer Complete!",
          message: `All assets for "${transaction.listing.title}" have been transferred successfully.`,
          data: { transactionId },
          userId: transaction.sellerId,
        },
      });

      // Notify buyer
      await prisma.notification.create({
        data: {
          type: "TRANSFER_COMPLETED",
          title: "Transfer Complete!",
          message: `You now own "${transaction.listing.title}". Funds have been released to the seller.`,
          data: { transactionId },
          userId: transaction.buyerId,
        },
      });

      // Notify all partners
      if (transaction.hasPartners) {
        for (const partner of transaction.partners) {
          if (partner.userId) {
            await prisma.notification.create({
              data: {
                type: "TRANSFER_COMPLETED",
                title: "Transfer Complete!",
                message: `Your group purchase of "${transaction.listing.title}" is complete. Assets have been transferred.`,
                data: { transactionId },
                userId: partner.userId,
              },
            });
          }
        }
      }
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

      // Also notify partners
      if (transaction.hasPartners) {
        for (const partner of transaction.partners) {
          if (partner.userId) {
            await prisma.notification.create({
              data: {
                type: "TRANSFER_STARTED",
                title: "Asset transferred - Vote to confirm",
                message: `The seller has marked ${asset} as transferred for "${transaction.listing.title}". Please vote to confirm receipt.`,
                data: { transactionId, asset },
                userId: partner.userId,
              },
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      checklist,
      allConfirmed,
      majorityVote: item.majorityVote || null,
    });
  } catch (error) {
    console.error("Error confirming transfer:", error);
    return NextResponse.json(
      { error: "Failed to confirm transfer" },
      { status: 500 }
    );
  }
}
