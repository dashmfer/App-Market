import { NextResponse } from "next/server";
import prisma from "@/lib/db";

/**
 * Health Check Endpoint
 *
 * Returns status of all critical services:
 * - Database (Prisma/PostgreSQL)
 * - Redis (Upstash rate limiting)
 * - Solana RPC connection
 *
 * Public endpoint — no auth required. Used by uptime monitors.
 */
export async function GET() {
  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

  // Database check
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
  } catch (error) {
    console.error("[Health] Database check failed:", error);
    checks.database = {
      status: "error",
      latencyMs: Date.now() - dbStart,
    };
  }

  // Redis check (Upstash)
  const redisStart = Date.now();
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      checks.redis = { status: "not_configured" };
    } else {
      const resp = await fetch(`${url}/ping`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        checks.redis = { status: "ok", latencyMs: Date.now() - redisStart };
      } else {
        console.error("[Health] Redis check failed: HTTP", resp.status);
        checks.redis = { status: "error", latencyMs: Date.now() - redisStart };
      }
    }
  } catch (error) {
    console.error("[Health] Redis check failed:", error);
    checks.redis = {
      status: "error",
      latencyMs: Date.now() - redisStart,
    };
  }

  // Solana RPC check
  const rpcStart = Date.now();
  try {
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    if (!rpcUrl) {
      checks.solana = { status: "not_configured" };
    } else {
      const resp = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
      });
      const data = await resp.json();
      if (data.result === "ok") {
        checks.solana = { status: "ok", latencyMs: Date.now() - rpcStart };
      } else {
        console.error("[Health] Solana RPC degraded:", data.result);
        checks.solana = { status: "degraded", latencyMs: Date.now() - rpcStart };
      }
    }
  } catch (error) {
    console.error("[Health] Solana RPC check failed:", error);
    checks.solana = {
      status: "error",
      latencyMs: Date.now() - rpcStart,
    };
  }

  // Env var checks (non-sensitive — just whether they're set)
  checks.config = {
    status: [
      "NEXTAUTH_SECRET",
      "ENCRYPTION_SECRET",
      "CRON_SECRET",
      "DATABASE_URL",
    ].every(v => !!process.env[v]) ? "ok" : "missing_vars",
  };

  const allHealthy = Object.values(checks).every(c => c.status === "ok" || c.status === "not_configured");
  const statusCode = allHealthy ? 200 : 503;

  return NextResponse.json(
    {
      status: allHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: statusCode },
  );
}
