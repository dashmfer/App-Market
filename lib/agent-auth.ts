import { NextRequest, NextResponse } from "next/server";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import nacl from "tweetnacl";
import bs58 from "bs58";
import prisma from "@/lib/db";
import { ApiKeyPermission } from "@/lib/prisma-enums";

// Bcrypt cost factor for API key hashing (higher = slower but more secure)
const BCRYPT_ROUNDS = 12;

// ============================================
// TYPES
// ============================================

export interface AgentAuthResult {
  success: boolean;
  userId?: string;
  user?: {
    id: string;
    walletAddress: string | null;
    username: string | null;
    displayName: string | null;
  };
  authMethod?: "api_key" | "wallet_signature" | "session";
  permissions?: ApiKeyPermission[];
  error?: string;
  statusCode?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

// ============================================
// CONSTANTS
// ============================================

const API_KEY_PREFIX = "ak_live_";
// SECURITY: Reduced from 5 minutes to 30 seconds to minimize replay window
const SIGNATURE_TIMESTAMP_TOLERANCE_MS = 30 * 1000; // 30 seconds

// Agent rate limiting — use Upstash Redis if configured, else in-memory fallback
import { checkRateLimitAsync, isRateLimitingDistributed } from "@/lib/rate-limit";

const rateLimitStore = new Map<string, { count: number; resetAt: Date }>();

// ============================================
// API KEY AUTHENTICATION (Option 1)
// ============================================

/**
 * Generate a new API key
 * Returns the plaintext key (only shown once) and the hash to store
 */
export async function generateApiKey(): Promise<{ key: string; hash: string; prefix: string }> {
  // Generate 32 random bytes, encode as base58
  const randomBytes = nacl.randomBytes(32);
  const keyBody = bs58.encode(randomBytes);
  const key = `${API_KEY_PREFIX}${keyBody}`;

  // Hash the key for storage using bcrypt (secure against brute force)
  const hash = await hashApiKey(key);

  // Prefix for identification
  const prefix = key.substring(0, 12);

  return { key, hash, prefix };
}

/**
 * Hash an API key for storage using bcrypt
 * SECURITY: bcrypt is slow by design, making brute-force attacks impractical
 */
export async function hashApiKey(key: string): Promise<string> {
  return bcrypt.hash(key, BCRYPT_ROUNDS);
}

/**
 * Verify an API key against its bcrypt hash
 */
export async function verifyApiKeyHash(key: string, hash: string): Promise<boolean> {
  return bcrypt.compare(key, hash);
}

/**
 * Verify an API key and return the associated user
 * SECURITY: Uses bcrypt for hash comparison (resistant to brute force)
 */
async function verifyApiKey(key: string): Promise<AgentAuthResult> {
  if (!key.startsWith(API_KEY_PREFIX)) {
    return { success: false, error: "Invalid API key format", statusCode: 401 };
  }

  // Extract prefix for fast database lookup
  const keyPrefix = key.substring(0, 12);

  // Find API keys matching this prefix
  const apiKeys = await prisma.apiKey.findMany({
    where: { keyPrefix },
    include: {
      user: {
        select: {
          id: true,
          walletAddress: true,
          username: true,
          displayName: true,
        },
      },
    },
  });

  if (apiKeys.length === 0) {
    return { success: false, error: "Invalid API key", statusCode: 401 };
  }

  // Verify against bcrypt hash (check each matching key)
  let matchedKey = null;
  for (const apiKey of apiKeys) {
    const isValid = await verifyApiKeyHash(key, apiKey.keyHash);
    if (isValid) {
      matchedKey = apiKey;
      break;
    }
  }

  if (!matchedKey) {
    return { success: false, error: "Invalid API key", statusCode: 401 };
  }

  if (!matchedKey.isActive) {
    return { success: false, error: "API key is disabled", statusCode: 401 };
  }

  if (matchedKey.expiresAt && matchedKey.expiresAt < new Date()) {
    return { success: false, error: "API key has expired", statusCode: 401 };
  }

  // Update last used timestamp (fire and forget)
  prisma.apiKey.update({
    where: { id: matchedKey.id },
    data: {
      lastUsedAt: new Date(),
      totalRequests: { increment: 1 },
    },
  }).catch(console.error);

  return {
    success: true,
    userId: matchedKey.userId,
    user: matchedKey.user,
    authMethod: "api_key",
    permissions: matchedKey.permissions,
  };
}

// ============================================
// WALLET SIGNATURE AUTHENTICATION (Option 2)
// ============================================

/**
 * Generate the message that agents should sign
 */
export function generateAuthMessage(timestamp: number, nonce?: string): string {
  const base = `AppMarket Agent Auth\nTimestamp: ${timestamp}`;
  return nonce ? `${base}\nNonce: ${nonce}` : base;
}

/**
 * Verify a wallet signature for authentication
 */
async function verifyWalletSignature(
  walletAddress: string,
  signature: string,
  timestamp: string,
  nonce?: string
): Promise<AgentAuthResult> {
  // SECURITY [C2]: Require nonce to prevent signature replay attacks
  if (!nonce) {
    return { success: false, error: "Nonce is required for wallet signature auth", statusCode: 400 };
  }

  // Validate timestamp
  const timestampNum = parseInt(timestamp, 10);
  if (isNaN(timestampNum)) {
    return { success: false, error: "Invalid timestamp", statusCode: 400 };
  }

  const now = Date.now();
  if (Math.abs(now - timestampNum) > SIGNATURE_TIMESTAMP_TOLERANCE_MS) {
    return {
      success: false,
      error: "Timestamp expired. Generate a new signature.",
      statusCode: 401
    };
  }

  // SECURITY [C2]: Atomically check-and-mark nonce as used (Redis-backed)
  const { checkAndMarkNonce } = await import("@/lib/validation");
  const nonceKey = `agent:${walletAddress}:${nonce}`;
  const nonceResult = await checkAndMarkNonce(nonceKey);
  if (nonceResult.used) {
    return { success: false, error: nonceResult.error || "Nonce already used", statusCode: 401 };
  }

  // Reconstruct the message
  const message = generateAuthMessage(timestampNum, nonce);
  const messageBytes = new TextEncoder().encode(message);

  // Decode wallet address and signature
  let publicKeyBytes: Uint8Array;
  let signatureBytes: Uint8Array;

  try {
    publicKeyBytes = bs58.decode(walletAddress);
    signatureBytes = bs58.decode(signature);
  } catch (e) {
    return { success: false, error: "Invalid wallet address or signature format", statusCode: 400 };
  }

  // Verify signature
  const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

  if (!isValid) {
    return { success: false, error: "Invalid signature", statusCode: 401 };
  }

  // Look up user by wallet address
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { walletAddress },
        { wallets: { some: { walletAddress } } },
      ],
    },
    select: {
      id: true,
      walletAddress: true,
      username: true,
      displayName: true,
    },
  });

  if (!user) {
    return {
      success: false,
      error: "No account found for this wallet. Please register first.",
      statusCode: 401
    };
  }

  return {
    success: true,
    userId: user.id,
    user,
    authMethod: "wallet_signature",
    permissions: [ApiKeyPermission.READ, ApiKeyPermission.WRITE, ApiKeyPermission.TRANSACTION],
  };
}

