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
    const {
      listingId,
      amount,
      currency,
      onChainTx,
      walletAddress,
      purchaseType,
      // Partner purchase fields
      withPartners,
      leadBuyerPercentage,
      leadBuyerDepositAmount,
      partners,
    } = body;

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

    // Determine initial status based on whether it's a partner purchase
    const initialStatus = withPartners ? "AWAITING_PARTNER_DEPOSITS" : "IN_ESCROW";
    const partnerDepositDeadline = withPartners
      ? new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
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
        status: initialStatus,
        listingId,
        buyerId: userId,
        sellerId: listing.sellerId,
        paidAt: withPartners ? null : new Date(), // Only set paidAt when fully paid
        buyerInfoDeadline: withPartners ? null : buyerInfoDeadline, // Set after all deposits
        buyerInfoStatus: listing.requiredBuyerInfo ? "PENDING" : "PROVIDED",
        hasPartners: withPartners || false,
        partnerDepositDeadline,
      },
    });

    // If partner purchase, create lead buyer as a partner and other partners
    if (withPartners && partners && partners.length > 0) {
      // Create lead buyer partner record
      await prisma.transactionPartner.create({
        data: {
          transactionId: transaction.id,
          walletAddress: walletAddress,
          userId: userId,
          percentage: leadBuyerPercentage,
          depositAmount: leadBuyerDepositAmount,
          isLead: true,
          depositStatus: "DEPOSITED",
          depositedAt: new Date(),
          depositTxHash: onChainTx,
        },
      });

      // Create other partner records
      for (const partner of partners) {
        await prisma.transactionPartner.create({
          data: {
            transactionId: transaction.id,
            walletAddress: partner.walletAddress,
            userId: partner.userId || null,
            percentage: partner.percentage,
            depositAmount: partner.depositAmount,
            isLead: false,
            depositStatus: "PENDING",
          },
        });

        // Notify each partner
        if (partner.userId) {
          await prisma.notification.create({
            data: {
              type: "PURCHASE_PARTNER_INVITE",
              title: "Purchase Partner Invite",
              message: `You've been invited to co-purchase "${listing.title}" with ${partner.percentage}% share (${partner.depositAmount} SOL)`,
              data: {
                listingId,
                listingSlug: listing.slug,
                transactionId: transaction.id,
                percentage: partner.percentage,
                depositAmount: partner.depositAmount,
                deadline: partnerDepositDeadline?.toISOString(),
              },
              userId: partner.userId,
            },
          });
        }
      }
    }

    // Update listing status - SOLD only if not a partner purchase
    // For partner purchases, it stays ACTIVE until all deposits are in
    if (!withPartners) {
      await prisma.listing.update({
        where: { id: listingId },
        data: { status: "SOLD" },
      });
    }

    // Update buyer stats (only for solo purchases; partner purchases update after all deposits)
    if (!withPartners) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          totalPurchases: { increment: 1 },
          totalVolume: { increment: amount },
        },
      });
    }

    // Notify seller about the purchase (only if not partner purchase, or when partners complete)
    if (!withPartners) {
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
    }

    return NextResponse.json({
      transactionId: transaction.id,
      transaction: {
        id: transaction.id,
        status: transaction.status,
        salePrice: transaction.salePrice,
        currency: transaction.currency,
        hasPartners: withPartners || false,
        partnerDepositDeadline: partnerDepositDeadline?.toISOString() || null,
      },
      message: withPartners
        ? "Purchase initiated. Waiting for partner deposits."
        : "Purchase successful"
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
            categories: true,
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
