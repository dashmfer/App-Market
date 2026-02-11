/**
 * Next.js Instrumentation — runs once on server startup.
 * Validates that all required environment variables are set before
 * the app starts serving requests. Fails fast with clear messages.
 */
export async function register() {
  // Only validate on the server (Node.js runtime), not Edge
  if (process.env.NEXT_RUNTIME === "edge") return;

  const required: Record<string, string> = {
    DATABASE_URL: "PostgreSQL connection string",
    NEXTAUTH_SECRET: "JWT signing secret (generate with: openssl rand -hex 32)",
    NEXT_PUBLIC_SOLANA_RPC_URL: "Solana RPC endpoint (Helius, QuickNode, etc.)",
    NEXT_PUBLIC_TREASURY_WALLET: "Platform treasury wallet address",
  };

  const requiredInProduction: Record<string, string> = {
    NEXTAUTH_URL: "Canonical site URL (e.g. https://www.appmrkt.xyz)",
    CRON_SECRET: "Secret for authenticating cron jobs",
    ADMIN_SECRET: "Secret for admin API endpoints",
    UPSTASH_REDIS_REST_URL: "Upstash Redis REST URL (for rate limiting & session revocation)",
    UPSTASH_REDIS_REST_TOKEN: "Upstash Redis REST token",
  };

  const missing: string[] = [];

  for (const [key, description] of Object.entries(required)) {
    if (!process.env[key]) {
      missing.push(`  ${key} — ${description}`);
    }
  }

  if (process.env.NODE_ENV === "production") {
    for (const [key, description] of Object.entries(requiredInProduction)) {
      if (!process.env[key]) {
        missing.push(`  ${key} — ${description}`);
      }
    }
  }

  if (missing.length > 0) {
    const msg = [
      "",
      "=".repeat(60),
      "FATAL: Missing required environment variables:",
      "",
      ...missing,
      "",
      "The app cannot start safely without these.",
      "See .env.example for reference.",
      "=".repeat(60),
      "",
    ].join("\n");

    console.error(msg);

    // In production, crash hard. In dev, warn loudly but allow startup.
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Missing required environment variables: ${missing.map(m => m.trim().split(" — ")[0]).join(", ")}`);
    }
  }
}
