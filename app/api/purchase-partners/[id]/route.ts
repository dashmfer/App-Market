import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET - Get purchase partner invite details by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: partnerId } = await params;

    const partner = await prisma.transactionPartner.findUnique({
      where: { id: partnerId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            name: true,
            image: true,
          },
        },
        transaction: {
          select: {
            id: true,
            status: true,
            salePrice: true,
            currency: true,
            partnerDepositDeadline: true,
            listing: {
              select: {
                id: true,
                title: true,
                slug: true,
                tagline: true,
                thumbnailUrl: true,
                categories: true,
              },
            },
            seller: {
              select: {
                id: true,
                username: true,
                displayName: true,
                name: true,
                image: true,
                isVerified: true,
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
              orderBy: [
                { isLead: "desc" },
                { percentage: "desc" },
              ],
            },
          },
        },
      },
    });

    if (!partner) {
      return NextResponse.json({ error: "Partner invite not found" }, { status: 404 });
    }

    // Calculate stats
    const depositedCount = partner.transaction.partners.filter(
      (p: { depositStatus: string }) => p.depositStatus === "DEPOSITED"
    ).length;
    const totalPercentageDeposited = partner.transaction.partners
      .filter((p: { depositStatus: string }) => p.depositStatus === "DEPOSITED")
      .reduce((sum: number, p: any) => sum + Number(p.percentage), 0);

    // Calculate time remaining
    const timeRemaining = partner.transaction.partnerDepositDeadline
      ? Math.max(0, new Date(partner.transaction.partnerDepositDeadline).getTime() - Date.now())
      : 0;

    return NextResponse.json({
      partner: {
        id: partner.id,
        walletAddress: partner.walletAddress,
        percentage: partner.percentage,
        depositAmount: partner.depositAmount,
        depositStatus: partner.depositStatus,
        isLead: partner.isLead,
        user: partner.user,
      },
      transaction: {
        id: partner.transaction.id,
        status: partner.transaction.status,
        salePrice: partner.transaction.salePrice,
        currency: partner.transaction.currency,
        depositDeadline: partner.transaction.partnerDepositDeadline,
        timeRemaining,
      },
      listing: partner.transaction.listing,
      seller: partner.transaction.seller,
      partners: partner.transaction.partners.map((p: typeof partner.transaction.partners[number]) => ({
        id: p.id,
        walletAddress: `${p.walletAddress.slice(0, 4)}...${p.walletAddress.slice(-4)}`,
        percentage: p.percentage,
        depositStatus: p.depositStatus,
        isLead: p.isLead,
        user: p.user,
      })),
      stats: {
        totalPartners: partner.transaction.partners.length,
        depositedCount,
        totalPercentageDeposited,
      },
    });
  } catch (error: any) {
    console.error("Error fetching partner invite:", error);
    return NextResponse.json({ error: "Failed to fetch partner invite" }, { status: 500 });
  }
}
