import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthToken } from "@/lib/auth";
import { hashEvidence, isValidUUID } from "@/lib/validation";
import { audit, auditContext } from "@/lib/audit";
import { validateCsrfRequest, csrfError } from '@/lib/csrf';

// POST /api/disputes/[id]/resolve - Resolve a dispute (admin only for now)
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

    const disputeId = params.id;

    // SECURITY [M13]: Validate UUID format
    if (!isValidUUID(disputeId)) {
      return NextResponse.json(
        { error: "Invalid ID format" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { resolution, notes } = body;

    // Get dispute
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        transaction: {
          include: {
            listing: true,
            buyer: true,
            seller: true,
          },
        },
        initiator: true,
        respondent: true,
      },
    });

    if (!dispute) {
      return NextResponse.json(
        { error: "Dispute not found" },
        { status: 404 }
      );
    }

    // SECURITY: Only admin can resolve disputes
    const currentUser = await prisma.user.findUnique({
      where: { id: token.id as string },
      select: { isAdmin: true },
    });

    if (!currentUser?.isAdmin) {
      return NextResponse.json(
        { error: "Admin access required to resolve disputes" },
        { status: 403 }
      );
    }

    // SECURITY: Can't resolve already resolved disputes
    if (dispute.status === "RESOLVED") {
      return NextResponse.json(
        { error: "Dispute has already been resolved" },
        { status: 400 }
      );
    }

    // Valid resolutions
    const validResolutions = ["FULL_REFUND", "PARTIAL_REFUND", "RELEASE_TO_SELLER", "EXTEND_DEADLINE"];
    if (!validResolutions.includes(resolution)) {
      return NextResponse.json(
        { error: "Invalid resolution" },
        { status: 400 }
      );
    }

    const transaction = dispute.transaction;

    // Apply resolution
    let newTransactionStatus = transaction.status;
    let buyerRefund = 0;
    let sellerPayout = 0;
    let feeCharged = false;

    // SECURITY: Dispute fee must be accounted for in refund calculations
    const disputeFeeAmount = Number(dispute.disputeFee || 0);

    switch (resolution) {
      case "FULL_REFUND":
        // Buyer gets full refund; dispute fee charged to seller from escrow
        buyerRefund = Number(transaction.salePrice);
        sellerPayout = 0;
        newTransactionStatus = "REFUNDED";
        feeCharged = true;
        break;

      case "PARTIAL_REFUND": {
        // SECURITY [M1]: Integer-safe 50/50 split using currency-aware base units
        const decimals = transaction.currency === "USDC" ? 6 : 9;
        const base = Math.pow(10, decimals);
        const saleLamports = Math.round(Number(transaction.salePrice) * base);
        const feeLamports = Math.round(disputeFeeAmount * base);
        const platFeeLamports = Math.round(Number(transaction.platformFee) * base);
        buyerRefund = Math.floor((saleLamports - feeLamports) / 2) / base;
        sellerPayout = Math.floor((saleLamports - platFeeLamports - feeLamports) / 2) / base;
        newTransactionStatus = "COMPLETED";
        feeCharged = disputeFeeAmount > 0;
        break;
      }

      case "RELEASE_TO_SELLER":
        // Seller gets proceeds; dispute fee charged to buyer (loser)
        buyerRefund = 0;
        sellerPayout = Number(transaction.sellerProceeds);
        newTransactionStatus = "COMPLETED";
        feeCharged = true;
        break;

      case "EXTEND_DEADLINE":
        // Give more time for transfer
        newTransactionStatus = "TRANSFER_PENDING";
        // No funds moved, no fee charged
        break;
    }

    // SECURITY: Use database transaction for atomicity — dispute + transaction
    // must update together to prevent inconsistent state
    await prisma.$transaction(async (tx) => {
      await tx.dispute.update({
        where: { id: disputeId },
        data: {
          status: "RESOLVED",
          resolution,
          resolutionNotes: notes,
          feeCharged,
          resolvedAt: new Date(),
        },
      });

      await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          status: newTransactionStatus,
        releasedAt: resolution !== "EXTEND_DEADLINE" ? new Date() : undefined,
        },
      });
    }); // end $transaction

    // Notify both parties
    const resolutionMessages: Record<string, { buyer: string; seller: string }> = {
      FULL_REFUND: {
        buyer: "The dispute has been resolved in your favor. A full refund is being processed.",
        seller: "The dispute has been resolved. The buyer will receive a full refund.",
      },
      PARTIAL_REFUND: {
        buyer: "The dispute has been resolved with a partial refund.",
        seller: "The dispute has been resolved with a partial payout.",
      },
      RELEASE_TO_SELLER: {
        buyer: "The dispute has been resolved. Funds have been released to the seller.",
        seller: "The dispute has been resolved in your favor. Funds are being released.",
      },
      EXTEND_DEADLINE: {
        buyer: "The dispute has been resolved with an extended deadline for transfer.",
        seller: "The dispute has been resolved with an extended deadline. Please complete the transfer.",
      },
    };

    await prisma.notification.create({
      data: {
        type: "DISPUTE_RESOLVED",
        title: "Dispute Resolved",
        message: resolutionMessages[resolution].buyer,
        data: { disputeId, transactionId: transaction.id, resolution },
        userId: transaction.buyerId,
      },
    });

    await prisma.notification.create({
      data: {
        type: "DISPUTE_RESOLVED",
        title: "Dispute Resolved",
        message: resolutionMessages[resolution].seller,
        data: { disputeId, transactionId: transaction.id, resolution },
        userId: transaction.sellerId,
      },
    });

    await audit({
      action: "ADMIN_DISPUTE_RESOLUTION",
      severity: "WARN",
      userId: token.id as string,
      targetId: disputeId,
      targetType: "dispute",
      detail: `Dispute resolved: ${resolution}`,
      metadata: { resolution, transactionId: transaction.id, feeCharged },
      ...auditContext(request.headers),
    });

    return NextResponse.json({
      success: true,
      resolution,
      feeCharged,
      disputeFee: feeCharged ? dispute.disputeFee : 0,
    });
  } catch (error) {
    console.error("Error resolving dispute:", error);
    return NextResponse.json(
      { error: "Failed to resolve dispute" },
      { status: 500 }
    );
  }
}

