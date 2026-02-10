import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  buildClaimCreatorTradingFeeTransaction,
  buildClaimPartnerTradingFeeTransaction,
  getPatoFeeClaimer,
} from "@/lib/meteora-dbc";
import { PublicKey } from "@solana/web3.js";

/**
 * POST /api/token-launch/claim-fees — Build transaction to claim trading fees
 *
 * Supports both creator fee claims and platform (partner) fee claims.
 *
 * Body:
 * - tokenLaunchId: The TokenLaunch record ID
 * - claimType: "creator" | "partner"
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { tokenLaunchId, claimType } = body;

    if (!tokenLaunchId || !claimType) {
      return NextResponse.json(
        { error: "Missing required fields: tokenLaunchId, claimType" },
        { status: 400 }
      );
    }

    if (!["creator", "partner"].includes(claimType)) {
      return NextResponse.json(
        { error: 'claimType must be "creator" or "partner"' },
        { status: 400 }
      );
    }

    // Get the token launch
    const tokenLaunch = await prisma.tokenLaunch.findUnique({
      where: { id: tokenLaunchId },
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

    // Verify the pool is live
    if (!["LIVE", "GRADUATED", "COMPLETED"].includes(tokenLaunch.status)) {
      return NextResponse.json(
        { error: "Token must be live to claim fees" },
        { status: 400 }
      );
    }

    if (!tokenLaunch.dbcPoolAddress) {
      return NextResponse.json(
        { error: "Pool address not found" },
        { status: 400 }
      );
    }

    const poolAddress = new PublicKey(tokenLaunch.dbcPoolAddress);

    if (claimType === "creator") {
      // Only the creator (buyer) can claim creator fees
      if (tokenLaunch.transaction.buyerId !== session.user.id) {
        return NextResponse.json(
          { error: "Only the token creator can claim creator fees" },
          { status: 403 }
        );
      }

      if (!tokenLaunch.creatorWallet) {
        return NextResponse.json(
          { error: "Creator wallet not set" },
          { status: 400 }
        );
      }

      const creatorWallet = new PublicKey(tokenLaunch.creatorWallet);
      const tx = await buildClaimCreatorTradingFeeTransaction({
        poolAddress,
        creatorWallet,
      });

      return NextResponse.json({
        success: true,
        claimType: "creator",
        tokenLaunchId,
        poolAddress: tokenLaunch.dbcPoolAddress,
        transaction: Buffer.from(
          tx.serialize({ requireAllSignatures: false })
        ).toString("base64"),
      });
    }

    if (claimType === "partner") {
      // Only admin/platform can claim partner fees
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { isAdmin: true },
      });

      if (!user?.isAdmin) {
        return NextResponse.json(
          { error: "Only platform admins can claim partner fees" },
          { status: 403 }
        );
      }

      const feeClaimer = getPatoFeeClaimer();
      const feeReceiver = feeClaimer; // Receive to same wallet

      const tx = await buildClaimPartnerTradingFeeTransaction({
        poolAddress,
        feeClaimerWallet: feeClaimer,
        feeReceiverWallet: feeReceiver,
      });

      return NextResponse.json({
        success: true,
        claimType: "partner",
        tokenLaunchId,
        poolAddress: tokenLaunch.dbcPoolAddress,
        transaction: Buffer.from(
          tx.serialize({ requireAllSignatures: false })
        ).toString("base64"),
      });
    }
  } catch (error) {
    console.error("[PATO Claim] Error building claim transaction:", error);
    return NextResponse.json(
      { error: "Failed to build fee claim transaction" },
      { status: 500 }
    );
  }
}
