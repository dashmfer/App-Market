import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
    }

    // Only buyer can confirm receipt
    if (transaction.buyerId !== session.user.id) {
      return NextResponse.json(
        { error: "Only the buyer can confirm receipt" },
        { status: 403 }
      );
    }

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

    // Check if all required items are confirmed by both parties
    const allRequiredConfirmed = checklist
      .filter((item) => item.required)
      .every((item) => item.sellerConfirmed && item.buyerConfirmed);

    // Update transaction
    await prisma.transaction.update({
      where: { id: params.id },
      data: {
        transferChecklist: checklist,
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

    return NextResponse.json({
      success: true,
      checklist,
      allConfirmed: allRequiredConfirmed,
      message: "Receipt confirmed successfully",
    });
  } catch (error) {
    console.error("Error confirming buyer receipt:", error);
    return NextResponse.json(
      { error: "Failed to confirm receipt" },
      { status: 500 }
    );
  }
}