// ============================================
// UNIFIED AUTH MIDDLEWARE
// ============================================

/**
 * Authenticate an agent request
 * Supports both API key and wallet signature auth
 */
export async function authenticateAgent(request: NextRequest): Promise<AgentAuthResult> {
  // Check for API key first (Authorization: Bearer ak_live_xxx)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (token.startsWith(API_KEY_PREFIX)) {
      return verifyApiKey(token);
    }
  }

  // Check for wallet signature auth
  const walletAddress = request.headers.get("x-wallet-address");
  const signature = request.headers.get("x-wallet-signature");
  const timestamp = request.headers.get("x-auth-timestamp");
  const nonce = request.headers.get("x-auth-nonce");

  if (walletAddress && signature && timestamp) {
    return verifyWalletSignature(walletAddress, signature, timestamp, nonce || undefined);
  }

  return {
    success: false,
    error: "Authentication required. Provide API key or wallet signature.",
    statusCode: 401
  };
}

/**
 * Check if auth result has required permission
 */
export function hasPermission(
  authResult: AgentAuthResult,
  required: ApiKeyPermission
): boolean {
  if (!authResult.success || !authResult.permissions) return false;
  return authResult.permissions.includes(required) ||
         authResult.permissions.includes(ApiKeyPermission.ADMIN);
}

// ============================================
// RATE LIMITING
// ============================================

/**
 * Check rate limit for an API key or wallet
 * SECURITY: Uses Upstash Redis in production for distributed rate limiting
 */
export async function checkAgentRateLimit(
  identifier: string,
  limit: number = 100
): Promise<RateLimitResult> {
  // Use distributed rate limiting (Upstash) if available
  if (isRateLimitingDistributed()) {
    const result = await checkRateLimitAsync(identifier, "agent-api", "read");
    return {
      allowed: !result.isLimited,
      remaining: result.remaining,
      resetAt: new Date(result.resetTime),
    };
  }

  // Fallback to in-memory (dev only)
  const now = new Date();
  const windowMs = 60 * 1000;
  const resetAt = new Date(now.getTime() + windowMs);

  const current = rateLimitStore.get(identifier);

  if (!current || current.resetAt < now) {
    rateLimitStore.set(identifier, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (current.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count++;
  return { allowed: true, remaining: limit - current.count, resetAt: current.resetAt };
}

// ============================================
// WEBHOOK SIGNATURE
// ============================================

/**
 * Generate HMAC signature for webhook payload
 */
export function signWebhookPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Verify webhook signature (for SDK/agent use)
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = signWebhookPayload(payload, secret);
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Generate a random webhook secret
 */
export function generateWebhookSecret(): string {
  const randomBytes = nacl.randomBytes(32);
  return `whsec_${bs58.encode(randomBytes)}`;
}

// ============================================
// RESPONSE HELPERS
// ============================================

/**
 * Create an error response for agent API
 */
export function agentErrorResponse(
  error: string,
  statusCode: number = 400
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error,
      timestamp: Date.now(),
    },
    { status: statusCode }
  );
}

/**
 * Create a success response for agent API
 */
export function agentSuccessResponse<T>(
  data: T,
  statusCode: number = 200
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
      timestamp: Date.now(),
    },
    { status: statusCode }
  );
}
