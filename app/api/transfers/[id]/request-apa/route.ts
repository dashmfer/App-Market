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
            offersAPA: true,
            title: true,
          },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
    }

    // Only buyer can request APA
    if (transaction.buyerId !== session.user.id) {
      return NextResponse.json(
        { error: "Only the buyer can request an APA" },
        { status: 403 }
      );
    }

    // Check if APA was already offered by seller
    if (transaction.listing.offersAPA) {
      return NextResponse.json(
        { error: "Seller has already offered an APA for this listing" },
        { status: 400 }
      );
    }

    // Check if already requested
    if (transaction.buyerRequestedAPA) {
      return NextResponse.json(
        { error: "APA has already been requested" },
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

    // Request the APA
    await prisma.transaction.update({
      where: { id: params.id },
      data: {
        buyerRequestedAPA: true,
      },
    });

    // Create notification for seller
    await prisma.notification.create({
      data: {
        userId: transaction.sellerId,
        type: "AGREEMENT_REQUESTED",
        title: "APA Requested",
        message: `The buyer has requested an Asset Purchase Agreement for "${transaction.listing.title}"`,
        data: {
          transactionId: transaction.id,
          agreementType: "APA",
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Asset Purchase Agreement request sent to seller",
    });
  } catch (error: any) {
    console.error("Error requesting APA:", error);
    return NextResponse.json(
      { error: "Failed to request APA" },
      { status: 500 }
    );
  }
}
