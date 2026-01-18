import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// POST /api/transfers/[id]/fallback - Activate fallback transfer process
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
    const { githubTransferLink, zipDownloadUrl, domainTransferLink, instructions } = body;

    const transaction = await prisma.transaction.findUnique({
      where: { id: params.id },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            sellerId: true,
            githubRepo: true,
            hasDomain: true,
            requiredBuyerInfo: true,
          },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Only seller can activate fallback
    if (transaction.sellerId !== session.user.id) {
      return NextResponse.json({ error: "Only seller can activate fallback" }, { status: 403 });
    }

    // Validate that we need fallback (deadline passed or no buyer info required)
    const hasRequiredInfo = transaction.listing.requiredBuyerInfo !== null;
    const deadlinePassed = transaction.buyerInfoStatus === "DEADLINE_PASSED";
    const noInfoProvided = transaction.buyerInfoStatus === "PENDING";

    // GitHub transfer link is required if there's a GitHub repo
    if (transaction.listing.githubRepo && !githubTransferLink) {
      return NextResponse.json(
        { error: "GitHub transfer link is required for fallback process" },
        { status: 400 }
      );
    }

    // Build transfer methods JSON
    const transferMethods: Record<string, { method: string; link?: string; instructions?: string }> = {};

    if (transaction.listing.githubRepo) {
      transferMethods.github = {
        method: "fallback",
        link: githubTransferLink,
        instructions: instructions?.github,
      };
    }

    if (transaction.listing.hasDomain && domainTransferLink) {
      transferMethods.domain = {
        method: "fallback",
        link: domainTransferLink,
        instructions: instructions?.domain,
      };
    }

    if (zipDownloadUrl) {
      transferMethods.codeZip = {
        method: "fallback",
        link: zipDownloadUrl,
      };
    }

    // Update transaction
    await prisma.transaction.update({
      where: { id: params.id },
      data: {
        fallbackTransferUsed: true,
        transferMethods,
        status: "TRANSFER_IN_PROGRESS",
      },
    });

    // Notify buyer
    await prisma.notification.create({
      data: {
        userId: transaction.buyerId,
        type: "FALLBACK_TRANSFER_ACTIVE",
        title: "Fallback Transfer Process Started",
        message: `The seller has provided transfer links for "${transaction.listing.title}". Please check the transfer page for instructions.`,
        data: { link: `/dashboard/transfers/${transaction.id}`, transactionId: transaction.id },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Fallback transfer process activated",
    });
  } catch (error) {
    console.error("Error activating fallback transfer:", error);
    return NextResponse.json(
      { error: "Failed to activate fallback transfer" },
      { status: 500 }
    );
  }
}
