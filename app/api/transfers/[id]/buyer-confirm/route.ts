import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

interface PartnerConfirmation {
  partnerId: string;
  confirmedAt: string;
}

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  iconType: string;
  required: boolean;
  sellerConfirmed: boolean;
  sellerConfirmedAt: string | null;
  sellerEvidence: string | null;
  buyerConfirmed: boolean;
  buyerConfirmedAt: string | null;
  // For partner purchases - track individual partner confirmations
  partnerConfirmations?: PartnerConfirmation[];
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

    const body = await request.json();
    const { itemId } = body;

    if (!itemId) {
      return NextResponse.json(
        { error: "Item ID is required" },
        { status: 400 }
      );
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: params.id },
      include: {
        partners: {
          where: { depositStatus: "DEPOSITED" },
          select: { id: true, userId: true, walletAddress: true },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
    }

    // Check if user is buyer or a purchase partner
    const isMainBuyer = transaction.buyerId === session.user.id;
    const userPartner = transaction.partners.find((p: { userId: string | null }) => p.userId === session.user.id);
    const isPartner = !!userPartner;

    if (!isMainBuyer && !isPartner) {
      return NextResponse.json(
        { error: "Only the buyer or purchase partners can confirm receipt" },
        { status: 403 }
      );
    }

    // Determine if this is a partner purchase (for majority vote logic)
    const hasPartners = transaction.hasPartners && transaction.partners.length > 0;

    // Get current checklist
    const checklist = transaction.transferChecklist as ChecklistItem[] | null;
    if (!checklist) {
      return NextResponse.json(
        { error: "Transfer checklist not initialized" },
        { status: 400 }
      );
    }

    // Find and update the item
    const itemIndex = checklist.findIndex((item) => item.id === itemId);
    if (itemIndex === -1) {
      return NextResponse.json(
        { error: "Checklist item not found" },
        { status: 404 }
      );
    }

    // Seller must confirm first
    if (!checklist[itemIndex].sellerConfirmed) {
      return NextResponse.json(
        { error: "Seller must confirm transfer first" },
        { status: 400 }
      );
    }

    // For partner purchases, handle individual confirmations and majority vote
    if (hasPartners) {
      const partnerConfirmations = checklist[itemIndex].partnerConfirmations || [];
      const partnerId = userPartner?.id || transaction.buyerId;

      // Check if this partner already confirmed
      if (partnerConfirmations.some(pc => pc.partnerId === partnerId)) {
        return NextResponse.json(
          { error: "You have already confirmed this item" },
          { status: 400 }
        );
      }

      // Add this partner's confirmation
      partnerConfirmations.push({
        partnerId,
        confirmedAt: new Date().toISOString(),
      });

      // Calculate majority (>50% of partners must confirm)
      const totalPartners = transaction.partners.length;
      const confirmationsNeeded = Math.floor(totalPartners / 2) + 1;
      const hasMajority = partnerConfirmations.length >= confirmationsNeeded;

      // Update the item
      checklist[itemIndex] = {
        ...checklist[itemIndex],
        partnerConfirmations,
        buyerConfirmed: hasMajority,
        buyerConfirmedAt: hasMajority ? new Date().toISOString() : null,
      };
    } else {
      // Single buyer - simple confirmation
      if (checklist[itemIndex].buyerConfirmed) {
        return NextResponse.json(
          { error: "Item already confirmed" },
          { status: 400 }
        );
      }

      // Update the item
      checklist[itemIndex] = {
        ...checklist[itemIndex],
        buyerConfirmed: true,
        buyerConfirmedAt: new Date().toISOString(),
      };
    }

    // Check if all required items are confirmed by both parties
    const allRequiredConfirmed = checklist
      .filter((item) => item.required)
      .every((item) => item.sellerConfirmed && item.buyerConfirmed);

    // Update transaction
    await prisma.transaction.update({
      where: { id: params.id },
      data: {
        transferChecklist: checklist as any,
        uploadsVerified: allRequiredConfirmed,
      },
    });

    // Create notification for seller
    await prisma.notification.create({
      data: {
        userId: transaction.sellerId,
        type: "TRANSFER_COMPLETED",
        title: "Transfer Confirmed",
        message: `The buyer has confirmed receipt of: ${checklist[itemIndex].label}`,
        data: {
          transactionId: transaction.id,
          itemId,
          allConfirmed: allRequiredConfirmed,
        },
      },
    });

    // Calculate partner confirmation stats for response
    const partnerStats = hasPartners ? {
      totalPartners: transaction.partners.length,
      confirmationsNeeded: Math.floor(transaction.partners.length / 2) + 1,
      currentConfirmations: checklist[itemIndex].partnerConfirmations?.length || 0,
      hasMajority: checklist[itemIndex].buyerConfirmed,
    } : null;

    return NextResponse.json({
      success: true,
      checklist,
      allConfirmed: allRequiredConfirmed,
      partnerStats,
      message: hasPartners
        ? `Confirmation recorded. ${partnerStats?.currentConfirmations}/${partnerStats?.totalPartners} partners confirmed.`
        : "Receipt confirmed successfully",
    });
  } catch (error) {
    console.error("Error confirming buyer receipt:", error);
    return NextResponse.json(
      { error: "Failed to confirm receipt" },
      { status: 500 }
    );
  }
}
