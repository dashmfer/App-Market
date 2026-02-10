import { NextRequest, NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";
import prisma from "@/lib/db";
import { getAuthToken } from "@/lib/auth";
import { calculatePlatformFee, calculateSellerProceeds } from "@/lib/solana";
import { validateCsrfRequest, csrfError } from "@/lib/csrf";

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

    // SECURITY: Whitelist allowed transaction statuses
    const ALLOWED_TX_STATUSES = ["PENDING", "AWAITING_PARTNER_DEPOSITS", "FUNDED", "PAID", "IN_ESCROW", "TRANSFER_PENDING", "TRANSFER_IN_PROGRESS", "AWAITING_CONFIRMATION", "DISPUTED", "PENDING_RELEASE", "COMPLETED", "REFUNDED", "CANCELLED"];
    if (status) {
      const upper = status.toUpperCase();
      if (ALLOWED_TX_STATUSES.includes(upper)) {
        where.status = upper;
      }
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
            categories: true,
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
    // SECURITY: Validate CSRF token for state-changing request
    const csrfValidation = validateCsrfRequest(request);
    if (!csrfValidation.valid) {
      return csrfError(csrfValidation.error || "CSRF validation failed");
    }

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
    const { listingId, paymentMethod, onChainTx } = body;

    // SECURITY: Require on-chain transaction proof before creating a transaction record.
    if (!onChainTx || typeof onChainTx !== 'string' || onChainTx.trim().length === 0) {
      return NextResponse.json(
        { error: "On-chain transaction signature is required" },
        { status: 400 }
      );
    }

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
      salePrice = Number(listing.buyNowPrice);
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
      
      salePrice = Number(winningBid.amount);
    }

    // SECURITY: Verify the on-chain transaction before creating any DB records.
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    if (!rpcUrl) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    try {
      const connection = new Connection(rpcUrl, "confirmed");
      const txInfo = await connection.getTransaction(onChainTx, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      });

      if (!txInfo) {
        return NextResponse.json(
          { error: "Transaction not found on-chain. Please wait for confirmation and try again." },
          { status: 400 }
        );
      }

      if (txInfo.meta?.err) {
        return NextResponse.json(
          { error: "On-chain transaction failed" },
          { status: 400 }
        );
      }
    } catch (verifyErr) {
      console.error("Error verifying on-chain tx:", verifyErr);
      return NextResponse.json(
        { error: "Unable to verify on-chain transaction. Please try again." },
        { status: 503 }
      );
    }

    // Calculate fees (3% for APP token, 5% for others)
    const platformFee = calculatePlatformFee(salePrice, listing.currency);
    const sellerProceeds = salePrice - platformFee;

    // Create transfer checklist based on listing assets (array format for consistency)
    const transferChecklist = [
      {
        id: "github",
        label: "GitHub Repository",
        description: "Transfer ownership of the repository to buyer",
        iconType: "github",
        required: !!listing.githubRepo,
        sellerConfirmed: false,
        sellerConfirmedAt: null,
        sellerEvidence: null,
        buyerConfirmed: false,
        buyerConfirmedAt: null,
      },
      {
        id: "domain",
        label: "Domain",
        description: "Transfer domain ownership via registrar",
        iconType: "domain",
        required: listing.hasDomain,
        sellerConfirmed: false,
        sellerConfirmedAt: null,
        sellerEvidence: null,
        buyerConfirmed: false,
        buyerConfirmedAt: null,
      },
      {
        id: "database",
        label: "Database Access",
        description: "Provide database credentials and data export",
        iconType: "database",
        required: listing.hasDatabase,
        sellerConfirmed: false,
        sellerConfirmedAt: null,
        sellerEvidence: null,
        buyerConfirmed: false,
        buyerConfirmedAt: null,
      },
      {
        id: "hosting",
        label: "Hosting Access",
        description: "Transfer hosting account access",
        iconType: "hosting",
        required: listing.hasHosting,
        sellerConfirmed: false,
        sellerConfirmedAt: null,
        sellerEvidence: null,
        buyerConfirmed: false,
        buyerConfirmedAt: null,
      },
      {
        id: "apiKeys",
        label: "API Keys & Credentials",
        description: "Share all necessary API keys and service credentials",
        iconType: "apiKeys",
        required: listing.hasApiKeys,
        sellerConfirmed: false,
        sellerConfirmedAt: null,
        sellerEvidence: null,
        buyerConfirmed: false,
        buyerConfirmedAt: null,
      },
      {
        id: "designFiles",
        label: "Design Files",
        description: "Share Figma/Sketch files",
        iconType: "designFiles",
        required: listing.hasDesignFiles,
        sellerConfirmed: false,
        sellerConfirmedAt: null,
        sellerEvidence: null,
        buyerConfirmed: false,
        buyerConfirmedAt: null,
      },
      {
        id: "documentation",
        label: "Documentation",
        description: "Provide setup guides and documentation",
        iconType: "documentation",
        required: listing.hasDocumentation,
        sellerConfirmed: false,
        sellerConfirmedAt: null,
        sellerEvidence: null,
        buyerConfirmed: false,
        buyerConfirmedAt: null,
      },
    ];

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
        paymentMethod: listing.currency === "USDC" ? "USDC" : listing.currency === "APP" ? "APP" : "SOL",
        onChainTx,
        status: "IN_ESCROW", // Always IN_ESCROW since onChainTx is now required and verified
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

    // NOTE: Seller stats (totalSales, totalVolume) are updated in transfers/[id]/complete
    // when the transaction is actually completed, not at creation time.
    // This prevents inflated stats from cancelled/disputed transactions.

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    console.error("Error creating transaction:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}
