import { NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import prisma from "@/lib/db";
import { generateAPAContent, generateNonCompeteContent, getAssetsList } from "@/lib/agreements";
import nacl from "tweetnacl";
import bs58 from "bs58";

// GET /api/transactions/[id]/agreements - Get agreements for a transaction
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = await getAuthToken(request);
    if (!token?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = token.id as string;
    const { id: transactionId } = params;

    // Get transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        listing: {
          select: {
            title: true,
            description: true,
            githubRepo: true,
            hasDomain: true,
            domain: true,
            hasDatabase: true,
            databaseType: true,
            hasHosting: true,
            hostingProvider: true,
            hasVercel: true,
            hasApiKeys: true,
            hasDesignFiles: true,
            hasDocumentation: true,
            hasSocialAccounts: true,
            additionalAssets: true,
          },
        },
        buyer: {
          select: {
            id: true,
            username: true,
            displayName: true,
            walletAddress: true,
            email: true,
          },
        },
        seller: {
          select: {
            id: true,
            username: true,
            displayName: true,
            walletAddress: true,
            email: true,
          },
        },
        agreements: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Check if user is part of the transaction
    if (transaction.buyerId !== userId && transaction.sellerId !== userId) {
      return NextResponse.json(
        { error: "You are not part of this transaction" },
        { status: 403 }
      );
    }

    // Get existing agreements
    const agreements = transaction.agreements;

    // Check if APA exists
    const hasAPA = agreements.some((a: { type: string }) => a.type === "ASSET_PURCHASE");
    const hasNonCompete = agreements.some((a: { type: string }) => a.type === "NON_COMPETE");

    // Generate APA content if needed (for preview)
    const apaContent = generateAPAContent(
      {
        name: transaction.seller.displayName || transaction.seller.username || "Seller",
        walletAddress: transaction.seller.walletAddress || "",
        email: transaction.seller.email || undefined,
      },
      {
        name: transaction.buyer.displayName || transaction.buyer.username || "Buyer",
        walletAddress: transaction.buyer.walletAddress || "",
        email: transaction.buyer.email || undefined,
      },
      {
        title: transaction.listing.title,
        description: transaction.listing.description,
        price: transaction.salePrice,
        currency: transaction.currency,
        assets: getAssetsList(transaction.listing),
      },
      transactionId
    );

    return NextResponse.json({
      agreements,
      hasAPA,
      hasNonCompete,
      apaPreview: !hasAPA ? apaContent : null,
      transaction: {
        id: transaction.id,
        status: transaction.status,
        amount: transaction.salePrice,
        currency: transaction.currency,
      },
    });
  } catch (error) {
    console.error("Error fetching agreements:", error);
    return NextResponse.json(
      { error: "Failed to fetch agreements" },
      { status: 500 }
    );
  }
}

