/**
 * Rate limiting utility using Upstash Redis
 * Falls back to in-memory store if Upstash is not configured (dev only)
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Check if Upstash is configured
const isUpstashConfigured = !!(
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
);

// Create Redis client if configured
const redis = isUpstashConfigured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// Preset configurations for different endpoint types
export const RATE_LIMIT_PRESETS = {
  // Very strict - for auth endpoints (5 per minute)
  auth: { requests: 5, window: "1m" as const },

  // Strict - for write operations (10 per minute)
  write: { requests: 10, window: "1m" as const },

  // Moderate - for search/read operations (30 per minute)
  search: { requests: 30, window: "1m" as const },

  // Relaxed - for general read operations (100 per minute)
  read: { requests: 100, window: "1m" as const },

  // Very relaxed - for static/cached content (200 per minute)
  static: { requests: 200, window: "1m" as const },
};

// Legacy presets for backward compatibility (milliseconds format)
export const RATE_LIMIT_PRESETS_LEGACY = {
  auth: { windowMs: 60 * 1000, maxRequests: 5 },
  write: { windowMs: 60 * 1000, maxRequests: 10 },
  search: { windowMs: 60 * 1000, maxRequests: 30 },
  read: { windowMs: 60 * 1000, maxRequests: 100 },
  static: { windowMs: 60 * 1000, maxRequests: 200 },
};

// Create rate limiters for each preset using Upstash
const rateLimiters = redis
  ? {
      auth: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "1m"),
        prefix: "ratelimit:auth",
      }),
      write: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "1m"),
        prefix: "ratelimit:write",
      }),
      search: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, "1m"),
        prefix: "ratelimit:search",
      }),
      read: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(100, "1m"),
        prefix: "ratelimit:read",
      }),
      static: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(200, "1m"),
        prefix: "ratelimit:static",
      }),
    }
  : null;

// In-memory fallback for development (not for production!)
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const inMemoryStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every minute (only used in dev fallback)
if (typeof setInterval !== "undefined" && !isUpstashConfigured) {
  setInterval(() => {
    const now = Date.now();
    const keysToDelete: string[] = [];
    inMemoryStore.forEach((entry, key) => {
      if (entry.resetTime < now) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => inMemoryStore.delete(key));
  }, 60 * 1000);
}

/**
 * Check if a request should be rate limited (async version for Upstash)
 */
export async function checkRateLimitAsync(
  identifier: string,
  endpoint: string,
  preset: keyof typeof RATE_LIMIT_PRESETS
): Promise<{ isLimited: boolean; remaining: number; resetTime: number }> {
  const key = `${endpoint}:${identifier}`;

  // Use Upstash if configured
  if (rateLimiters) {
    const limiter = rateLimiters[preset];
    const result = await limiter.limit(key);

    return {
      isLimited: !result.success,
      remaining: result.remaining,
      resetTime: result.reset,
    };
  }

  // SECURITY: Warn loudly and refuse in production if Upstash is not configured
  if (process.env.NODE_ENV === "production") {
    console.error(
      "CRITICAL: Rate limiting falling back to in-memory in production! Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN."
    );
    // SECURITY: Fail closed in production — deny all requests if Redis is unavailable
    return {
      isLimited: true,
      remaining: 0,
      resetTime: Date.now() + 60000,
    };
  } else {
    console.warn(
      "Rate limiting: Using in-memory fallback. Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for production."
    );
  }

  const config = RATE_LIMIT_PRESETS_LEGACY[preset];
  const now = Date.now();
  let entry = inMemoryStore.get(key);

  if (!entry || entry.resetTime < now) {
    entry = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    inMemoryStore.set(key, entry);
    return {
      isLimited: false,
      remaining: config.maxRequests - 1,
      resetTime: entry.resetTime,
    };
  }

  entry.count++;
  inMemoryStore.set(key, entry);

  const isLimited = entry.count > config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);

  return {
    isLimited,
    remaining,
    resetTime: entry.resetTime,
  };
}

