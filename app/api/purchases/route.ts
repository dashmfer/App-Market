import { NextRequest, NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";
import prisma from "@/lib/db";
import { getAuthToken } from "@/lib/auth";
import { calculatePlatformFee, calculateSellerProceeds } from "@/lib/solana";
import { withRateLimitAsync, getClientIp } from "@/lib/rate-limit";
import { audit, auditContext } from "@/lib/audit";

// POST /api/purchases - Create a purchase (Buy Now)
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limit
    const rateLimitResult = await (withRateLimitAsync('write', 'purchases'))(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: 429, headers: rateLimitResult.headers }
      );
    }

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

    // SECURITY: Validate amount is positive
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 }
      );
    }

    // SECURITY: On-chain transaction verification is mandatory for purchases.
    // A purchase without a verified on-chain payment must not proceed.
    if (!onChainTx) {
      return NextResponse.json(
        { error: "On-chain transaction signature is required" },
        { status: 400 }
      );
    }

    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    if (!rpcUrl) {
      console.error("NEXT_PUBLIC_SOLANA_RPC_URL is not configured");
      return NextResponse.json(
        { error: "Server configuration error. Please try again later." },
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
      // SECURITY: Do NOT proceed without successful verification.
      // If RPC is unavailable, the user must retry.
      return NextResponse.json(
        { error: "Unable to verify on-chain transaction. Please try again." },
        { status: 503 }
      );
    }

    // SECURITY: Use serializable transaction to prevent double-purchase race condition
    const txResult = await prisma.$transaction(async (tx) => {
      // Get listing with seller info inside transaction
      const listing = await tx.listing.findUnique({
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
        return { error: "Listing not found", status: 404 } as const;
      }

      if (listing.status !== "ACTIVE") {
        return { error: "Listing is not available for purchase", status: 400 } as const;
      }

      if (listing.endTime && new Date() > new Date(listing.endTime)) {
        return { error: "This listing has expired", status: 400 } as const;
      }

      if (listing.sellerId === userId) {
        return { error: "You cannot buy your own listing", status: 400 } as const;
      }

      // SECURITY: Validate purchase amount matches listing price
      if (purchaseType === "buyNow") {
        if (!listing.buyNowEnabled || !listing.buyNowPrice) {
          return { error: "Buy Now is not available for this listing", status: 400 } as const;
        }
        if (amount < Number(listing.buyNowPrice)) {
          return { error: `Payment amount must be at least ${listing.buyNowPrice} ${listing.currency}`, status: 400 } as const;
        }
      } else {
        const highestBid = await tx.bid.findFirst({
          where: { listingId, isWinning: true },
          orderBy: { amount: 'desc' },
        });
        if (highestBid && amount < Number(highestBid.amount)) {
          return { error: "Amount does not match winning bid", status: 400 } as const;
        }
      }

      // Calculate fees
      const platformFee = calculatePlatformFee(amount, currency);
      const { proceeds: sellerProceeds } = calculateSellerProceeds(amount, currency);

      // SECURITY: Atomic check — if transaction already exists, reject (prevents double-purchase)
      const existingTransaction = await tx.transaction.findUnique({
        where: { listingId },
      });

      if (existingTransaction) {
        return { error: "This listing has already been purchased", status: 400 } as const;
      }

      const buyerInfoDeadline = listing.requiredBuyerInfo
        ? new Date(Date.now() + 48 * 60 * 60 * 1000)
        : null;

      const initialStatus = withPartners ? "AWAITING_PARTNER_DEPOSITS" : "IN_ESCROW";
      const partnerDepositDeadline = withPartners
        ? new Date(Date.now() + 30 * 60 * 1000)
        : null;

      // Create transaction atomically
      const transaction = await tx.transaction.create({
        data: {
          salePrice: amount,
          platformFee,
          sellerProceeds,
          currency: currency || listing.currency,
          paymentMethod: (currency || listing.currency) === "USDC" ? "USDC" : (currency || listing.currency) === "APP" ? "APP" : "SOL",
          onChainTx,
          status: initialStatus,
          listingId,
          buyerId: userId,
          sellerId: listing.sellerId,
          paidAt: withPartners ? null : new Date(),
          buyerInfoDeadline: withPartners ? null : buyerInfoDeadline,
          buyerInfoStatus: listing.requiredBuyerInfo ? "PENDING" : "PROVIDED",
          hasPartners: withPartners || false,
          partnerDepositDeadline,
        },
      });

      // If partner purchase, create partners atomically
      if (withPartners && partners && partners.length > 0) {
        await tx.transactionPartner.create({
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

        for (const partner of partners) {
          await tx.transactionPartner.create({
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
        }
      }

      // Update listing status atomically
      if (!withPartners) {
        await tx.listing.update({
          where: { id: listingId },
          data: { status: "SOLD" },
        });
      }

      return { transaction, listing, partnerDepositDeadline, buyerInfoDeadline } as const;
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

    const { transaction, listing, partnerDepositDeadline, buyerInfoDeadline } = txResult;

    // Notifications outside transaction (non-critical, fire-and-forget)
    if (withPartners && partners && partners.length > 0) {
      for (const partner of partners) {
        if (partner.userId) {
          prisma.notification.create({
            data: {
              type: "PURCHASE_PARTNER_INVITE",
              title: "Purchase Partner Invite",
              message: `You've been invited to co-purchase "${listing.title}" with ${Number(partner.percentage)}% share (${Number(partner.depositAmount)} SOL)`,
              data: {
                listingId,
                listingSlug: listing.slug,
                transactionId: transaction.id,
                percentage: Number(partner.percentage),
                depositAmount: Number(partner.depositAmount),
                deadline: partnerDepositDeadline?.toISOString(),
              },
              userId: partner.userId,
            },
          }).catch(console.error);
        }
      }
    }

    // NOTE: Buyer stats (totalPurchases, totalVolume) are updated on transaction
    // completion in the confirm route, not here at purchase time, to avoid double-counting

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

    await audit({
      action: "TRANSACTION_CREATED",
      userId,
      targetId: transaction.id,
      targetType: "transaction",
      detail: `Purchase of ${Number(transaction.salePrice)} ${transaction.currency}`,
      metadata: { listingId: transaction.listingId, salePrice: Number(transaction.salePrice) },
      ...auditContext(request.headers),
    });

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
