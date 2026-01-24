import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET - Get all pending purchase partner invites for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's wallet address
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { walletAddress: true },
    });

    if (!user?.walletAddress) {
      return NextResponse.json({ invites: [] });
    }

    // Find all pending partner invites (by userId or wallet address)
    const invites = await prisma.transactionPartner.findMany({
      where: {
        OR: [
          { userId: session.user.id },
          { walletAddress: user.walletAddress },
        ],
        depositStatus: "PENDING",
        transaction: {
          status: "AWAITING_PARTNER_DEPOSITS",
        },
      },
      include: {
        transaction: {
          include: {
            listing: {
              select: {
                id: true,
                title: true,
                slug: true,
                thumbnailUrl: true,
                category: true,
              },
            },
            seller: {
              select: {
                id: true,
                username: true,
                displayName: true,
                image: true,
              },
            },
            partners: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                    image: true,
                  },
                },
              },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Format invites with additional info
    const formattedInvites = invites.map(invite => {
      const depositedCount = invite.transaction.partners.filter(
        p => p.depositStatus === "DEPOSITED"
      ).length;
      const totalPercentageDeposited = invite.transaction.partners
        .filter(p => p.depositStatus === "DEPOSITED")
        .reduce((sum, p) => sum + p.percentage, 0);

      const timeRemaining = invite.transaction.partnerDepositDeadline
        ? Math.max(0, new Date(invite.transaction.partnerDepositDeadline).getTime() - Date.now())
        : 0;

      return {
        id: invite.id,
        transactionId: invite.transactionId,
        percentage: invite.percentage,
        depositAmount: invite.depositAmount,
        listing: invite.transaction.listing,
        seller: invite.transaction.seller,
        salePrice: invite.transaction.salePrice,
        leadBuyer: invite.transaction.partners.find(p => p.isLead),
        partnersCount: invite.transaction.partners.length,
        depositedCount,
        totalPercentageDeposited,
        timeRemaining,
        depositDeadline: invite.transaction.partnerDepositDeadline,
        createdAt: invite.createdAt,
      };
    });

    return NextResponse.json({ invites: formattedInvites });
  } catch (error) {
    console.error("Error fetching purchase partner invites:", error);
    return NextResponse.json({ error: "Failed to fetch invites" }, { status: 500 });
  }
}
