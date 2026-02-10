import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { validateCsrfRequest, csrfError } from '@/lib/csrf';

// POST - Mark partner as having deposited their share
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; partnerId: string } }
) {
  try {
    // SECURITY: Validate CSRF token
    const csrfValidation = validateCsrfRequest(request);
    if (!csrfValidation.valid) {
      return csrfError(csrfValidation.error || 'CSRF validation failed');
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { txHash } = body;

    const transaction = await prisma.transaction.findUnique({
      where: { id: params.id },
      include: {
        partners: {
          include: {
            user: { select: { id: true, username: true, displayName: true } },
          },
        },
        listing: { select: { title: true, slug: true } },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const partner = transaction.partners.find((p: { id: string }) => p.id === params.partnerId);
    if (!partner) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }

    // SECURITY: Only the partner themselves can mark as deposited.
    // If partner has a userId, they must match. If no userId, verify wallet address.
    if (partner.userId) {
      if (partner.userId !== session.user.id) {
        return NextResponse.json({ error: "Only the partner can confirm their deposit" }, { status: 403 });
      }
    } else {
      // No userId set — verify the session user's wallet matches the partner's wallet
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { walletAddress: true },
      });
      if (!currentUser?.walletAddress || currentUser.walletAddress !== partner.walletAddress) {
        return NextResponse.json({ error: "Wallet address does not match partner record" }, { status: 403 });
      }
    }

    // Check if deposit deadline has passed
    if (transaction.partnerDepositDeadline && new Date() > transaction.partnerDepositDeadline) {
      return NextResponse.json({
        error: "Deposit deadline has passed. Transaction will be refunded."
      }, { status: 400 });
    }

    // Check if already deposited
    if (partner.depositStatus === "DEPOSITED") {
      return NextResponse.json({ error: "Already deposited" }, { status: 400 });
    }

    // TODO: Verify the on-chain transaction
    // In production, we would verify the tx hash and amount on-chain

    // Update partner deposit status
    await prisma.transactionPartner.update({
      where: { id: params.partnerId },
      data: {
        depositStatus: "DEPOSITED",
        depositedAt: new Date(),
        depositTxHash: txHash || null,
      },
    });

    // Notify lead buyer
    const leadPartner = transaction.partners.find((p: { isLead: boolean }) => p.isLead);
    if (leadPartner?.userId && leadPartner.userId !== session.user.id) {
      await createNotification({
        userId: leadPartner.userId,
        type: "PURCHASE_PARTNER_DEPOSITED",
        listingTitle: transaction.listing.title,
        data: {
          partnerName: partner.user?.displayName || partner.user?.username || partner.walletAddress.slice(0, 8),
          percentage: partner.percentage,
          transactionId: params.id,
        },
      });
    }

    // Check if all partners have deposited
    const allDeposited = transaction.partners.every(
      (p: { id: string; depositStatus: string }) => p.id === params.partnerId || p.depositStatus === "DEPOSITED"
    );

    // Check if total is 100%
    const totalPercentage = transaction.partners.reduce((sum: number, p: any) => sum + Number(p.percentage), 0);

    if (allDeposited && totalPercentage >= 100) {
      // All deposits complete! Move to next phase
      await prisma.transaction.update({
        where: { id: params.id },
        data: {
          status: "PAID",
          paidAt: new Date(),
        },
      });

      // Notify all partners
      for (const p of transaction.partners as Array<{ userId: string | null; id: string; depositStatus: string; isLead: boolean }>) {
        if (p.userId) {
          await createNotification({
            userId: p.userId,
            type: "PURCHASE_PARTNER_ALL_READY",
            listingTitle: transaction.listing.title,
            data: {
              listingSlug: transaction.listing.slug,
              transactionId: params.id,
            },
          });
        }
      }

      return NextResponse.json({
        success: true,
        allDeposited: true,
        message: "All deposits complete! Purchase is now locked in.",
      });
    }

    return NextResponse.json({
      success: true,
      allDeposited: false,
      deposited: transaction.partners.filter((p: { id: string; depositStatus: string }) =>
        p.id === params.partnerId || p.depositStatus === "DEPOSITED"
      ).length,
      total: transaction.partners.length,
      percentageDeposited: transaction.partners
        .filter((p: { id: string; depositStatus: string }) => p.id === params.partnerId || p.depositStatus === "DEPOSITED")
        .reduce((sum: number, p: any) => sum + Number(p.percentage), 0),
    });
  } catch (error) {
    console.error("Error processing deposit:", error);
    return NextResponse.json({ error: "Failed to process deposit" }, { status: 500 });
  }
}
