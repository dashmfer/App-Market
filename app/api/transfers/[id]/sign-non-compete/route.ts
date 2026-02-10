import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: params.id },
      include: {
        listing: {
          select: {
            offersNonCompete: true,
            nonCompeteDurationYears: true,
            title: true,
          },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
    }

    // Only seller can sign Non-Compete
    if (transaction.sellerId !== session.user.id) {
      return NextResponse.json(
        { error: "Only the seller can sign the Non-Compete Agreement" },
        { status: 403 }
      );
    }

    // Check if Non-Compete was offered or requested
    if (!transaction.listing.offersNonCompete && !transaction.buyerRequestedNonCompete) {
      return NextResponse.json(
        { error: "Non-Compete was not offered or requested for this transaction" },
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

    // Sign the Non-Compete
    const duration = transaction.listing.nonCompeteDurationYears || 2;
    const signature = `NC-${transaction.id}-${session.user.id}-${duration}y-${Date.now()}`;

    await prisma.transaction.update({
      where: { id: params.id },
      data: {
        nonCompeteSigned: true,
        nonCompeteSignedAt: new Date(),
        nonCompeteSignature: signature,
      },
    });

    // Create notification for buyer
    await prisma.notification.create({
      data: {
        userId: transaction.buyerId,
        type: "AGREEMENT_SIGNED",
        title: "Non-Compete Signed",
        message: `The seller has signed a ${duration}-year Non-Compete Agreement for "${transaction.listing.title}"`,
        data: {
          transactionId: transaction.id,
          agreementType: "NON_COMPETE",
          duration,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Non-Compete Agreement signed successfully",
    });
  } catch (error: any) {
    console.error("Error signing Non-Compete:", error);
    return NextResponse.json(
      { error: "Failed to sign Non-Compete Agreement" },
      { status: 500 }
    );
  }
}
