import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { calculateDisputeFee, DISPUTE_FEE_BPS } from "@/lib/solana";

// GET /api/disputes - Get user's disputes
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const disputes = await prisma.dispute.findMany({
      where: {
        OR: [
          { initiatorId: session.user.id },
          { respondentId: session.user.id },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        transaction: {
          include: {
            listing: {
              select: {
                id: true,
                slug: true,
                title: true,
                thumbnailUrl: true,
              },
            },
          },
        },
        initiator: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
        respondent: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    });

    return NextResponse.json({ disputes });
  } catch (error) {
    console.error("Error fetching disputes:", error);
    return NextResponse.json(
      { error: "Failed to fetch disputes" },
      { status: 500 }
    );
  }
}

// POST /api/disputes - Open a dispute
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { transactionId, reason, description, evidence } = body;

    // Validate
    if (!transactionId || !reason || !description) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        listing: true,
        buyer: true,
        seller: true,
        dispute: true,
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Check if user is part of transaction
    const isBuyer = transaction.buyerId === session.user.id;
    const isSeller = transaction.sellerId === session.user.id;

    if (!isBuyer && !isSeller) {
      return NextResponse.json(
        { error: "Not authorized for this transaction" },
        { status: 403 }
      );
    }

    // Check if dispute already exists
    if (transaction.dispute) {
      return NextResponse.json(
        { error: "Dispute already exists for this transaction" },
        { status: 400 }
      );
    }

    // Check transaction status
    const validStatuses = ["IN_ESCROW", "TRANSFER_PENDING", "TRANSFER_IN_PROGRESS", "AWAITING_CONFIRMATION"];
    if (!validStatuses.includes(transaction.status)) {
      return NextResponse.json(
        { error: "Cannot dispute a transaction in this status" },
        { status: 400 }
      );
    }

    // Calculate dispute fee (2% of sale price)
    const disputeFee = calculateDisputeFee(transaction.salePrice);

    // Create dispute with standard 2% fee
    const dispute = await prisma.dispute.create({
      data: {
        reason,
        description,
        initiatorEvidence: evidence ? { items: evidence } : undefined,
        status: "OPEN",
        disputeFee,
        transactionId,
        initiatorId: session.user.id,
        respondentId: isBuyer ? transaction.sellerId : transaction.buyerId,
      },
    });

    // Update transaction status
    await prisma.transaction.update({
      where: { id: transactionId },
      data: { status: "DISPUTED" },
    });

    // Notify the other party
    const respondentId = isBuyer ? transaction.sellerId : transaction.buyerId;
    await prisma.notification.create({
      data: {
        type: "DISPUTE_OPENED",
        title: "Dispute opened",
        message: `A dispute has been opened for "${transaction.listing.title}". Please respond within 3 days.`,
        data: { disputeId: dispute.id, transactionId },
        userId: respondentId,
      },
    });

    return NextResponse.json({ dispute }, { status: 201 });
  } catch (error) {
    console.error("Error creating dispute:", error);
    return NextResponse.json(
      { error: "Failed to create dispute" },
      { status: 500 }
    );
  }
}
