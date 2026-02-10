import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET - Get purchase partners for a listing with partners
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const includePending = searchParams.get("includePending") === "true";

    // Find the listing by slug
    const listing = await prisma.listing.findUnique({
      where: { slug: params.slug },
      select: {
        id: true,
        status: true,
        transaction: {
          select: {
            id: true,
            status: true,
            hasPartners: true,
            partnerDepositDeadline: true,
            partners: {
              // Include all partners if includePending, otherwise only deposited
              where: includePending ? {} : { depositStatus: "DEPOSITED" },
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                    name: true,
                    image: true,
                    isVerified: true,
                  },
                },
              },
              orderBy: [
                { isLead: "desc" },
                { depositStatus: "asc" }, // DEPOSITED before PENDING
                { percentage: "desc" },
              ],
            },
          },
        },
      },
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    // For sold listings or active transactions with partners
    const validStatuses = ["SOLD", "ACTIVE", "PENDING"];
    if (!validStatuses.includes(listing.status) && !listing.transaction?.hasPartners) {
      return NextResponse.json({ partners: [] });
    }

    // If no transaction or no partners, return empty
    if (!listing.transaction || !listing.transaction.hasPartners) {
      return NextResponse.json({ partners: [] });
    }

    // Format partners for response with deposit status
    const partners = listing.transaction.partners.map((p: typeof listing.transaction.partners[number]) => ({
      id: p.id,
      walletAddress: `${p.walletAddress.slice(0, 4)}...${p.walletAddress.slice(-4)}`,
      percentage: p.percentage,
      isLead: p.isLead,
      depositStatus: p.depositStatus,
      depositAmount: p.depositAmount,
      user: p.user ? {
        id: p.user.id,
        username: p.user.username,
        displayName: p.user.displayName,
        name: p.user.name,
        image: p.user.image,
        isVerified: p.user.isVerified,
      } : null,
    }));

    // Calculate stats
    const depositedCount = partners.filter((p: { depositStatus: string }) => p.depositStatus === "DEPOSITED").length;
    const pendingCount = partners.filter((p: { depositStatus: string }) => p.depositStatus === "PENDING").length;
    const totalPercentageDeposited = partners
      .filter((p: { depositStatus: string }) => p.depositStatus === "DEPOSITED")
      .reduce((sum: number, p: any) => sum + Number(p.percentage), 0);

    return NextResponse.json({
      partners,
      stats: {
        totalPartners: partners.length,
        depositedCount,
        pendingCount,
        totalPercentageDeposited,
        depositDeadline: listing.transaction.partnerDepositDeadline,
        transactionStatus: listing.transaction.status,
      },
    });
  } catch (error: any) {
    console.error("Error fetching purchase partners:", error);
    return NextResponse.json(
      { error: "Failed to fetch purchase partners" },
      { status: 500 }
    );
  }
}
