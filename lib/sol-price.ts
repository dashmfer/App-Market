let cachedPrice: { usd: number; timestamp: number } | null = null;
const CACHE_TTL_MS = 60_000; // 60 seconds

/**
 * Fetch the current SOL/USD price from CoinGecko with 60-second caching.
 * Returns null if the fetch fails.
 */
export async function getSolPriceUsd(): Promise<number | null> {
  if (cachedPrice && Date.now() - cachedPrice.timestamp < CACHE_TTL_MS) {
    return cachedPrice.usd;
  }

  try {
    const resp = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
      { next: { revalidate: 60 } }
    );
    if (!resp.ok) return cachedPrice?.usd ?? null;

    const data = await resp.json();
    const price = data?.solana?.usd;
    // SECURITY [H10]: Sanity check — reject extreme prices that indicate API manipulation
    if (price <= 0 || price > 100000) {
      console.warn(`[SOL Price] Suspicious price from CoinGecko: ${price}`);
      // Fall through to cached price
    } else if (typeof price === "number" && price > 0) {
      cachedPrice = { usd: price, timestamp: Date.now() };
      return price;
    }
  } catch {
    // Return stale cache if available
  }

  return cachedPrice?.usd ?? null;
}