// PUT /api/disputes/[id]/respond - Respond to a dispute
export async function PUT(
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

    const disputeId = params.id;

    // SECURITY [M13]: Validate UUID format
    if (!isValidUUID(disputeId)) {
      return NextResponse.json(
        { error: "Invalid ID format" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { response, evidence } = body;

    // SECURITY [M9]: Validate response and evidence inputs
    if (typeof response !== "string" || response.trim().length === 0) {
      return NextResponse.json(
        { error: "Response must be a non-empty string" },
        { status: 400 }
      );
    }
    if (response.length > 5000) {
      return NextResponse.json(
        { error: "Response must be 5000 characters or less" },
        { status: 400 }
      );
    }
    if (evidence !== undefined && evidence !== null && !Array.isArray(evidence)) {
      return NextResponse.json(
        { error: "Evidence must be an array" },
        { status: 400 }
      );
    }

    // Get dispute
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      return NextResponse.json(
        { error: "Dispute not found" },
        { status: 404 }
      );
    }

    // Only respondent can respond
    if (dispute.respondentId !== (token.id as string)) {
      return NextResponse.json(
        { error: "Only the respondent can respond to this dispute" },
        { status: 403 }
      );
    }

    // SECURITY: Can't respond to resolved disputes
    if (dispute.status === "RESOLVED") {
      return NextResponse.json(
        { error: "Cannot respond to a resolved dispute" },
        { status: 400 }
      );
    }

    // SECURITY: Hash evidence for integrity verification
    const evidenceData = {
      response,
      items: evidence || [],
      respondedAt: new Date().toISOString(),
    };
    const evidenceHash = hashEvidence(evidenceData);

    // Update dispute with response and hash
    await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        respondentEvidence: {
          ...evidenceData,
          integrityHash: evidenceHash,
        },
        status: "UNDER_REVIEW",
      },
    });

    // Notify initiator
    await prisma.notification.create({
      data: {
        type: "DISPUTE_OPENED",
        title: "Dispute Response Received",
        message: "The other party has responded to your dispute. Our team will review and make a decision.",
        data: { disputeId },
        userId: dispute.initiatorId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error responding to dispute:", error);
    return NextResponse.json(
      { error: "Failed to respond to dispute" },
      { status: 500 }
    );
  }
}
