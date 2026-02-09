import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { hasPoolGraduated, getPoolState } from "@/lib/meteora-dbc";
import { PublicKey } from "@solana/web3.js";

// GET /api/cron/check-graduations
//
// Vercel Cron Job that checks all active bonding curve pools for graduation.
// When a pool graduates (migrates to DAMM v2), updates the DB and notifies the creator.
// Configured in vercel.json to run every 10 minutes.
export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
      } catch (err) {
        console.error(`[Cron] Error checking pool ${launch.dbcPoolAddress}:`, err);
      }
    }

    return NextResponse.json({
      checked: activeLaunches.length,
      graduated: graduatedCount,
    });
  } catch (error) {
    console.error("[Cron] Error checking graduations:", error);
    return NextResponse.json(
      { error: "Failed to check graduations" },
      { status: 500 }
    );
  }
}
