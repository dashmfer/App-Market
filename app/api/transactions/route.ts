import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthToken } from "@/lib/auth";
import { calculatePlatformFee, calculateSellerProceeds, safeAmountToLamports } from "@/lib/solana";
import { validateCsrfRequest, csrfError } from "@/lib/csrf";
import { withRateLimitAsync } from "@/lib/rate-limit";
import { audit, auditContext } from "@/lib/audit";

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
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const take = 50;
    const skip = (page - 1) * take;

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
      take,
      skip,
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

    return NextResponse.json({ transactions, page, take });
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

    // SECURITY: Rate limit transaction creation
    const rateLimitResult = await (withRateLimitAsync('write', 'transactions'))(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: 429, headers: rateLimitResult.headers }
      );
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

    // SECURITY: Validate required fields
    if (!listingId) {
      return NextResponse.json(
        { error: "Missing required field: listingId" },
        { status: 400 }
      );
    }

    // SECURITY: Use serializable transaction to prevent double-purchase race condition
    const txResult = await prisma.$transaction(async (tx) => {
      // Get listing inside transaction for atomicity
      const listing = await tx.listing.findUnique({
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
        return { error: "Listing not found", status: 404 } as const;
      }

      // Prevent purchasing your own listing
      if (listing.sellerId === userId) {
        return { error: "Cannot purchase your own listing", status: 400 } as const;
      }

      // SECURITY: Atomic check — if transaction already exists, reject (prevents double-purchase)
      const existingTransaction = await tx.transaction.findFirst({
        where: { listingId, status: { notIn: ["CANCELLED", "REFUNDED"] } },
      });

      if (existingTransaction) {
        return { error: "This listing has already been purchased", status: 400 } as const;
      }

      // Determine sale price (winning bid or buy now price)
      let salePrice: number;

      if (paymentMethod === "BUY_NOW") {
        // Verify listing is still active for BUY_NOW purchases
        if (listing.status !== "ACTIVE" && listing.status !== "RESERVED") {
          return { error: "Listing is no longer available for purchase", status: 400 } as const;
        }
        if (!listing.buyNowEnabled || !listing.buyNowPrice) {
          return { error: "Buy Now not available", status: 400 } as const;
        }
        salePrice = Number(listing.buyNowPrice);
        if (!isFinite(salePrice) || salePrice <= 0) {
          return { error: "Invalid sale price", status: 400 } as const;
        }
      } else {
        // Auction win
        if (listing.status !== "ENDED" && new Date() < listing.endTime) {
          return { error: "Auction has not ended yet", status: 400 } as const;
        }

        const winningBid = listing.bids[0];
        if (!winningBid || winningBid.bidderId !== userId) {
          return { error: "You did not win this auction", status: 400 } as const;
        }

        // SECURITY FIX: Use safeAmountToLamports for precision-safe conversion
        salePrice = safeAmountToLamports(winningBid.amount);
        if (!isFinite(salePrice) || salePrice <= 0) {
          return { error: "Invalid sale price", status: 400 } as const;
        }
      }

      // Calculate fees (3% for APP token, 5% for others)
      const platformFee = calculatePlatformFee(salePrice, listing.currency);
      const sellerProceeds = salePrice - platformFee;

      // Create transfer checklist based on listing assets
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

      // Create transaction atomically
      const transaction = await tx.transaction.create({
        data: {
          salePrice,
          platformFee,
          sellerProceeds,
          currency: listing.currency,
          paymentMethod: listing.currency === "USDC" ? "USDC" : listing.currency === "APP" ? "APP" : "SOL",
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

      // Lock the required buyer info on the listing atomically
      if (hasRequiredBuyerInfo) {
        await tx.listing.update({
          where: { id: listingId },
          data: { buyerInfoLocked: true },
        });
      }

      // Update listing status atomically
      await tx.listing.update({
        where: { id: listingId },
        data: { status: "SOLD" },
      });

      return { transaction, listing, hasRequiredBuyerInfo } as const;
    }, {
      isolationLevel: 'Serializable',
    });

    // Handle transaction errors
    if ('error' in txResult) {
      return NextResponse.json(
        { error: txResult.error },
        { status: txResult.status }
      );
    }

    const { transaction, listing, hasRequiredBuyerInfo } = txResult;

    // Notifications outside transaction (non-critical, fire-and-forget)
    prisma.notification.create({
      data: {
        type: "AUCTION_WON",
        title: "Your project has been sold!",
        message: hasRequiredBuyerInfo
          ? `"${listing.title}" sold for ${transaction.salePrice} ${listing.currency}. The buyer has 48 hours to provide their transfer information.`
          : `"${listing.title}" sold for ${transaction.salePrice} ${listing.currency}`,
        data: { transactionId: transaction.id, listingSlug: listing.slug },
        userId: listing.sellerId,
      },
    }).catch(console.error);

    if (hasRequiredBuyerInfo) {
      prisma.notification.create({
        data: {
          type: "BUYER_INFO_REQUIRED",
          title: "Action Required: Provide Transfer Info",
          message: `You have 48 hours to provide your information for "${listing.title}" so the seller can complete the transfer.`,
          data: { link: `/dashboard/transfers/${transaction.id}/buyer-info` },
          userId,
        },
      }).catch(console.error);
    }

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    console.error("Error creating transaction:", error);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}
