import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthToken } from "@/lib/auth";
import { validateCsrfRequest, csrfError } from '@/lib/csrf';

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: params.id },
      include: {
        listing: {
          select: {
            offersNonCompete: true,
            title: true,
          },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
    }

    // Only buyer can request Non-Compete
    if (transaction.buyerId !== token.id as string) {
      return NextResponse.json(
        { error: "Only the buyer can request a Non-Compete Agreement" },
        { status: 403 }
      );
    }

    // Check if Non-Compete was already offered by seller
    if (transaction.listing.offersNonCompete) {
      return NextResponse.json(
        { error: "Seller has already offered a Non-Compete for this listing" },
        { status: 400 }
      );
    }

    // Check if already requested
    if (transaction.buyerRequestedNonCompete) {
      return NextResponse.json(
        { error: "Non-Compete has already been requested" },
        { status: 400 }
      );
    }

    // Check if already signed
    if (transaction.nonCompeteSigned) {
      return NextResponse.json(
        { error: "Non-Compete Agreement has already been signed" },
        { status: 400 }
      );
    }

    // Request the Non-Compete
    await prisma.transaction.update({
      where: { id: params.id },
      data: {
        buyerRequestedNonCompete: true,
      },
    });

    // Create notification for seller
    await prisma.notification.create({
      data: {
        userId: transaction.sellerId,
        type: "AGREEMENT_REQUESTED",
        title: "Non-Compete Requested",
        message: `The buyer has requested a Non-Compete Agreement for "${transaction.listing.title}"`,
        data: {
          transactionId: transaction.id,
          agreementType: "NON_COMPETE",
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Non-Compete Agreement request sent to seller",
    });
  } catch (error) {
    console.error("Error requesting Non-Compete:", error);
    return NextResponse.json(
      { error: "Failed to request Non-Compete Agreement" },
      { status: 500 }
    );
  }
}
