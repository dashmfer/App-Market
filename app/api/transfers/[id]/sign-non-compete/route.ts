import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthToken } from "@/lib/auth";
import { validateCsrfRequest, csrfError } from '@/lib/csrf';
import { checkAndMarkNonce } from "@/lib/validation";
import nacl from "tweetnacl";
import bs58 from "bs58";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // SECURITY: Validate CSRF token
    const csrfValidation = validateCsrfRequest(request);
    if (!csrfValidation.valid) {
      return csrfError(csrfValidation.error || 'CSRF validation failed');
    }

    const token = await getAuthToken(request);
    if (!token?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // SECURITY [L5]: Require wallet signature for non-compete
    const body = await request.json();
    const { signature, walletAddress, timestamp } = body;

    if (!signature || !walletAddress || !timestamp) {
      return NextResponse.json(
        { error: "Wallet signature, address, and timestamp are required" },
        { status: 400 }
      );
    }

    // SECURITY: Validate timestamp is recent (5 minute window)
    const messageDate = new Date(timestamp);
    if (isNaN(messageDate.getTime())) {
      return NextResponse.json({ error: "Invalid timestamp" }, { status: 400 });
    }
    const ageSeconds = (Date.now() - messageDate.getTime()) / 1000;
    if (ageSeconds > 300 || ageSeconds < -30) {
      return NextResponse.json({ error: "Signature expired" }, { status: 400 });
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: params.id },
      include: {
        listing: {
          select: {
            offersNonCompete: true,
            nonCompeteDurationYears: true,
            title: true,
          },
        },
        seller: {
          select: { walletAddress: true },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
    }

    // Only seller can sign Non-Compete
    if (transaction.sellerId !== token.id as string) {
      return NextResponse.json(
        { error: "Only the seller can sign the Non-Compete Agreement" },
        { status: 403 }
      );
    }

    // Verify the wallet belongs to the seller
    if (transaction.seller.walletAddress !== walletAddress) {
      return NextResponse.json(
        { error: "Wallet address does not match seller's wallet" },
        { status: 403 }
      );
    }

    // Check if Non-Compete was offered or requested
    if (!transaction.listing.offersNonCompete && !transaction.buyerRequestedNonCompete) {
      return NextResponse.json(
        { error: "Non-Compete was not offered or requested for this transaction" },
        { status: 400 }
      );
    }

    // Check if already signed
    if (transaction.nonCompeteSigned) {
      return NextResponse.json(
        { error: "Non-Compete Agreement has already been signed" },
        { status: 400 }
      );
    }

    // SECURITY [L5]: Verify the cryptographic wallet signature
    const duration = transaction.listing.nonCompeteDurationYears || 2;
    const expectedMessage = `I agree to the Non-Compete Agreement for "${transaction.listing.title}" (Transaction: ${transaction.id}, Duration: ${duration} years)\n\nTimestamp: ${timestamp}`;

    try {
      const messageBytes = new TextEncoder().encode(expectedMessage);
      const signatureBytes = bs58.decode(signature);
      const publicKeyBytes = bs58.decode(walletAddress);

      const isValid = nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        publicKeyBytes
      );

      if (!isValid) {
        return NextResponse.json(
          { error: "Invalid wallet signature" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Failed to verify wallet signature" },
        { status: 400 }
      );
    }

    // SECURITY: Prevent signature replay attacks
    const nonceKey = `non-compete:${params.id}:${signature.slice(0, 32)}`;
    const nonceResult = await checkAndMarkNonce(nonceKey);
    if (nonceResult.used) {
      return NextResponse.json(
        { error: "This signature has already been used" },
        { status: 400 }
      );
    }

    // Store the cryptographic signature (base58-encoded)
    await prisma.transaction.update({
      where: { id: params.id },
      data: {
        nonCompeteSigned: true,
        nonCompeteSignedAt: new Date(),
        nonCompeteSignature: signature,
      },
    });

    // Create notification for buyer
    await prisma.notification.create({
      data: {
        userId: transaction.buyerId,
        type: "AGREEMENT_SIGNED",
        title: "Non-Compete Signed",
        message: `The seller has signed a ${duration}-year Non-Compete Agreement for "${transaction.listing.title}"`,
        data: {
          transactionId: transaction.id,
          agreementType: "NON_COMPETE",
          duration,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Non-Compete Agreement signed successfully",
    });
  } catch (error) {
    console.error("Error signing Non-Compete:", error);
    return NextResponse.json(
      { error: "Failed to sign Non-Compete Agreement" },
      { status: 500 }
    );
  }
}
