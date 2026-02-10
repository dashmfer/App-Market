import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { encrypt } from "@/lib/encryption";
import { grindVanityKeypair, serializeKeypair } from "@/lib/vanity-keygen";
import {
  buildCreatePoolTransaction,
  buildCreatePoolWithFirstBuyTransaction,
  getPatoConfigKey,
  getPatoFeeClaimer,
  PATO_CONFIG,
  calculateFeeBreakdown,
} from "@/lib/meteora-dbc";
import { PLATFORM_CONFIG } from "@/lib/config";
import { PublicKey } from "@solana/web3.js";

/**
 * POST /api/token-launch — Create a PATO (Post-Acquisition Token Offering)
 *
 * Creates a token launch record and prepares the on-chain transaction
 * for the buyer to sign. The actual pool creation happens client-side
 * when the buyer signs and submits the transaction.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      transactionId,
      tokenName,
      tokenSymbol,
      tokenDescription,
      tokenImage,
      website,
      twitter,
      telegram,
      discord,
      initialBuyAmountSOL,
    } = body;

    // Validate required fields
    if (!transactionId || !tokenName || !tokenSymbol) {
      return NextResponse.json(
        { error: "Missing required fields: transactionId, tokenName, tokenSymbol" },
        { status: 400 }
      );
    }

    // Validate token symbol length (standard is 3-10 chars)
    if (tokenSymbol.length < 2 || tokenSymbol.length > 10) {
      return NextResponse.json(
        { error: "Token symbol must be between 2 and 10 characters" },
        { status: 400 }
      );
    }

    // Verify the user owns this acquisition
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        listing: true,
        tokenLaunch: true,
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    if (transaction.buyerId !== session.user.id) {
      return NextResponse.json(
        { error: "Only the buyer of this acquisition can launch a token" },
        { status: 403 }
      );
    }

    if (transaction.status !== "COMPLETED") {
      return NextResponse.json(
        {
          error:
            "Acquisition must be fully completed before launching a token. " +
            "Current status: " + transaction.status,
        },
        { status: 400 }
      );
    }

    // Check if a PATO already exists for this transaction
    if (transaction.tokenLaunch) {
      return NextResponse.json(
        {
          error: "A token has already been launched for this acquisition",
          existingLaunch: {
            id: transaction.tokenLaunch.id,
            status: transaction.tokenLaunch.status,
            tokenMint: transaction.tokenLaunch.tokenMint,
          },
        },
        { status: 409 }
      );
    }

    // Get the buyer's wallet address
    const buyer = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { walletAddress: true },
    });

    if (!buyer?.walletAddress) {
      return NextResponse.json(
        { error: "You must have a connected wallet to launch a token" },
        { status: 400 }
      );
    }

    // Grind a vanity keypair ending in 'app'
    const vanitySuffix = PLATFORM_CONFIG.pato.vanitySuffix;
    let vanityKeypair;
    try {
      vanityKeypair = grindVanityKeypair(vanitySuffix);
    } catch {
      return NextResponse.json(
        { error: "Failed to generate vanity address. Please try again." },
        { status: 500 }
      );
    }

    // Encrypt the keypair for secure storage
    const encryptedKeypair = encrypt(serializeKeypair(vanityKeypair));

    // Create the token launch record
    const tokenLaunch = await prisma.tokenLaunch.create({
      data: {
        tokenName,
        tokenSymbol: tokenSymbol.toUpperCase(),
        tokenDescription: tokenDescription || null,
        tokenImage: tokenImage || null,
        tokenMint: vanityKeypair.publicKey.toBase58(),
        totalSupply: BigInt(PLATFORM_CONFIG.pato.defaultTotalSupply) *
          BigInt(10 ** PLATFORM_CONFIG.pato.tokenDecimals),
        launchType: "PATO",
        bondingCurveStatus: "PENDING",
        graduationThreshold: PLATFORM_CONFIG.pato.graduationThresholdSOL,
        migrationFeeOption: PLATFORM_CONFIG.pato.migrationFeeOption,
        tradingFeeBps: PLATFORM_CONFIG.pato.tradingFeeBps,
        creatorFeePct: PLATFORM_CONFIG.pato.creatorFeePercentage,
        partnerLockedLpPct: PLATFORM_CONFIG.pato.lpDistribution.partnerPermanentLocked,
        creatorLockedLpPct: PLATFORM_CONFIG.pato.lpDistribution.creatorPermanentLocked,
        creatorWallet: buyer.walletAddress,
        vanityKeypair: encryptedKeypair,
        dbcConfigKey: PLATFORM_CONFIG.pato.configKey || undefined,
        status: "PENDING",
        transactionId: transaction.id,
        listingId: transaction.listingId,
        website: website || null,
        twitter: twitter || null,
        telegram: telegram || null,
        discord: discord || null,
      },
    });

    // Calculate fee breakdown for response
    const feeBreakdown = calculateFeeBreakdown(100); // Example: 100 SOL trade

    // Notify the buyer
    await prisma.notification.create({
      data: {
        userId: session.user.id,
        type: "PATO_LAUNCHED",
        title: "PATO Ready to Launch",
        message: `Your token "${tokenName}" ($${tokenSymbol.toUpperCase()}) is ready. Sign the transaction to deploy.`,
        data: {
          tokenLaunchId: tokenLaunch.id,
          tokenMint: vanityKeypair.publicKey.toBase58(),
          transactionId: transaction.id,
          listingId: transaction.listingId,
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        tokenLaunch: {
          id: tokenLaunch.id,
          tokenName,
          tokenSymbol: tokenSymbol.toUpperCase(),
          tokenMint: vanityKeypair.publicKey.toBase58(),
          totalSupply: PLATFORM_CONFIG.pato.defaultTotalSupply,
          status: "PENDING",
          bondingCurveStatus: "PENDING",
          graduationThreshold: `${PLATFORM_CONFIG.pato.graduationThresholdSOL} SOL`,
          feeBreakdown: {
            tradingFee: `${PLATFORM_CONFIG.pato.tradingFeeBps / 100}%`,
            meteoraCut: "20% of trading fee",
            platformCut: `${100 - PLATFORM_CONFIG.pato.creatorFeePercentage}% of partner share`,
            creatorCut: `${PLATFORM_CONFIG.pato.creatorFeePercentage}% of partner share`,
            example: {
              on100SOLTrade: feeBreakdown,
            },
          },
          lpDistribution: PLATFORM_CONFIG.pato.lpDistribution,
          postGradFee: "1%",
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[PATO] Error creating token launch:", error);
    return NextResponse.json(
      { error: "Failed to create token launch" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/token-launch — Get token launches for the authenticated user
 *
 * Query params:
 * - transactionId: Get launch for a specific acquisition
 * - listingId: Get launch for a specific listing
 * - status: Filter by status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get("transactionId");
    const listingId = searchParams.get("listingId");
    const status = searchParams.get("status");

    // Build query
    const where: any = {};

    if (transactionId) {
      where.transactionId = transactionId;
    }

    if (listingId) {
      where.listingId = listingId;
    }

    if (status) {
      where.status = status;
    }

    // Only return launches the user is involved in (as buyer/creator)
    where.OR = [
      { creatorWallet: (await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { walletAddress: true },
      }))?.walletAddress },
      { transaction: { buyerId: session.user.id } },
    ];

    const tokenLaunches = await prisma.tokenLaunch.findMany({
      where,
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            slug: true,
            thumbnailUrl: true,
          },
        },
        transaction: {
          select: {
            id: true,
            salePrice: true,
            currency: true,
            buyerId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedLaunches = tokenLaunches.map((launch: any) => ({
      id: launch.id,
      tokenName: launch.tokenName,
      tokenSymbol: launch.tokenSymbol,
      tokenMint: launch.tokenMint,
      tokenImage: launch.tokenImage,
      totalSupply: launch.totalSupply.toString(),
      status: launch.status,
      bondingCurveStatus: launch.bondingCurveStatus,
      tradingFeeBps: launch.tradingFeeBps,
      creatorFeePct: launch.creatorFeePct,
      graduationThreshold: launch.graduationThreshold.toString(),
      dbcPoolAddress: launch.dbcPoolAddress,
      dammPoolAddress: launch.dammPoolAddress,
      totalBondingCurveFeesSOL: launch.totalBondingCurveFeesSOL.toString(),
      totalPostGradFeesSOL: launch.totalPostGradFeesSOL.toString(),
      creatorFeesClaimedSOL: launch.creatorFeesClaimedSOL.toString(),
      platformFeesClaimedSOL: launch.platformFeesClaimedSOL.toString(),
      listing: launch.listing,
      transaction: launch.transaction
        ? {
            id: launch.transaction.id,
            salePrice: launch.transaction.salePrice.toString(),
            currency: launch.transaction.currency,
          }
        : null,
      createdAt: launch.createdAt,
      launchedAt: launch.launchedAt,
      graduatedAt: launch.graduatedAt,
    }));

    return NextResponse.json({ tokenLaunches: formattedLaunches });
  } catch (error: any) {
    console.error("[PATO] Error fetching token launches:", error);
    return NextResponse.json(
      { error: "Failed to fetch token launches" },
      { status: 500 }
    );
  }
}
