import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET - Get purchase partners for a sold listing
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    // Find the listing by slug
    const listing = await prisma.listing.findUnique({
      where: { slug: params.slug },
      select: {
        id: true,
        status: true,
        transaction: {
          select: {
            id: true,
            hasPartners: true,
            partners: {
              where: { depositStatus: "DEPOSITED" },
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

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    // Only return partners for sold listings
    if (listing.status !== "SOLD") {
      return NextResponse.json({ partners: [] });
    }

    // If no transaction or no partners, return empty
    if (!listing.transaction || !listing.transaction.hasPartners) {
      return NextResponse.json({ partners: [] });
    }

    // Format partners for response
    const partners = listing.transaction.partners.map(p => ({
      id: p.id,
      walletAddress: `${p.walletAddress.slice(0, 4)}...${p.walletAddress.slice(-4)}`,
      percentage: p.percentage,
      isLead: p.isLead,
      user: p.user ? {
        id: p.user.id,
        username: p.user.username,
        displayName: p.user.displayName,
        name: p.user.name,
        image: p.user.image,
      } : null,
    }));

    return NextResponse.json({ partners });
  } catch (error) {
    console.error("Error fetching purchase partners:", error);
    return NextResponse.json(
      { error: "Failed to fetch purchase partners" },
      { status: 500 }
    );
  }
}
