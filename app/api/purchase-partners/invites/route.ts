import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET - Get all pending purchase partner invites for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's primary wallet and all linked wallets (multi-wallet support)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        walletAddress: true,
        wallets: {
          select: { walletAddress: true },
        },
      },
    });

    // Collect all wallet addresses (primary + linked wallets)
    const allWallets: string[] = [];
    if (user?.walletAddress) {
      allWallets.push(user.walletAddress.toLowerCase());
    }
    if (user?.wallets) {
      user.wallets.forEach((w: { walletAddress: string }) => {
        const normalized = w.walletAddress.toLowerCase();
        if (!allWallets.includes(normalized)) {
          allWallets.push(normalized);
        }
      });
    }

    // Build OR conditions for wallet matching (case-insensitive)
    const walletConditions = allWallets.map(wallet => ({
      walletAddress: { equals: wallet, mode: "insensitive" as const },
    }));

    // Find all pending partner invites (by userId or any of their wallet addresses)
    const invites = await prisma.transactionPartner.findMany({
      where: {
        OR: [
          { userId: session.user.id },
          ...walletConditions,
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
                categories: true,
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
    const formattedInvites = invites.map((invite: typeof invites[number]) => {
      const depositedCount = invite.transaction.partners.filter(
        (p: { depositStatus: string }) => p.depositStatus === "DEPOSITED"
      ).length;
      const totalPercentageDeposited = invite.transaction.partners
        .filter((p: { depositStatus: string }) => p.depositStatus === "DEPOSITED")
        .reduce((sum: number, p: any) => sum + Number(p.percentage), 0);

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
        leadBuyer: invite.transaction.partners.find((p: { isLead: boolean }) => p.isLead),
        partnersCount: invite.transaction.partners.length,
        depositedCount,
        totalPercentageDeposited,
        timeRemaining,
        depositDeadline: invite.transaction.partnerDepositDeadline,
        createdAt: invite.createdAt,
      };
    });

    return NextResponse.json({ invites: formattedInvites });
  } catch (error: any) {
    console.error("Error fetching purchase partner invites:", error);
    return NextResponse.json({ error: "Failed to fetch invites" }, { status: 500 });
  }
}
