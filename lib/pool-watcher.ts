import { Connection, PublicKey } from "@solana/web3.js";

// SECURITY [H8]: Prefer server-only SOLANA_RPC_URL to avoid leaking API keys
// via the NEXT_PUBLIC_ prefix (which is embedded in the client bundle).
const RPC_URL = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_WEBHOOK_ID = process.env.HELIUS_WEBHOOK_ID;

/**
 * Register a pool address for real-time graduation monitoring.
 *
 * If Helius is configured, adds the address to the Helius webhook.
 * Falls back to the cron job safety net if no webhook service is set up.
 */
export async function watchPoolForGraduation(poolAddress: string): Promise<boolean> {
  // Helius Webhooks (recommended)
  if (HELIUS_API_KEY && HELIUS_WEBHOOK_ID) {
    return addToHeliusWebhook(poolAddress);
  }

  // No webhook service configured — relies on cron safety net
  console.warn(
    `[PoolWatcher] No webhook service configured. Pool ${poolAddress} will be monitored by the hourly cron fallback. ` +
    "Set HELIUS_API_KEY and HELIUS_WEBHOOK_ID for real-time detection."
  );
  return false;
}

/**
 * Remove a pool address from monitoring (after graduation or failure).
 */
export async function unwatchPool(poolAddress: string): Promise<boolean> {
  if (HELIUS_API_KEY && HELIUS_WEBHOOK_ID) {
    return removeFromHeliusWebhook(poolAddress);
  }
  return false;
}

/**
 * Add an address to an existing Helius webhook.
 * https://docs.helius.dev/webhooks/api-reference
 */
async function addToHeliusWebhook(address: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.helius.xyz/v0/webhooks/${HELIUS_WEBHOOK_ID}?api-key=${HELIUS_API_KEY}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountAddresses: [address],
          accountAddressesOperation: "APPEND",
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("[PoolWatcher] Failed to add to Helius webhook:", err);
      return false;
    }

    console.log(`[PoolWatcher] Added ${address} to Helius webhook for real-time monitoring`);
    return true;
  } catch (err: any) {
    console.error("[PoolWatcher] Error adding to Helius webhook:", err);
    return false;
  }
}

/**
 * Remove an address from the Helius webhook.
 */
async function removeFromHeliusWebhook(address: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.helius.xyz/v0/webhooks/${HELIUS_WEBHOOK_ID}?api-key=${HELIUS_API_KEY}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountAddresses: [address],
          accountAddressesOperation: "REMOVE",
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("[PoolWatcher] Failed to remove from Helius webhook:", err);
      return false;
    }

    console.log(`[PoolWatcher] Removed ${address} from Helius webhook`);
    return true;
  } catch (err: any) {
    console.error("[PoolWatcher] Error removing from Helius webhook:", err);
    return false;
  }
}
