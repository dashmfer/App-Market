import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { getAuthToken } from "@/lib/auth";
import { validateCsrfRequest, csrfError } from "@/lib/csrf";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const csrf = validateCsrfRequest(request);
    if (!csrf.valid) return csrfError(csrf.error || "CSRF validation failed");

    const token = await getAuthToken(request);
    if (!token?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: params.id },
      include: {
        listing: {
          select: {
            offersAPA: true,
            title: true,
          },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
    }

    // Only seller can sign APA
    if (transaction.sellerId !== token.id as string) {
      return NextResponse.json(
        { error: "Only the seller can sign the APA" },
        { status: 403 }
      );
    }

    // Check if APA was offered or requested
    if (!transaction.listing.offersAPA && !transaction.buyerRequestedAPA) {
      return NextResponse.json(
        { error: "APA was not offered or requested for this transaction" },
        { status: 400 }
      );
    }

    // Check if already signed
    if (transaction.apaSigned) {
      return NextResponse.json(
        { error: "APA has already been signed" },
        { status: 400 }
      );
    }

    // Sign the APA with cryptographic hash
    const signature = crypto
      .createHash("sha256")
      .update(JSON.stringify({ transactionId: params.id, userId: token.id, timestamp: Date.now(), type: "APA" }))
      .digest("hex");

    await prisma.transaction.update({
      where: { id: params.id },
      data: {
        apaSigned: true,
        apaSignedAt: new Date(),
        apaSignature: signature,
      },
    });

    // Create notification for buyer
    await prisma.notification.create({
      data: {
        userId: transaction.buyerId,
        type: "AGREEMENT_SIGNED",
        title: "APA Signed",
        message: `The seller has signed the Asset Purchase Agreement for "${transaction.listing.title}"`,
        data: {
          transactionId: transaction.id,
          agreementType: "APA",
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Asset Purchase Agreement signed successfully",
    });
  } catch (error) {
    console.error("Error signing APA:", error);
    return NextResponse.json(
      { error: "Failed to sign APA" },
      { status: 500 }
    );
  }
}
