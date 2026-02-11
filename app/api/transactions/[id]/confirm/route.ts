import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthToken } from "@/lib/auth";
import { hashEvidence, isValidUUID } from "@/lib/validation";
import { validateCsrfRequest, csrfError } from '@/lib/csrf';

// POST /api/transactions/[id]/confirm - Confirm transfer item
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
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const transactionId = params.id;

    // SECURITY [M13]: Validate UUID format
    if (!isValidUUID(transactionId)) {
      return NextResponse.json(
        { error: "Invalid ID format" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { asset, action, evidence } = body; // action: "sellerConfirm", "buyerConfirm", "partnerConfirm"

    // SECURITY [M2]: Wrap the entire read-modify-write in a Serializable transaction
    // to prevent race conditions on checklist confirm operations
    const { transaction, checklist, allConfirmed, majorityVoteResult } = await prisma.$transaction(async (tx) => {
      // Get transaction with partners for majority voting
      const transaction = await tx.transaction.findUnique({
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
        throw new Error("TRANSACTION_NOT_FOUND");
      }

      // Validate transaction state allows confirmation
      const allowedStates = ['FUNDED', 'PAID', 'IN_ESCROW', 'TRANSFER_PENDING', 'TRANSFER_IN_PROGRESS', 'AWAITING_CONFIRMATION'];
      if (!allowedStates.includes(transaction.status)) {
        throw new Error(`INVALID_STATE:${transaction.status}`);
      }

      // Check authorization - include partners for group purchases
      const isBuyer = transaction.buyerId === token.id as string;
      const isSeller = transaction.sellerId === token.id as string;
      const userPartner = transaction.partners.find((p: { userId: string | null }) => p.userId === token.id as string);
      const isPartner = !!userPartner;

      if (!isBuyer && !isSeller && !isPartner) {
        throw new Error("NOT_AUTHORIZED");
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
        throw new Error("CHECKLIST_NOT_INITIALIZED");
      }

      const itemIndex = checklist.findIndex(item => item.id === asset);
      if (itemIndex === -1) {
        throw new Error("INVALID_ASSET");
      }
      const item = checklist[itemIndex];

      // Update checklist based on action
      if (action === "sellerConfirm") {
        if (!isSeller) {
          throw new Error("ONLY_SELLER");
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
            throw new Error("ONLY_BUYER_OR_PARTNERS");
          }

          // Track individual partner confirmation
          if (isPartner && userPartner) {
            await tx.transactionPartner.update({
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
          const updatedPartners = await tx.transactionPartner.findMany({
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
            throw new Error("ONLY_BUYER");
          }
          item.buyerConfirmed = true;
          item.buyerConfirmedAt = new Date().toISOString();
        }
      }

      // Update the item in the array
      checklist[itemIndex] = item;

      // Update transaction
      await tx.transaction.update({
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
        // Guard: re-check the transaction isn't already COMPLETED (prevent double-increment)
        if (transaction.status !== 'COMPLETED') {
          // All transfers complete - release escrow
          await tx.transaction.update({
            where: { id: transactionId },
            data: {
              status: "COMPLETED",
              transferCompletedAt: new Date(),
              releasedAt: new Date(),
            },
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
              totalVolume: { increment: Number(transaction.salePrice) },
            },
          });
        }
      }

      return { transaction, checklist, allConfirmed, majorityVoteResult: item.majorityVote || null };
    }, { isolationLevel: 'Serializable' });

    if (allConfirmed) {
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
      majorityVote: majorityVoteResult,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage === "TRANSACTION_NOT_FOUND") {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    if (errorMessage.startsWith("INVALID_STATE:")) {
      const state = errorMessage.split(":")[1];
      return NextResponse.json({ error: `Cannot confirm transfers in state: ${state}` }, { status: 400 });
    }
    if (errorMessage === "NOT_AUTHORIZED") {
      return NextResponse.json({ error: "Not authorized for this transaction" }, { status: 403 });
    }
    if (errorMessage === "CHECKLIST_NOT_INITIALIZED") {
      return NextResponse.json({ error: "Transfer checklist not initialized" }, { status: 400 });
    }
    if (errorMessage === "INVALID_ASSET") {
      return NextResponse.json({ error: "Invalid asset" }, { status: 400 });
    }
    if (errorMessage === "ONLY_SELLER") {
      return NextResponse.json({ error: "Only seller can mark as transferred" }, { status: 403 });
    }
    if (errorMessage === "ONLY_BUYER_OR_PARTNERS") {
      return NextResponse.json({ error: "Only buyer or partners can confirm receipt" }, { status: 403 });
    }
    if (errorMessage === "ONLY_BUYER") {
      return NextResponse.json({ error: "Only buyer can confirm receipt" }, { status: 403 });
    }

    console.error("Error confirming transfer:", error);
    return NextResponse.json(
      { error: "Failed to confirm transfer" },
      { status: 500 }
    );
  }
}
