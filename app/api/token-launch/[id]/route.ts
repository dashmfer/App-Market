import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthToken } from "@/lib/auth";
import { getPoolState, calculateFeeBreakdown } from "@/lib/meteora-dbc";
import { PublicKey } from "@solana/web3.js";
import { PLATFORM_CONFIG } from "@/lib/config";

/**
 * GET /api/token-launch/[id] — Get detailed info for a specific PATO
 *
 * Returns token launch details, on-chain pool state, and fee info.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = await getAuthToken(request);
    if (!token?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tokenLaunch = await prisma.tokenLaunch.findUnique({
      where: { id: params.id },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            slug: true,
            thumbnailUrl: true,
            categories: true,
          },
        },
        transaction: {
          select: {
            id: true,
            salePrice: true,
            currency: true,
            buyerId: true,
            sellerId: true,
            transferCompletedAt: true,
          },
        },
      },
    });

    if (!tokenLaunch) {
      return NextResponse.json(
        { error: "Token launch not found" },
        { status: 404 }
      );
    }

    // Check user is involved (buyer or admin)
    const user = await prisma.user.findUnique({
      where: { id: token.id as string },
      select: { isAdmin: true, walletAddress: true },
    });

    const isBuyer = tokenLaunch.transaction.buyerId === token.id as string;
    const isCreator = tokenLaunch.creatorWallet === user?.walletAddress;
    const isAdmin = user?.isAdmin;

    if (!isBuyer && !isCreator && !isAdmin) {
      return NextResponse.json(
        { error: "You don't have access to this token launch" },
        { status: 403 }
      );
    }

    // Try to fetch on-chain pool state if pool is deployed
    let onChainState = null;
    if (tokenLaunch.dbcPoolAddress) {
      try {
        const poolState = await getPoolState(
          new PublicKey(tokenLaunch.dbcPoolAddress)
        );
        onChainState = {
          pool: tokenLaunch.dbcPoolAddress,
          // Serialize BN fields to strings
          ...(poolState ? JSON.parse(JSON.stringify(poolState, (_, v) =>
            typeof v === "bigint" ? v.toString() : v
          )) : {}),
        };
      } catch {
        // Pool might not exist yet or RPC error
        onChainState = null;
      }
    }

    // Fee breakdown
    const feeBreakdown = calculateFeeBreakdown(100);

    const response = {
      id: tokenLaunch.id,
      tokenName: tokenLaunch.tokenName,
      tokenSymbol: tokenLaunch.tokenSymbol,
      tokenMint: tokenLaunch.tokenMint,
      tokenImage: tokenLaunch.tokenImage,
      tokenDescription: tokenLaunch.tokenDescription,
      totalSupply: tokenLaunch.totalSupply.toString(),

      // Status
      status: tokenLaunch.status,
      bondingCurveStatus: tokenLaunch.bondingCurveStatus,

      // Config
      tradingFeeBps: tokenLaunch.tradingFeeBps,
      creatorFeePct: tokenLaunch.creatorFeePct,
      graduationThreshold: tokenLaunch.graduationThreshold.toString(),
      migrationFeeOption: tokenLaunch.migrationFeeOption,
      partnerLockedLpPct: tokenLaunch.partnerLockedLpPct,
      creatorLockedLpPct: tokenLaunch.creatorLockedLpPct,

      // On-chain addresses
      dbcPoolAddress: tokenLaunch.dbcPoolAddress,
      dammPoolAddress: tokenLaunch.dammPoolAddress,
      dbcConfigKey: tokenLaunch.dbcConfigKey,

      // Fee tracking
      fees: {
        totalBondingCurveFeesSOL: tokenLaunch.totalBondingCurveFeesSOL.toString(),
        totalPostGradFeesSOL: tokenLaunch.totalPostGradFeesSOL.toString(),
        creatorFeesClaimedSOL: tokenLaunch.creatorFeesClaimedSOL.toString(),
        platformFeesClaimedSOL: tokenLaunch.platformFeesClaimedSOL.toString(),
        breakdown: feeBreakdown,
      },

      // Social links
      socials: {
        website: tokenLaunch.website,
        twitter: tokenLaunch.twitter,
        telegram: tokenLaunch.telegram,
        discord: tokenLaunch.discord,
      },

      // Related entities
      listing: tokenLaunch.listing,
      transaction: {
        id: tokenLaunch.transaction.id,
        salePrice: tokenLaunch.transaction.salePrice.toString(),
        currency: tokenLaunch.transaction.currency,
        completedAt: tokenLaunch.transaction.transferCompletedAt,
      },

      // On-chain state (if available)
      onChainState,

      // Timestamps
      createdAt: tokenLaunch.createdAt,
      launchedAt: tokenLaunch.launchedAt,
      graduatedAt: tokenLaunch.graduatedAt,

      // User context
      isCreator: isBuyer || isCreator,
      canClaimCreatorFees: isBuyer || isCreator,
      canClaimPartnerFees: isAdmin,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("[PATO] Error fetching token launch:", error);
    return NextResponse.json(
      { error: "Failed to fetch token launch details" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/token-launch/[id] — Update token launch status
 *
 * Called after the client submits the on-chain transaction.
 * Updates the status based on on-chain confirmation.
 *
 * Body:
 * - status: "LIVE" | "FAILED"
 * - onChainTx: The transaction signature
 * - dbcPoolAddress: (optional) Confirmed pool address
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = await getAuthToken(request);
    if (!token?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tokenLaunch = await prisma.tokenLaunch.findUnique({
      where: { id: params.id },
      include: {
        transaction: {
          select: { buyerId: true },
        },
      },
    });

    if (!tokenLaunch) {
      return NextResponse.json(
        { error: "Token launch not found" },
        { status: 404 }
      );
    }

    if (tokenLaunch.transaction.buyerId !== token.id as string) {
      return NextResponse.json(
        { error: "Only the token creator can update this launch" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status, onChainTx, dbcPoolAddress } = body;

    // Validate status transition
    const validTransitions: Record<string, string[]> = {
      PENDING: ["LAUNCHING", "CANCELLED"],
      LAUNCHING: ["LIVE", "FAILED"],
      LIVE: ["GRADUATED"],
      GRADUATED: ["COMPLETED"],
    };

    const currentStatus = tokenLaunch.status;
    if (!validTransitions[currentStatus]?.includes(status)) {
      return NextResponse.json(
        {
          error: `Cannot transition from ${currentStatus} to ${status}`,
        },
        { status: 400 }
      );
    }

    const updateData: any = { status };

    if (status === "LIVE") {
      updateData.launchedAt = new Date();
      updateData.bondingCurveStatus = "ACTIVE";
      if (dbcPoolAddress) updateData.dbcPoolAddress = dbcPoolAddress;
    }

    if (status === "GRADUATED") {
      updateData.graduatedAt = new Date();
      updateData.bondingCurveStatus = "GRADUATED";
    }

    if (status === "FAILED") {
      updateData.bondingCurveStatus = "FAILED";
    }

    const updated = await prisma.tokenLaunch.update({
      where: { id: params.id },
      data: updateData,
    });

    // Create notifications for status changes
    if (status === "LIVE") {
      await prisma.notification.create({
        data: {
          userId: tokenLaunch.transaction.buyerId,
          type: "PATO_LAUNCHED",
          title: "Token is Live!",
          message: `Your token $${tokenLaunch.tokenSymbol} is now live and tradeable on Solana.`,
          data: {
            tokenLaunchId: tokenLaunch.id,
            tokenMint: tokenLaunch.tokenMint,
            dbcPoolAddress: dbcPoolAddress || tokenLaunch.dbcPoolAddress,
          },
        },
      });
    }

    if (status === "GRADUATED") {
      await prisma.notification.create({
        data: {
          userId: tokenLaunch.transaction.buyerId,
          type: "PATO_GRADUATED",
          title: "Token Graduated!",
          message: `$${tokenLaunch.tokenSymbol} has graduated to Meteora AMM. Liquidity is permanently locked and tradeable on Jupiter.`,
          data: {
            tokenLaunchId: tokenLaunch.id,
            tokenMint: tokenLaunch.tokenMint,
          },
        },
      });
    }

    if (status === "FAILED") {
      await prisma.notification.create({
        data: {
          userId: tokenLaunch.transaction.buyerId,
          type: "PATO_LAUNCH_FAILED",
          title: "Token Launch Failed",
          message: `The launch of $${tokenLaunch.tokenSymbol} failed. You can try again.`,
          data: {
            tokenLaunchId: tokenLaunch.id,
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      tokenLaunch: {
        id: updated.id,
        status: updated.status,
        bondingCurveStatus: updated.bondingCurveStatus,
        launchedAt: updated.launchedAt,
        graduatedAt: updated.graduatedAt,
      },
    });
  } catch (error: any) {
    console.error("[PATO] Error updating token launch:", error);
    return NextResponse.json(
      { error: "Failed to update token launch" },
      { status: 500 }
    );
  }
}
