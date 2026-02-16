import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { calculateDisputeFee, DISPUTE_FEE_BPS } from "@/lib/solana";
import { withRateLimitAsync, getClientIp } from "@/lib/rate-limit";

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
    // SECURITY: Rate limit
    const rateLimitResult = await (withRateLimitAsync('write', 'disputes'))(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: 429, headers: rateLimitResult.headers }
      );
    }

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

    if (typeof description !== "string" || description.length > 5000) {
      return NextResponse.json(
        { error: "Description must be 5000 characters or less" },
        { status: 400 }
      );
    }

    if (evidence && (!Array.isArray(evidence) || evidence.length > 20)) {
      return NextResponse.json(
        { error: "Evidence must be an array of at most 20 items" },
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
    const disputeFee = calculateDisputeFee(Number(transaction.salePrice));
    const respondentId = isBuyer ? transaction.sellerId : transaction.buyerId;

    // Atomically create dispute, update transaction status, and send notification.
    // This prevents races where two parties both open disputes simultaneously,
    // or where the transaction status changes between dispute creation and status update.
    const dispute = await prisma.$transaction(async (tx) => {
      // Re-check dispute doesn't exist (prevents race between two concurrent requests)
      const existingDispute = await tx.dispute.findUnique({
        where: { transactionId },
      });
      if (existingDispute) {
        throw new Error("DISPUTE_EXISTS");
      }

      const newDispute = await tx.dispute.create({
        data: {
          reason,
          description,
          initiatorEvidence: evidence ? { items: evidence } : undefined,
          status: "OPEN",
          disputeFee,
          transactionId,
          initiatorId: session.user.id,
          respondentId,
        },
      });

      await tx.transaction.update({
        where: { id: transactionId },
        data: { status: "DISPUTED" },
      });

      await tx.notification.create({
        data: {
          type: "DISPUTE_OPENED",
          title: "Dispute opened",
          message: `A dispute has been opened for "${transaction.listing.title}". Please respond within 3 days.`,
          data: { disputeId: newDispute.id, transactionId },
          userId: respondentId,
        },
      });

      return newDispute;
    }, { isolationLevel: 'Serializable' });

    return NextResponse.json({ dispute }, { status: 201 });
  } catch (error: any) {
    if (error?.message === "DISPUTE_EXISTS") {
      return NextResponse.json(
        { error: "Dispute already exists for this transaction" },
        { status: 400 }
      );
    }
    console.error("Error creating dispute:", error);
    return NextResponse.json(
      { error: "Failed to create dispute" },
      { status: 500 }
    );
  }
}
