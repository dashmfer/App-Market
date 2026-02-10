import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { hasPoolGraduated, getPoolState } from "@/lib/meteora-dbc";
import { unwatchPool } from "@/lib/pool-watcher";
import { PublicKey } from "@solana/web3.js";

// POST /api/webhooks/pool-graduation
//
// Real-time webhook endpoint for Solana account change notifications.
// Called instantly when a watched pool account's data changes on-chain.
//
// Works with:
// - Helius Webhooks (recommended): https://docs.helius.dev/webhooks
// - QuickNode Streams
// - Any service that sends Solana account change notifications
//
// Setup (Helius):
// 1. Create webhook at https://dev.helius.xyz/webhooks
// 2. Set URL to: https://yourdomain.com/api/webhooks/pool-graduation
// 3. Webhook type: "Enhanced" or "Raw"
// 4. Add pool addresses as accounts to watch
// 5. Set auth header to match WEBHOOK_SECRET env var

async function handleGraduation(poolAddressStr: string) {
  const poolAddress = new PublicKey(poolAddressStr);

  // Find the token launch for this pool
  const launch = await prisma.tokenLaunch.findFirst({
    where: {
      dbcPoolAddress: poolAddressStr,
      bondingCurveStatus: "ACTIVE",
      status: "LIVE",
    },
    select: {
      id: true,
      tokenName: true,
      tokenSymbol: true,
      transaction: {
        select: { buyerId: true },
      },
    },
  });

  if (!launch) return null;

  // Verify graduation on-chain
  const graduated = await hasPoolGraduated(poolAddress);
  if (!graduated) return null;

  // Get DAMM pool address if available
  let dammPoolAddress: string | null = null;
  try {
    const poolState = await getPoolState(poolAddress);
    const stateAny = poolState as any;
    if (stateAny?.migrationDammPool) {
      dammPoolAddress = stateAny.migrationDammPool.toBase58();
    } else if (stateAny?.dammPool) {
      dammPoolAddress = stateAny.dammPool.toBase58();
    }
  } catch {
    // Pool state may not expose DAMM address directly
  }

  // Update DB
  await prisma.tokenLaunch.update({
    where: { id: launch.id },
    data: {
      bondingCurveStatus: "GRADUATED",
      status: "GRADUATED",
      graduatedAt: new Date(),
      dammPoolAddress,
    },
  });

  // Notify the creator instantly
  if (launch.transaction?.buyerId) {
    await prisma.notification.create({
      data: {
        userId: launch.transaction.buyerId,
        type: "PATO_GRADUATED",
        title: "Token Graduated!",
        message: `${launch.tokenName} ($${launch.tokenSymbol}) has graduated to the DAMM v2 AMM. Your locked LP is now earning trading fees.`,
        data: {
          tokenLaunchId: launch.id,
          dammPoolAddress,
        },
      },
    });
  }

  // Stop watching this pool — it's graduated
  unwatchPool(poolAddressStr).catch(() => {});

  return { launchId: launch.id, dammPoolAddress };
}

export async function POST(request: NextRequest) {
  // Verify webhook secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Handle different webhook payload formats

    // Helius Enhanced Transaction format
    if (Array.isArray(body)) {
      const results = [];
      for (const event of body) {
        // Extract account keys from the transaction
        const accountKeys: string[] = event.transaction?.message?.accountKeys
          || event.accountData?.map((a: any) => a.account)
          || [];

        // Check if any of these accounts are our watched pools
        for (const key of accountKeys) {
          const launch = await prisma.tokenLaunch.findFirst({
            where: {
              dbcPoolAddress: key,
              bondingCurveStatus: "ACTIVE",
            },
            select: { id: true },
          });

          if (launch) {
            const result = await handleGraduation(key);
            if (result) results.push(result);
          }
        }
      }
      return NextResponse.json({ processed: results.length, results });
    }

    // Direct account change notification format
    if (body.accountAddress || body.poolAddress) {
      const poolAddress = body.accountAddress || body.poolAddress;
      const result = await handleGraduation(poolAddress);
      return NextResponse.json({ processed: result ? 1 : 0, result });
    }

    // Raw account data format (QuickNode / direct RPC)
    if (body.params?.result?.value?.pubkey) {
      const poolAddress = body.params.result.value.pubkey;
      const result = await handleGraduation(poolAddress);
      return NextResponse.json({ processed: result ? 1 : 0, result });
    }

    return NextResponse.json({ processed: 0, message: "No matching pool found in payload" });
  } catch (error: any) {
    console.error("[Webhook] Error processing pool graduation:", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}
