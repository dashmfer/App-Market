/**
 * CSRF Protection utilities
 * Implements double-submit cookie pattern with HMAC verification
 */

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const CSRF_COOKIE_NAME = process.env.NODE_ENV === 'production' ? '__Host-csrf-token' : 'csrf-token';
const CSRF_HEADER_NAME = "x-csrf-token";
const TOKEN_LENGTH = 32;

/**
 * Get the CSRF secret, cryptographically derived from NEXTAUTH_SECRET.
 * SECURITY [M9]: Uses HMAC-SHA256 to derive a separate key so CSRF tokens
 * can't be used to forge JWTs and vice-versa. No extra env var needed.
 */
let _derivedCsrfSecret: string | null = null;

function getCsrfSecret(): string {
  if (_derivedCsrfSecret) return _derivedCsrfSecret;

  const base = process.env.NEXTAUTH_SECRET;
  if (!base) {
    throw new Error("NEXTAUTH_SECRET must be set");
  }

  // Derive a dedicated CSRF key from the auth secret via HMAC-SHA256
  _derivedCsrfSecret = crypto
    .createHmac("sha256", "csrf-token-derivation-key")
    .update(base)
    .digest("hex");

  return _derivedCsrfSecret;
}

/**
 * Generate a CSRF token
 * Returns a token that includes a random value and HMAC signature
 */
export function generateCsrfToken(): string {
  const secret = getCsrfSecret();
  const randomValue = crypto.randomBytes(TOKEN_LENGTH).toString("hex");
  const timestamp = Date.now().toString(36);
  const data = `${randomValue}.${timestamp}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("hex");
  return `${data}.${signature}`;
}

/**
 * Verify a CSRF token
 */
export function verifyCsrfToken(token: string): boolean {
  if (!token) return false;

  const secret = getCsrfSecret();
  const parts = token.split(".");

  if (parts.length !== 3) return false;

  const [randomValue, timestamp, providedSignature] = parts;
  const data = `${randomValue}.${timestamp}`;

  // Verify signature
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("hex");

  // Timing-safe comparison
  if (providedSignature.length !== expectedSignature.length) return false;

  const isValid = crypto.timingSafeEqual(
    Buffer.from(providedSignature),
    Buffer.from(expectedSignature)
  );

  if (!isValid) return false;

  // Check token age (valid for 24 hours)
  const tokenTime = parseInt(timestamp, 36);
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  if (Date.now() - tokenTime > maxAge) return false;

  return true;
}

/**
 * Validate CSRF token from request
 * Checks both cookie and header match and are valid
 */
export function validateCsrfRequest(request: NextRequest): {
  valid: boolean;
  error?: string;
} {
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  const headerToken = request.headers.get(CSRF_HEADER_NAME);

  if (!cookieToken) {
    return { valid: false, error: "Missing CSRF cookie" };
  }

  if (!headerToken) {
    return { valid: false, error: "Missing CSRF header" };
  }

  // Double-submit validation: cookie and header must match (timing-safe)
  if (cookieToken.length !== headerToken.length ||
      !crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
    return { valid: false, error: "CSRF token mismatch" };
  }

  // Verify token signature and expiry
  if (!verifyCsrfToken(cookieToken)) {
    return { valid: false, error: "Invalid or expired CSRF token" };
  }

  return { valid: true };
}

/**
 * Set CSRF token cookie on response
 */
export function setCsrfCookie(response: NextResponse, token: string): void {
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Must be readable by JavaScript for double-submit
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 24 * 60 * 60, // 24 hours
  });
}

/**
 * Create a CSRF error response
 */
export function csrfError(message: string): NextResponse {
  return NextResponse.json(
    { error: message },
    { status: 403 }
  );
}

/**
 * Higher-order function to wrap API route handlers with CSRF protection
 * Use for POST, PUT, DELETE, PATCH endpoints
 */
export function withCsrfProtection<T>(
  handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse<T>>
) {
  return async (request: NextRequest, ...args: any[]): Promise<NextResponse<T | { error: string }>> => {
    const validation = validateCsrfRequest(request);

    if (!validation.valid) {
      return csrfError(validation.error || "CSRF validation failed") as NextResponse<{ error: string }>;
    }

    return handler(request, ...args);
  };
}

// Export constants for use in frontend
export const CSRF_COOKIE = CSRF_COOKIE_NAME;
export const CSRF_HEADER = CSRF_HEADER_NAME;
