import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthToken } from "@/lib/auth";
import { calculatePlatformFee } from "@/lib/solana";

// POST /api/purchases - Create a purchase (Buy Now)
export async function POST(request: NextRequest) {
  try {
    // Use getAuthToken for JWT-based authentication
    const token = await getAuthToken(request);

    if (!token?.id) {
      return NextResponse.json(
        { error: "Unauthorized - please sign in" },
        { status: 401 }
      );
    }

    const userId = token.id as string;

    const body = await request.json();
    const { listingId, amount, currency, onChainTx, walletAddress, purchaseType } = body;

    // Validate required fields
    if (!listingId || !amount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get listing with seller info
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    });

    if (!listing) {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 }
      );
    }

    // Check listing status
    if (listing.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Listing is not available for purchase" },
        { status: 400 }
      );
    }

    // Check if buyer is not the seller
    if (listing.sellerId === userId) {
      return NextResponse.json(
        { error: "You cannot buy your own listing" },
        { status: 400 }
      );
    }

    // For Buy Now, verify the price matches
    if (purchaseType === "buyNow") {
      if (!listing.buyNowEnabled || !listing.buyNowPrice) {
        return NextResponse.json(
          { error: "Buy Now is not available for this listing" },
          { status: 400 }
        );
      }

      if (amount < listing.buyNowPrice) {
        return NextResponse.json(
          { error: `Payment amount must be at least ${listing.buyNowPrice} ${listing.currency}` },
          { status: 400 }
        );
      }
    }

    // Calculate fees
    const platformFeeRate = 0.05; // 5%
    const platformFee = amount * platformFeeRate;
    const sellerProceeds = amount - platformFee;

    // Check if a transaction already exists for this listing
    const existingTransaction = await prisma.transaction.findUnique({
      where: { listingId },
    });

    if (existingTransaction) {
      return NextResponse.json(
        { error: "This listing has already been purchased" },
        { status: 400 }
      );
    }

    // Calculate buyer info deadline (48 hours from now)
    const buyerInfoDeadline = listing.requiredBuyerInfo
      ? new Date(Date.now() + 48 * 60 * 60 * 1000)
      : null;

    // Create transaction
    const transaction = await prisma.transaction.create({
      data: {
        salePrice: amount,
        platformFee,
        sellerProceeds,
        currency: currency || listing.currency,
        paymentMethod: "SOLANA",
        onChainTx,
        status: "IN_ESCROW",
        listingId,
        buyerId: userId,
        sellerId: listing.sellerId,
        paidAt: new Date(),
        buyerInfoDeadline,
        buyerInfoStatus: listing.requiredBuyerInfo ? "PENDING" : "PROVIDED",
      },
    });

    // Update listing status to SOLD
    await prisma.listing.update({
      where: { id: listingId },
      data: { status: "SOLD" },
    });

    // Update buyer stats
    await prisma.user.update({
      where: { id: userId },
      data: {
        totalPurchases: { increment: 1 },
        totalVolume: { increment: amount },
      },
    });

    // Notify seller about the purchase
    await prisma.notification.create({
      data: {
        type: "PAYMENT_RECEIVED",
        title: "Your listing has been purchased!",
        message: `"${listing.title}" was purchased for ${amount} ${listing.currency}`,
        data: {
          listingId,
          listingSlug: listing.slug,
          transactionId: transaction.id,
          amount
        },
        userId: listing.sellerId,
      },
    });

    // If buyer info is required, notify the buyer
    if (listing.requiredBuyerInfo && buyerInfoDeadline) {
      await prisma.notification.create({
        data: {
          type: "BUYER_INFO_REQUIRED",
          title: "Action Required: Provide your information",
          message: `Please provide the required information for "${listing.title}" within 48 hours.`,
          data: {
            listingId,
            listingSlug: listing.slug,
            transactionId: transaction.id,
            deadline: buyerInfoDeadline.toISOString(),
          },
          userId,
        },
      });
    }

    return NextResponse.json({
      transaction: {
        id: transaction.id,
        status: transaction.status,
        salePrice: transaction.salePrice,
        currency: transaction.currency,
      },
      message: "Purchase successful"
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating purchase:", error);
    return NextResponse.json(
      { error: "Failed to complete purchase" },
      { status: 500 }
    );
  }
}

// GET /api/purchases - Get user's purchases
export async function GET(request: NextRequest) {
  try {
    const token = await getAuthToken(request);

    if (!token?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = token.id as string;

    const purchases = await prisma.transaction.findMany({
      where: { buyerId: userId },
      orderBy: { createdAt: "desc" },
      include: {
        listing: {
          select: {
            id: true,
            slug: true,
            title: true,
            thumbnailUrl: true,
            category: true,
          },
        },
        seller: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json({ purchases });
  } catch (error) {
    console.error("Error fetching purchases:", error);
    return NextResponse.json(
      { error: "Failed to fetch purchases" },
      { status: 500 }
    );
  }
}
