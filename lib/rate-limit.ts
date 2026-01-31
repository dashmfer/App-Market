/**
 * Rate limiting utility
 * Uses in-memory store - for production, use Redis or Upstash
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Maximum requests per window
}

// In-memory store for rate limits
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000);

// Preset configurations for different endpoint types
export const RATE_LIMIT_PRESETS = {
  // Very strict - for auth endpoints
  auth: { windowMs: 60 * 1000, maxRequests: 5 },

  // Strict - for write operations
  write: { windowMs: 60 * 1000, maxRequests: 10 },

  // Moderate - for search/read operations
  search: { windowMs: 60 * 1000, maxRequests: 30 },

  // Relaxed - for general read operations
  read: { windowMs: 60 * 1000, maxRequests: 100 },

  // Very relaxed - for static/cached content
  static: { windowMs: 60 * 1000, maxRequests: 200 },
};

/**
 * Check if a request should be rate limited
 * @param identifier - Unique identifier (e.g., IP address, user ID)
 * @param endpoint - Endpoint name for namespacing
 * @param config - Rate limit configuration
 * @returns Object with isLimited, remaining, and resetTime
 */
export function checkRateLimit(
  identifier: string,
  endpoint: string,
  config: RateLimitConfig
): { isLimited: boolean; remaining: number; resetTime: number } {
  const key = `${endpoint}:${identifier}`;
  const now = Date.now();

  let entry = rateLimitStore.get(key);

  // If no entry or window has reset, create new entry
  if (!entry || entry.resetTime < now) {
    entry = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(key, entry);
    return {
      isLimited: false,
      remaining: config.maxRequests - 1,
      resetTime: entry.resetTime,
    };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);

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
 */
export function getClientIp(headers: Headers): string {
  // Check various headers that might contain the real IP
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwarded.split(',')[0].trim();
  }

  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback
  return 'unknown';
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
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.ceil(resetTime / 1000)),
  };
}

/**
 * Higher-order function to wrap an API handler with rate limiting
 */
export function withRateLimit(
  preset: keyof typeof RATE_LIMIT_PRESETS,
  endpointName: string
) {
  const config = RATE_LIMIT_PRESETS[preset];

  return function rateLimitMiddleware(
    request: Request,
    userId?: string
  ): { success: boolean; headers: Record<string, string>; error?: string } {
    // Use user ID if authenticated, otherwise IP
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
