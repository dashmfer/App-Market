import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { decrypt } from "@/lib/encryption";
import { deserializeKeypair } from "@/lib/vanity-keygen";
import {
  buildCreatePoolTransaction,
  buildCreatePoolWithFirstBuyTransaction,
  getPatoConfigKey,
} from "@/lib/meteora-dbc";
import { uploadTokenMetadata } from "@/lib/token-metadata";
import { watchPoolForGraduation } from "@/lib/pool-watcher";
import { PublicKey } from "@solana/web3.js";

/**
 * POST /api/token-launch/deploy — Build the on-chain transaction for pool deployment
 *
 * Returns a serialized transaction for the buyer to sign client-side.
 * The buyer's wallet signs and submits to Solana.
 *
 * Body:
 * - tokenLaunchId: The TokenLaunch record ID
 * - initialBuyAmountSOL: (optional) SOL to spend on initial token buy
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { tokenLaunchId, initialBuyAmountSOL } = body;

    if (!tokenLaunchId) {
      return NextResponse.json(
        { error: "Missing tokenLaunchId" },
        { status: 400 }
      );
    }

    // Get the token launch record
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

    if (tokenLaunch.transaction.buyerId !== session.user.id) {
      return NextResponse.json(
        { error: "Only the acquisition buyer can deploy this token" },
        { status: 403 }
      );
    }

    if (tokenLaunch.status !== "PENDING") {
      return NextResponse.json(
        { error: `Token launch is already ${tokenLaunch.status}` },
        { status: 400 }
      );
    }

    if (!tokenLaunch.vanityKeypair) {
      return NextResponse.json(
        { error: "Vanity keypair not found. Please create a new launch." },
        { status: 500 }
      );
    }

    // Decrypt the vanity keypair
    const decryptedKeypair = deserializeKeypair(
      decrypt(tokenLaunch.vanityKeypair)
    );

    const creatorWallet = new PublicKey(tokenLaunch.creatorWallet!);

    // Upload token metadata JSON (Metaplex standard) and get a public URI
    const tokenUri = await uploadTokenMetadata({
      tokenLaunchId: tokenLaunch.id,
      tokenName: tokenLaunch.tokenName,
      tokenSymbol: tokenLaunch.tokenSymbol,
      tokenDescription: tokenLaunch.tokenDescription,
      tokenImage: tokenLaunch.tokenImage,
      creatorWallet: tokenLaunch.creatorWallet!,
      website: tokenLaunch.website,
      twitter: tokenLaunch.twitter,
      telegram: tokenLaunch.telegram,
      discord: tokenLaunch.discord,
    });

    let result;

    if (initialBuyAmountSOL && initialBuyAmountSOL > 0) {
      // Create pool with initial buy
      result = await buildCreatePoolWithFirstBuyTransaction({
        tokenName: tokenLaunch.tokenName,
        tokenSymbol: tokenLaunch.tokenSymbol,
        tokenUri,
        creatorWallet,
        vanityMintKeypair: decryptedKeypair,
        payerWallet: creatorWallet,
        initialBuyAmountSOL,
      });
    } else {
      // Create pool only (no initial buy)
      const poolResult = await buildCreatePoolTransaction({
        tokenName: tokenLaunch.tokenName,
        tokenSymbol: tokenLaunch.tokenSymbol,
        tokenUri,
        creatorWallet,
        vanityMintKeypair: decryptedKeypair,
        payerWallet: creatorWallet,
      });
      result = {
        createPoolTx: poolResult.createPoolTx,
        swapBuyTx: undefined,
        poolAddress: poolResult.poolAddress,
        mintAddress: poolResult.mintAddress,
      };
    }

    // Update status to LAUNCHING
    await prisma.tokenLaunch.update({
      where: { id: tokenLaunchId },
      data: {
        status: "LAUNCHING",
        dbcPoolAddress: result.poolAddress.toBase58(),
      },
    });

    // Register pool for real-time graduation detection
    watchPoolForGraduation(result.poolAddress.toBase58()).catch((err) =>
      console.error("[PATO Deploy] Failed to register pool watcher:", err)
    );

    // Serialize transactions for client to sign
    const transactions = [];

    if (result.createPoolTx) {
      transactions.push({
        type: "createPool",
        serialized: Buffer.from(
          result.createPoolTx.serialize({ requireAllSignatures: false })
        ).toString("base64"),
      });
    }

    if (result.swapBuyTx) {
      transactions.push({
        type: "initialBuy",
        serialized: Buffer.from(
          result.swapBuyTx.serialize({ requireAllSignatures: false })
        ).toString("base64"),
      });
    }

    return NextResponse.json({
      success: true,
      tokenLaunchId,
      poolAddress: result.poolAddress.toBase58(),
      mintAddress: result.mintAddress.toBase58(),
      transactions,
      // Include the vanity keypair bytes for the client to co-sign
      // (the mint keypair must sign the pool creation tx)
      mintKeypairBytes: Array.from(decryptedKeypair.secretKey),
    });
  } catch (error: any) {
    console.error("[PATO Deploy] Error building deploy transaction:", error);
    return NextResponse.json(
      { error: "Failed to build deployment transaction" },
      { status: 500 }
    );
  }
}
