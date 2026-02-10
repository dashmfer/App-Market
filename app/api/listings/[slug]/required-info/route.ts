import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthToken } from "@/lib/auth";
import { validateCsrfRequest, csrfError } from '@/lib/csrf';

// GET /api/listings/[slug]/required-info - Get required buyer info
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const listing = await prisma.listing.findUnique({
      where: { slug: params.slug },
      select: {
        id: true,
        requiredBuyerInfo: true,
        buyerInfoLocked: true,
        sellerId: true,
      },
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    return NextResponse.json({
      requiredBuyerInfo: listing.requiredBuyerInfo,
      isLocked: listing.buyerInfoLocked,
    });
  } catch (error) {
    console.error("Error fetching required info:", error);
    return NextResponse.json(
      { error: "Failed to fetch required info" },
      { status: 500 }
    );
  }
}

// PATCH /api/listings/[slug]/required-info - Update required buyer info (pre-purchase only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const token = await getAuthToken(request);
    if (!token?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { requiredBuyerInfo } = body;

    const listing = await prisma.listing.findUnique({
      where: { slug: params.slug },
      select: {
        id: true,
        sellerId: true,
        buyerInfoLocked: true,
        status: true,
      },
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    // Only seller can update
    if (listing.sellerId !== token.id as string) {
      return NextResponse.json({ error: "Only seller can update" }, { status: 403 });
    }

    // Check if locked (purchase has been made)
    if (listing.buyerInfoLocked) {
      return NextResponse.json(
        { error: "Cannot modify requirements after a purchase has been made" },
        { status: 400 }
      );
    }

    // Check listing status
    if (listing.status === "SOLD" || listing.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Cannot modify requirements for sold or cancelled listings" },
        { status: 400 }
      );
    }

    // Update the required buyer info
    await prisma.listing.update({
      where: { slug: params.slug },
      data: {
        requiredBuyerInfo: requiredBuyerInfo || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Required buyer info updated",
    });
  } catch (error) {
    console.error("Error updating required info:", error);
    return NextResponse.json(
      { error: "Failed to update required info" },
      { status: 500 }
    );
  }
}
