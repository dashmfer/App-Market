import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthToken } from "@/lib/auth";
import { validateCsrfRequest, csrfError } from '@/lib/csrf';
import { isValidUUID } from '@/lib/validation';

// GET /api/transactions/[id]/buyer-info - Get buyer info status
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // SECURITY [M13]: Validate UUID format
    const { id } = params;
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: "Invalid ID format" },
        { status: 400 }
      );
    }

    const token = await getAuthToken(request);
    if (!token?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            requiredBuyerInfo: true,
          },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Only buyer or seller can view buyer info
    const isBuyer = transaction.buyerId === token.id as string;
    const isSeller = transaction.sellerId === token.id as string;

    if (!isBuyer && !isSeller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Calculate time remaining
    const deadline = transaction.buyerInfoDeadline;
    const timeRemaining = deadline
      ? Math.max(0, new Date(deadline).getTime() - Date.now())
      : null;

    return NextResponse.json({
      requiredInfo: transaction.listing.requiredBuyerInfo,
      providedInfo: isBuyer || isSeller ? transaction.buyerProvidedInfo : null,
      status: transaction.buyerInfoStatus,
      deadline: transaction.buyerInfoDeadline,
      timeRemaining,
      submittedAt: transaction.buyerInfoSubmittedAt,
      isBuyer,
      isSeller,
    });
  } catch (error) {
    console.error("Error fetching buyer info:", error);
    return NextResponse.json(
      { error: "Failed to fetch buyer info" },
      { status: 500 }
    );
  }
}

// POST /api/transactions/[id]/buyer-info - Submit buyer info
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // SECURITY [M13]: Validate UUID format
    const { id } = params;
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: "Invalid ID format" },
        { status: 400 }
      );
    }

    // SECURITY: Validate CSRF token
    const csrfValidation = validateCsrfRequest(request);
    if (!csrfValidation.valid) {
      return csrfError(csrfValidation.error || 'CSRF validation failed');
    }

    const token = await getAuthToken(request);
    if (!token?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { info } = body;

    if (!info || typeof info !== "object") {
      return NextResponse.json(
        { error: "Invalid buyer info" },
        { status: 400 }
      );
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            slug: true,
            requiredBuyerInfo: true,
            sellerId: true,
          },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Only buyer can submit info
    if (transaction.buyerId !== token.id as string) {
      return NextResponse.json({ error: "Only buyer can submit info" }, { status: 403 });
    }

    // Check if already submitted
    if (transaction.buyerInfoStatus === "PROVIDED") {
      return NextResponse.json(
        { error: "Buyer info already submitted" },
        { status: 400 }
      );
    }

    // Check deadline
    if (transaction.buyerInfoDeadline && new Date() > new Date(transaction.buyerInfoDeadline)) {
      return NextResponse.json(
        { error: "Deadline has passed. Fallback transfer process will be used." },
        { status: 400 }
      );
    }

    // Validate required fields
    const requiredInfo = transaction.listing.requiredBuyerInfo as Record<string, { required: boolean }> | null;
    if (requiredInfo) {
      const missingFields: string[] = [];
      for (const [key, value] of Object.entries(requiredInfo)) {
        if (value?.required && (!info[key] || !info[key].trim())) {
          missingFields.push(key);
        }
      }
      if (missingFields.length > 0) {
        return NextResponse.json(
          { error: `Missing required fields: ${missingFields.join(", ")}` },
          { status: 400 }
        );
      }
    }

    // Update transaction with buyer info
    await prisma.transaction.update({
      where: { id },
      data: {
        buyerProvidedInfo: info,
        buyerInfoStatus: "PROVIDED",
        buyerInfoSubmittedAt: new Date(),
      },
    });

    // Create notification for seller
    await prisma.notification.create({
      data: {
        userId: transaction.listing.sellerId,
        type: "BUYER_INFO_SUBMITTED",
        title: "Buyer Submitted Transfer Info",
        message: `The buyer has submitted their information for "${transaction.listing.title}". You can now begin the transfer process.`,
        data: { transactionId: transaction.id, listingSlug: transaction.listing.slug, link: `/dashboard/transfers/${transaction.id}` },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Buyer info submitted successfully",
    });
  } catch (error) {
    console.error("Error submitting buyer info:", error);
    return NextResponse.json(
      { error: "Failed to submit buyer info" },
      { status: 500 }
    );
  }
}
