import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthToken } from "@/lib/auth";
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
import { validateCsrfRequest, csrfError } from "@/lib/csrf";
import { withRateLimitAsync } from "@/lib/rate-limit";

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
    // SECURITY: Validate CSRF token for state-changing financial request
    const csrfValidation = validateCsrfRequest(request);
    if (!csrfValidation.valid) {
      return csrfError(csrfValidation.error || "CSRF validation failed");
    }

    // SECURITY: Rate limit token deployments (strict)
    const rateLimitResult = await (withRateLimitAsync('auth', 'token-deploy'))(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: 429, headers: rateLimitResult.headers }
      );
    }

    const session = await getAuthToken(request);
    if (!session?.id) {
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

    if (tokenLaunch.transaction.buyerId !== session.id as string) {
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

    // SECURITY: Validate initialBuyAmountSOL (same as creation endpoint)
    if (initialBuyAmountSOL !== undefined && initialBuyAmountSOL !== null) {
      if (typeof initialBuyAmountSOL !== 'number' || !isFinite(initialBuyAmountSOL) || initialBuyAmountSOL <= 0) {
        return NextResponse.json(
          { error: "initialBuyAmountSOL must be a positive number" },
          { status: 400 }
        );
      }
      if (initialBuyAmountSOL > 10000) {
        return NextResponse.json(
          { error: "initialBuyAmountSOL cannot exceed 10,000 SOL" },
          { status: 400 }
        );
      }
    }

    // SECURITY: Atomically claim PENDING -> LAUNCHING to prevent concurrent deploy race
    const claimed = await prisma.tokenLaunch.updateMany({
      where: { id: tokenLaunchId, status: "PENDING" },
      data: { status: "LAUNCHING" as any },
    });
    if (claimed.count === 0) {
      return NextResponse.json(
        { error: "Token launch is no longer pending — may be deploying from another session" },
        { status: 409 }
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

    // Update pool address now that we have it
    await prisma.tokenLaunch.update({
      where: { id: tokenLaunchId },
      data: {
        dbcPoolAddress: result.poolAddress.toBase58(),
      },
    });

    // Register pool for real-time graduation detection
    watchPoolForGraduation(result.poolAddress.toBase58()).catch((err) =>
      console.error("[PATO Deploy] Failed to register pool watcher:", err)
    );

    // SECURITY: Sign transactions server-side with the mint keypair
    // so we never expose the secret key to the client.
    // The client only needs to sign with their own wallet.
    const transactions = [];

    if (result.createPoolTx) {
      // Server-side partial sign with mint keypair
      result.createPoolTx.partialSign(decryptedKeypair);
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
    });
  } catch (error: any) {
    console.error("[PATO Deploy] Error building deploy transaction:", error);
    return NextResponse.json(
      { error: "Failed to build deployment transaction" },
      { status: 500 }
    );
  }
}
