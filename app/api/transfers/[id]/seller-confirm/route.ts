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
    const { itemId, evidence } = body;

    if (!itemId || !evidence) {
      return NextResponse.json(
        { error: "Item ID and evidence are required" },
        { status: 400 }
      );
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: params.id },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
    }

    // Only seller can confirm transfers
    if (transaction.sellerId !== session.user.id) {
      return NextResponse.json(
        { error: "Only the seller can confirm transfers" },
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

    if (checklist[itemIndex].sellerConfirmed) {
      return NextResponse.json(
        { error: "Item already confirmed" },
        { status: 400 }
      );
    }

    // Update the item
    checklist[itemIndex] = {
      ...checklist[itemIndex],
      sellerConfirmed: true,
      sellerConfirmedAt: new Date().toISOString(),
      sellerEvidence: evidence,
    };

    // Check if all required items are confirmed by seller
    const allRequiredSellerConfirmed = checklist
      .filter((item) => item.required)
      .every((item) => item.sellerConfirmed);

    // Update transaction
    await prisma.transaction.update({
      where: { id: params.id },
      data: {
        transferChecklist: checklist as unknown as Parameters<typeof prisma.transaction.update>[0]["data"]["transferChecklist"],
        sellerConfirmedTransfer: allRequiredSellerConfirmed,
        status: allRequiredSellerConfirmed ? "AWAITING_CONFIRMATION" : "TRANSFER_IN_PROGRESS",
        transferStartedAt: transaction.transferStartedAt || new Date(),
      },
    });

    // Create notification for buyer
    await prisma.notification.create({
      data: {
        userId: transaction.buyerId,
        type: "TRANSFER_STARTED",
        title: "Asset Transfer Update",
        message: `The seller has confirmed transfer of: ${checklist[itemIndex].label}`,
        data: {
          transactionId: transaction.id,
          itemId,
          evidence,
        },
      },
    });

    return NextResponse.json({
      success: true,
      checklist,
      message: "Transfer confirmed successfully",
    });
  } catch (error) {
    console.error("Error confirming seller transfer:", error);
    return NextResponse.json(
      { error: "Failed to confirm transfer" },
      { status: 500 }
    );
  }
}
