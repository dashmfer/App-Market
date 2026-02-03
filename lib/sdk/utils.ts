/**
 * AppMarket Agent SDK Utilities
 */

import { WebhookPayload, WebhookEventType } from "./types";

// ============================================
// ENCODING UTILITIES
// ============================================

/**
 * Encode bytes to base64 string
 */
export function encodeBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  // Browser fallback
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decode base64 string to bytes
 */
export function decodeBase64(base64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }
  // Browser fallback
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ============================================
// WEBHOOK UTILITIES
// ============================================

/**
 * Verify a webhook signature
 *
 * @example
 * ```typescript
 * import { verifyWebhookSignature } from '@appmarket/sdk';
 *
 * app.post('/webhook', async (req, res) => {
 *   const signature = req.headers['x-webhook-signature'];
 *   const payload = JSON.stringify(req.body);
 *
 *   if (!verifyWebhookSignature(payload, signature, process.env.WEBHOOK_SECRET)) {
 *     return res.status(401).send('Invalid signature');
 *   }
 *
 *   // Process webhook...
 * });
 * ```
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(payload);

    // Use SubtleCrypto for HMAC verification
    const key = await crypto.subtle.importKey(
      "raw",
      keyData.buffer as ArrayBuffer,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBytes = await crypto.subtle.sign("HMAC", key, messageData.buffer as ArrayBuffer);
    const expectedSignature = Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Constant-time comparison
    if (signature.length !== expectedSignature.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < signature.length; i++) {
      result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }

    return result === 0;
  } catch {
    return false;
  }
}

/**
 * Parse and validate a webhook payload
 *
 * @example
 * ```typescript
 * import { parseWebhookPayload } from '@appmarket/sdk';
 *
 * const payload = parseWebhookPayload(req.body);
 *
 * switch (payload.type) {
 *   case 'BID_PLACED':
 *     console.log('New bid:', payload.data.amount);
 *     break;
 *   case 'LISTING_ENDED':
 *     console.log('Listing ended:', payload.data.listingId);
 *     break;
 * }
 * ```
 */
export function parseWebhookPayload(body: unknown): WebhookPayload {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid webhook payload: expected object");
  }

  const payload = body as Record<string, unknown>;

  if (typeof payload.id !== "string") {
    throw new Error("Invalid webhook payload: missing id");
  }

  if (typeof payload.type !== "string") {
    throw new Error("Invalid webhook payload: missing type");
  }

  if (typeof payload.timestamp !== "number") {
    throw new Error("Invalid webhook payload: missing timestamp");
  }

  if (!payload.data || typeof payload.data !== "object") {
    throw new Error("Invalid webhook payload: missing data");
  }

  return {
    id: payload.id,
    type: payload.type as WebhookEventType,
    timestamp: payload.timestamp,
    data: payload.data as Record<string, unknown>,
  };
}

/**
 * Check if a webhook payload is stale (older than maxAge)
 *
 * @param payload - The webhook payload
 * @param maxAgeMs - Maximum age in milliseconds (default: 5 minutes)
 */
export function isWebhookStale(
  payload: WebhookPayload,
  maxAgeMs: number = 5 * 60 * 1000
): boolean {
  const age = Date.now() - payload.timestamp;
  return age > maxAgeMs;
}

// ============================================
// TYPE GUARDS
// ============================================

/**
 * Check if a webhook event type is a listing event
 */
export function isListingEvent(
  type: WebhookEventType
): type is
  | "LISTING_CREATED"
  | "LISTING_UPDATED"
  | "LISTING_ENDED"
  | "LISTING_ENDING_SOON" {
  return [
    "LISTING_CREATED",
    "LISTING_UPDATED",
    "LISTING_ENDED",
    "LISTING_ENDING_SOON",
  ].includes(type);
}

/**
 * Check if a webhook event type is a bid event
 */
export function isBidEvent(
  type: WebhookEventType
): type is "BID_PLACED" | "BID_OUTBID" | "BID_WON" {
  return ["BID_PLACED", "BID_OUTBID", "BID_WON"].includes(type);
}

/**
 * Check if a webhook event type is an offer event
 */
export function isOfferEvent(
  type: WebhookEventType
): type is
  | "OFFER_RECEIVED"
  | "OFFER_ACCEPTED"
  | "OFFER_REJECTED"
  | "OFFER_COUNTERED" {
  return [
    "OFFER_RECEIVED",
    "OFFER_ACCEPTED",
    "OFFER_REJECTED",
    "OFFER_COUNTERED",
  ].includes(type);
}

/**
 * Check if a webhook event type is a transaction event
 */
export function isTransactionEvent(
  type: WebhookEventType
): type is
  | "TRANSACTION_INITIATED"
  | "TRANSACTION_COMPLETED"
  | "TRANSACTION_CANCELLED" {
  return [
    "TRANSACTION_INITIATED",
    "TRANSACTION_COMPLETED",
    "TRANSACTION_CANCELLED",
  ].includes(type);
}

// ============================================
// RETRY UTILITIES
// ============================================

/**
 * Retry a function with exponential backoff
 *
 * @example
 * ```typescript
 * import { retry } from '@appmarket/sdk';
 *
 * const result = await retry(
 *   () => client.bids.place({ listingId, amount }),
 *   { maxAttempts: 3, baseDelayMs: 1000 }
 * );
 * ```
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    shouldRetry?: (error: unknown) => boolean;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    shouldRetry = () => true,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !shouldRetry(error)) {
        throw error;
      }

      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// ============================================
// FORMATTING UTILITIES
// ============================================

/**
 * Format a price in SOL
 */
export function formatSOL(amount: number, decimals: number = 2): string {
  return `${amount.toFixed(decimals)} SOL`;
}

/**
 * Format a date relative to now
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const target = typeof date === "string" ? new Date(date) : date;
  const diffMs = target.getTime() - now.getTime();
  const diffSecs = Math.round(diffMs / 1000);
  const diffMins = Math.round(diffSecs / 60);
  const diffHours = Math.round(diffMins / 60);
  const diffDays = Math.round(diffHours / 24);

  if (diffMs < 0) {
    // Past
    if (diffSecs > -60) return "just now";
    if (diffMins > -60) return `${-diffMins}m ago`;
    if (diffHours > -24) return `${-diffHours}h ago`;
    return `${-diffDays}d ago`;
  } else {
    // Future
    if (diffSecs < 60) return "in a moment";
    if (diffMins < 60) return `in ${diffMins}m`;
    if (diffHours < 24) return `in ${diffHours}h`;
    return `in ${diffDays}d`;
  }
}