// POST /api/transactions/[id]/agreements - Create or sign an agreement
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = await getAuthToken(request);
    if (!token?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = token.id as string;
    const { id: transactionId } = params;

    const body = await request.json();
    const { type, signature, signedMessage, walletAddress, nonCompeteDurationYears } = body;

    if (!type || !["ASSET_PURCHASE", "NON_COMPETE"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid agreement type" },
        { status: 400 }
      );
    }

    // Get transaction with details
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        listing: true,
        buyer: {
          select: {
            id: true,
            username: true,
            displayName: true,
            walletAddress: true,
            email: true,
          },
        },
        seller: {
          select: {
            id: true,
            username: true,
            displayName: true,
            walletAddress: true,
            email: true,
          },
        },
        agreements: {
          where: { type },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    const isBuyer = transaction.buyerId === userId;
    const isSeller = transaction.sellerId === userId;

    if (!isBuyer && !isSeller) {
      return NextResponse.json(
        { error: "You are not part of this transaction" },
        { status: 403 }
      );
    }

    // Verify signature if provided
    if (signature && signedMessage && walletAddress) {
      try {
        const messageBytes = new TextEncoder().encode(signedMessage);
        const signatureBytes = bs58.decode(signature);
        const publicKeyBytes = bs58.decode(walletAddress);

        const isValid = nacl.sign.detached.verify(
          messageBytes,
          signatureBytes,
          publicKeyBytes
        );

        if (!isValid) {
          return NextResponse.json(
            { error: "Invalid signature" },
            { status: 400 }
          );
        }
      } catch (error) {
        return NextResponse.json(
          { error: "Failed to verify signature" },
          { status: 400 }
        );
      }
    }

    // Check for existing agreement
    const existingAgreement = transaction.agreements[0];

    if (existingAgreement) {
      // Update existing agreement with new signature
      const updateData: any = {};

      if (isBuyer && !existingAgreement.buyerSigned) {
        updateData.buyerSigned = true;
        updateData.buyerSignature = signature;
        updateData.buyerSignedAt = new Date();
      } else if (isSeller && !existingAgreement.sellerSigned) {
        updateData.sellerSigned = true;
        updateData.sellerSignature = signature;
        updateData.sellerSignedAt = new Date();
      } else {
        return NextResponse.json(
          { error: "You have already signed this agreement" },
          { status: 400 }
        );
      }

      // Check if both parties have signed
      const bothSigned =
        (updateData.buyerSigned || existingAgreement.buyerSigned) &&
        (updateData.sellerSigned || existingAgreement.sellerSigned);

      if (bothSigned) {
        updateData.status = "COMPLETED";
      }

      const updatedAgreement = await prisma.transactionAgreement.update({
        where: { id: existingAgreement.id },
        data: updateData,
      });

      // Notify both parties when agreement is fully signed
      if (bothSigned) {
        const agreementName = type === "ASSET_PURCHASE" ? "Asset Purchase Agreement" : "Non-Compete Agreement";
        await Promise.all([
          prisma.notification.create({
            data: {
              type: "SYSTEM",
              title: `${agreementName} Completed`,
              message: `The ${agreementName.toLowerCase()} has been signed by both parties.`,
              userId: transaction.buyerId,
              data: {
                transactionId,
                agreementId: updatedAgreement.id,
                agreementType: type,
              },
            },
          }),
          prisma.notification.create({
            data: {
              type: "SYSTEM",
              title: `${agreementName} Completed`,
              message: `The ${agreementName.toLowerCase()} has been signed by both parties.`,
              userId: transaction.sellerId,
              data: {
                transactionId,
                agreementId: updatedAgreement.id,
                agreementType: type,
              },
            },
          }),
        ]);
      }

      return NextResponse.json({ agreement: updatedAgreement });
    }

    // Create new agreement
    const sellerParty = {
      name: transaction.seller.displayName || transaction.seller.username || "Seller",
      walletAddress: transaction.seller.walletAddress || "",
      email: transaction.seller.email || undefined,
    };

    const buyerParty = {
      name: transaction.buyer.displayName || transaction.buyer.username || "Buyer",
      walletAddress: transaction.buyer.walletAddress || "",
      email: transaction.buyer.email || undefined,
    };

    const listingDetails = {
      title: transaction.listing.title,
      description: transaction.listing.description,
      price: transaction.salePrice,
      currency: transaction.currency,
      assets: getAssetsList(transaction.listing),
    };

    let termsContent: string;

    if (type === "ASSET_PURCHASE") {
      termsContent = generateAPAContent(sellerParty, buyerParty, listingDetails, transactionId);
    } else {
      // Non-compete
      const duration = (nonCompeteDurationYears || 2) as 1 | 2 | 3;
      termsContent = generateNonCompeteContent(
        sellerParty,
        buyerParty,
        listingDetails,
        duration,
        transactionId
      );
    }

    const agreement = await prisma.transactionAgreement.create({
      data: {
        transactionId,
        type,
        termsContent,
        nonCompeteDurationYears: type === "NON_COMPETE" ? (nonCompeteDurationYears || 2) : null,
        buyerSigned: isBuyer,
        buyerSignature: isBuyer ? signature : null,
        buyerSignedAt: isBuyer ? new Date() : null,
        sellerSigned: isSeller,
        sellerSignature: isSeller ? signature : null,
        sellerSignedAt: isSeller ? new Date() : null,
        status: "PENDING",
      },
    });

    // Notify the other party
    const otherPartyId = isBuyer ? transaction.sellerId : transaction.buyerId;
    await prisma.notification.create({
      data: {
        type: "SYSTEM",
        title: `${type === "ASSET_PURCHASE" ? "Asset Purchase Agreement" : "Non-Compete Agreement"} Created`,
        message: `A ${type === "ASSET_PURCHASE" ? "purchase agreement" : "non-compete agreement"} has been created for your transaction. Please review and sign.`,
        userId: otherPartyId,
        data: {
          transactionId,
          agreementId: agreement.id,
          agreementType: type,
        },
      },
    });

    return NextResponse.json({ agreement }, { status: 201 });
  } catch (error) {
    console.error("Error creating/signing agreement:", error);
    return NextResponse.json(
      { error: "Failed to process agreement" },
      { status: 500 }
    );
  }
}
