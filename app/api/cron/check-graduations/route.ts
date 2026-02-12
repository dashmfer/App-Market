import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { hasPoolGraduated, getPoolState } from "@/lib/meteora-dbc";
import { PublicKey } from "@solana/web3.js";
import { verifyCronSecret } from "@/lib/cron-auth";

// GET /api/cron/check-graduations
//
// Hourly safety net that catches any graduations the real-time webhook missed.
// Primary detection is via /api/webhooks/pool-graduation (instant, Helius).
// This cron is a fallback — runs hourly to ensure nothing slips through.
export async function GET(request: NextRequest) {
  // SECURITY: Use timing-safe comparison to prevent timing attacks on cron secret
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find all token launches with active bonding curves
    const activeLaunches = await prisma.tokenLaunch.findMany({
      where: {
        bondingCurveStatus: "ACTIVE",
        status: "LIVE",
        dbcPoolAddress: { not: null },
      },
      select: {
        id: true,
        dbcPoolAddress: true,
        tokenName: true,
        tokenSymbol: true,
        creatorWallet: true,
        transaction: {
          select: { buyerId: true },
        },
      },
      take: 100, // Batch size to prevent OOM on large datasets
    });

    if (activeLaunches.length === 0) {
      return NextResponse.json({ checked: 0, graduated: 0 });
    }

    let graduatedCount = 0;

    for (const launch of activeLaunches) {
      try {
        const poolAddress = new PublicKey(launch.dbcPoolAddress!);
        const graduated = await hasPoolGraduated(poolAddress);

        if (graduated) {
          // Try to get the DAMM pool address from pool state
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

          // Notify the creator
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

          graduatedCount++;
        }
      } catch (err: any) {
        console.error(`[Cron] Error checking pool ${launch.dbcPoolAddress}:`, err);
      }
    }

    return NextResponse.json({
      checked: activeLaunches.length,
      graduated: graduatedCount,
    });
  } catch (error: any) {
    console.error("[Cron] Error checking graduations:", error);
    return NextResponse.json(
      { error: "Failed to check graduations" },
      { status: 500 }
    );
  }
}
