import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthToken } from "@/lib/auth";
import nacl from "tweetnacl";
import bs58 from "bs58";

// Standard NDA template when seller doesn't provide custom terms
const STANDARD_NDA_TEMPLATE = `NON-DISCLOSURE AGREEMENT

By signing this agreement, I acknowledge and agree to the following:

1. CONFIDENTIALITY: I will treat all information disclosed to me regarding this listing as strictly confidential. This includes, but is not limited to: business metrics, revenue data, user information, technical details, code architecture, and any other proprietary information.

2. NON-DISCLOSURE: I will not disclose, publish, or otherwise reveal any confidential information to any third party without the prior written consent of the seller.

3. PURPOSE: I will use the confidential information solely for the purpose of evaluating this acquisition opportunity.

4. RETURN OF INFORMATION: If I decide not to proceed with the acquisition, I will not retain any copies of confidential information disclosed to me.

5. BINDING AGREEMENT: This NDA is legally binding and my wallet signature serves as my digital signature confirming my agreement to these terms.

6. DURATION: This obligation of confidentiality shall remain in effect for a period of two (2) years from the date of signing.`;

// GET /api/listings/[slug]/nda - Check NDA status for current user
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const token = await getAuthToken(request);

    if (!token?.id) {
      return NextResponse.json({ signed: false, requiresNDA: false });
    }

    const { slug } = params;
    const userId = token.id as string;

    // Get listing
    const listing = await prisma.listing.findUnique({
      where: { slug },
      select: {
        id: true,
        requiresNDA: true,
        ndaTerms: true,
        title: true,
        sellerId: true,
      },
    });

    if (!listing) {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 }
      );
    }

    // Seller doesn't need to sign NDA for their own listing
    if (listing.sellerId === userId) {
      return NextResponse.json({
        signed: true,
        requiresNDA: listing.requiresNDA,
        isSeller: true,
      });
    }

    // If listing doesn't require NDA
    if (!listing.requiresNDA) {
      return NextResponse.json({
        signed: true,
        requiresNDA: false,
      });
    }

    // Check if user has signed NDA
    const existingNDA = await prisma.listingNDA.findUnique({
      where: {
        listingId_signerId: {
          listingId: listing.id,
          signerId: userId,
        },
      },
      select: {
        id: true,
        signedAt: true,
      },
    });

    const ndaTerms = listing.ndaTerms || STANDARD_NDA_TEMPLATE;

    return NextResponse.json({
      signed: !!existingNDA,
      signedAt: existingNDA?.signedAt || null,
      requiresNDA: true,
      ndaTerms,
      listingTitle: listing.title,
    });
  } catch (error) {
    console.error("Error checking NDA status:", error);
    return NextResponse.json(
      { error: "Failed to check NDA status" },
      { status: 500 }
    );
  }
}

// POST /api/listings/[slug]/nda - Sign NDA
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const token = await getAuthToken(request);

    if (!token?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { slug } = params;
    const userId = token.id as string;

    const body = await request.json();
    const { signature, signedMessage, walletAddress } = body;

    if (!signature || !signedMessage || !walletAddress) {
      return NextResponse.json(
        { error: "Missing signature, message, or wallet address" },
        { status: 400 }
      );
    }

    // Get listing
    const listing = await prisma.listing.findUnique({
      where: { slug },
      select: {
        id: true,
        requiresNDA: true,
        ndaTerms: true,
        sellerId: true,
      },
    });

    if (!listing) {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 }
      );
    }

    // Seller cannot sign NDA for their own listing
    if (listing.sellerId === userId) {
      return NextResponse.json(
        { error: "You cannot sign an NDA for your own listing" },
        { status: 400 }
      );
    }

    // Check if listing requires NDA
    if (!listing.requiresNDA) {
      return NextResponse.json(
        { error: "This listing does not require an NDA" },
        { status: 400 }
      );
    }

    // Check if user has already signed
    const existingNDA = await prisma.listingNDA.findUnique({
      where: {
        listingId_signerId: {
          listingId: listing.id,
          signerId: userId,
        },
      },
    });

    if (existingNDA) {
      return NextResponse.json(
        { error: "You have already signed the NDA for this listing" },
        { status: 400 }
      );
    }

    // Verify the wallet signature
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
      console.error("Signature verification error:", error);
      return NextResponse.json(
        { error: "Failed to verify signature" },
        { status: 400 }
      );
    }

    // Verify user owns this wallet
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { walletAddress: true },
    });

    if (user?.walletAddress !== walletAddress) {
      // Also check in UserWallet table
      const userWallet = await prisma.userWallet.findFirst({
        where: {
          userId,
          walletAddress,
        },
      });

      if (!userWallet) {
        return NextResponse.json(
          { error: "Wallet address does not match your account" },
          { status: 400 }
        );
      }
    }

    // Create NDA record
    const nda = await prisma.listingNDA.create({
      data: {
        listingId: listing.id,
        signerId: userId,
        signerWallet: walletAddress,
        signature,
        signedMessage,
        termsVersion: "1.0",
      },
    });

    // Get signer info and listing title for notification
    const [signer, listingInfo] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, displayName: true },
      }),
      prisma.listing.findUnique({
        where: { id: listing.id },
        select: { title: true },
      }),
    ]);

    const signerName = signer?.displayName || signer?.username || "A buyer";

    // Notify seller that NDA was signed
    await prisma.notification.create({
      data: {
        type: "SYSTEM",
        title: "NDA Signed",
        message: `${signerName} has signed the NDA for "${listingInfo?.title}" and can now view confidential information.`,
        userId: listing.sellerId,
        data: {
          listingId: listing.id,
          ndaId: nda.id,
          signerId: userId,
        },
      },
    });

    return NextResponse.json({
      success: true,
      ndaId: nda.id,
      signedAt: nda.signedAt,
    });
  } catch (error) {
    console.error("Error signing NDA:", error);
    return NextResponse.json(
      { error: "Failed to sign NDA" },
      { status: 500 }
    );
  }
}
