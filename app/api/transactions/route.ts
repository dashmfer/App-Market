import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthToken } from "@/lib/auth";
import { calculatePlatformFee, calculateSellerProceeds, PLATFORM_FEE_BPS } from "@/lib/solana";

// GET /api/transactions - Get user's transactions
export async function GET(request: NextRequest) {
  try {
    // Use getAuthToken for JWT-based authentication (works better with credentials provider)
    const token = await getAuthToken(request);

    if (!token?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = token.id as string;

    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role") || "all"; // buyer, seller, or all
    const status = searchParams.get("status");

    const where: any = {};

    if (role === "buyer") {
      where.buyerId = userId;
    } else if (role === "seller") {
      where.sellerId = userId;
    } else {
      where.OR = [
        { buyerId: userId },
        { sellerId: userId },
      ];
    }

    if (status) {
      where.status = status.toUpperCase();
    }

    const transactions = await prisma.transaction.findMany({
      where,
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
        buyer: {
          select: {
            id: true,
            name: true,
            username: true,
            walletAddress: true,
          },
        },
        seller: {
          select: {
            id: true,
            name: true,
            username: true,
            walletAddress: true,
          },
        },
      },
    });

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

// POST /api/transactions - Create a transaction (Buy Now or Auction Win)
export async function POST(request: NextRequest) {
  try {
    // Use getAuthToken for JWT-based authentication (works better with credentials provider)
    const token = await getAuthToken(request);

    if (!token?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = token.id as string;

    const body = await request.json();
    const { listingId, paymentMethod, stripePaymentId, onChainTx } = body;

    // Get listing
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        bids: {
          orderBy: { amount: "desc" },
          take: 1,
          where: { isWinning: true },
        },
        seller: true,
      },
    });

    if (!listing) {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 }
      );
    }

    // Determine sale price (winning bid or buy now price)
    let salePrice: number;
    
    if (paymentMethod === "BUY_NOW") {
      if (!listing.buyNowEnabled || !listing.buyNowPrice) {
        return NextResponse.json(
          { error: "Buy Now not available" },
          { status: 400 }
        );
      }
      salePrice = listing.buyNowPrice;
    } else {
      // Auction win
      if (listing.status !== "ENDED" && new Date() < listing.endTime) {
        return NextResponse.json(
          { error: "Auction has not ended yet" },
          { status: 400 }
        );
      }
      
      const winningBid = listing.bids[0];
      if (!winningBid || winningBid.bidderId !== userId) {
        return NextResponse.json(
          { error: "You did not win this auction" },
          { status: 400 }
        );
      }
      
      salePrice = winningBid.amount;
    }

    // Calculate fees
    const platformFee = calculatePlatformFee(salePrice);
    const sellerProceeds = salePrice - platformFee;

    // Create transfer checklist based on listing assets
    const transferChecklist = {
      github: { required: true, completed: false, confirmedBySeller: false, confirmedByBuyer: false },
      domain: listing.hasDomain ? { required: true, completed: false, confirmedBySeller: false, confirmedByBuyer: false } : null,
      database: listing.hasDatabase ? { required: true, completed: false, confirmedBySeller: false, confirmedByBuyer: false } : null,
      hosting: listing.hasHosting ? { required: true, completed: false, confirmedBySeller: false, confirmedByBuyer: false } : null,
      apiKeys: listing.hasApiKeys ? { required: true, completed: false, confirmedBySeller: false, confirmedByBuyer: false } : null,
      designFiles: listing.hasDesignFiles ? { required: true, completed: false, confirmedBySeller: false, confirmedByBuyer: false } : null,
      documentation: listing.hasDocumentation ? { required: true, completed: false, confirmedBySeller: false, confirmedByBuyer: false } : null,
    };

    // Calculate buyer info deadline (48 hours from now)
    const hasRequiredBuyerInfo = listing.requiredBuyerInfo !== null;
    const buyerInfoDeadline = hasRequiredBuyerInfo
      ? new Date(Date.now() + 48 * 60 * 60 * 1000)
      : null;

    // Create transaction
    const transaction = await prisma.transaction.create({
      data: {
        salePrice,
        platformFee,
        sellerProceeds,
        currency: listing.currency,
        paymentMethod: paymentMethod === "BUY_NOW" ? "STRIPE" : (onChainTx ? "SOLANA" : "STRIPE"),
        stripePaymentId,
        onChainTx,
        status: onChainTx ? "IN_ESCROW" : "PENDING",
        transferChecklist,
        buyerInfoDeadline,
        buyerInfoStatus: hasRequiredBuyerInfo ? "PENDING" : "PROVIDED",
        listingId,
        buyerId: userId,
        sellerId: listing.sellerId,
        paidAt: new Date(),
      },
    });

    // Lock the required buyer info on the listing
    if (hasRequiredBuyerInfo) {
      await prisma.listing.update({
        where: { id: listingId },
        data: { buyerInfoLocked: true },
      });
    }

    // Update listing status
    await prisma.listing.update({
      where: { id: listingId },
      data: { status: "SOLD" },
    });

    // Notify seller
    await prisma.notification.create({
      data: {
        type: "AUCTION_WON",
        title: "Your project has been sold!",
        message: hasRequiredBuyerInfo
          ? `"${listing.title}" sold for ${salePrice} ${listing.currency}. The buyer has 48 hours to provide their transfer information.`
          : `"${listing.title}" sold for ${salePrice} ${listing.currency}`,
        data: { transactionId: transaction.id, listingSlug: listing.slug },
        userId: listing.sellerId,
      },
    });

    // Notify buyer about required info (if applicable)
    if (hasRequiredBuyerInfo) {
      await prisma.notification.create({
        data: {
          type: "BUYER_INFO_REQUIRED",
          title: "Action Required: Provide Transfer Info",
          message: `You have 48 hours to provide your information for "${listing.title}" so the seller can complete the transfer.`,
          data: { link: `/dashboard/transfers/${transaction.id}/buyer-info` },
          userId,
        },
      });
    }

    // Update seller stats
    await prisma.user.update({
      where: { id: listing.sellerId },
      data: {
        totalSales: { increment: 1 },
        totalVolume: { increment: salePrice },
      },
    });

    // Update buyer stats
    await prisma.user.update({
      where: { id: userId },
      data: {
        totalPurchases: { increment: 1 },
      },
    });

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    console.error("Error creating transaction:", error);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}