/**
 * Synchronous rate limit check (in-memory fallback only)
 * @deprecated Use checkRateLimitAsync for production
 */
export function checkRateLimit(
  identifier: string,
  endpoint: string,
  config: { windowMs: number; maxRequests: number }
): { isLimited: boolean; remaining: number; resetTime: number } {
  const key = `${endpoint}:${identifier}`;
  const now = Date.now();

  let entry = inMemoryStore.get(key);

  if (!entry || entry.resetTime < now) {
    entry = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    inMemoryStore.set(key, entry);
    return {
      isLimited: false,
      remaining: config.maxRequests - 1,
      resetTime: entry.resetTime,
    };
  }

  entry.count++;
  inMemoryStore.set(key, entry);

  const isLimited = entry.count > config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);

  return {
    isLimited,
    remaining,
    resetTime: entry.resetTime,
  };
}

/**
 * Get client IP from request headers
 * SECURITY: On Vercel/trusted proxies, use the rightmost non-private IP from x-forwarded-for
 * to prevent IP spoofing via client-supplied headers. Falls back to x-real-ip.
 */
export function getClientIp(headers: Headers): string {
  // x-real-ip is set by the reverse proxy (Vercel) and is more trustworthy
  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    // SECURITY: Use rightmost IP (closest to trusted proxy) to prevent spoofing.
    // The client can prepend arbitrary IPs, but the proxy appends the real client IP last.
    const ips = forwarded.split(",").map(ip => ip.trim()).filter(Boolean);
    if (ips.length > 0) {
      return ips[ips.length - 1];
    }
  }

  return "unknown";
}

/**
 * Create rate limit response headers
 */
export function createRateLimitHeaders(
  remaining: number,
  resetTime: number,
  limit: number
): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(resetTime / 1000)),
  };
}

/**
 * Higher-order function to wrap an API handler with rate limiting (async version)
 */
export function withRateLimitAsync(
  preset: keyof typeof RATE_LIMIT_PRESETS,
  endpointName: string
) {
  const config = RATE_LIMIT_PRESETS_LEGACY[preset];

  return async function rateLimitMiddleware(
    request: Request,
    userId?: string
  ): Promise<{ success: boolean; headers: Record<string, string>; error?: string }> {
    const identifier = userId || getClientIp(request.headers);

    const result = await checkRateLimitAsync(identifier, endpointName, preset);
    const headers = createRateLimitHeaders(
      result.remaining,
      result.resetTime,
      config.maxRequests
    );

    if (result.isLimited) {
      return {
        success: false,
        headers,
        error: `Rate limit exceeded. Try again in ${Math.ceil((result.resetTime - Date.now()) / 1000)} seconds.`,
      };
    }

    return { success: true, headers };
  };
}

/**
 * Synchronous rate limit wrapper (uses in-memory store)
 * @deprecated Use withRateLimitAsync for production
 */
export function withRateLimit(
  preset: keyof typeof RATE_LIMIT_PRESETS,
  endpointName: string
) {
  const config = RATE_LIMIT_PRESETS_LEGACY[preset];

  return function rateLimitMiddleware(
    request: Request,
    userId?: string
  ): { success: boolean; headers: Record<string, string>; error?: string } {
    const identifier = userId || getClientIp(request.headers);

    const result = checkRateLimit(identifier, endpointName, config);
    const headers = createRateLimitHeaders(
      result.remaining,
      result.resetTime,
      config.maxRequests
    );

    if (result.isLimited) {
      return {
        success: false,
        headers,
        error: `Rate limit exceeded. Try again in ${Math.ceil((result.resetTime - Date.now()) / 1000)} seconds.`,
      };
    }

    return { success: true, headers };
  };
}

/**
 * Check if Upstash is properly configured
 */
export function isRateLimitingDistributed(): boolean {
  return isUpstashConfigured;
}
