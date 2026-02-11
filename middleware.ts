import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { timingSafeEqual, randomBytes } from "crypto";
import { isSessionNotRevokedEdge } from "@/lib/session-revocation-edge";

/**
 * Middleware for route protection, session revocation, and CSP nonce injection.
 */

// Routes that require authentication
const PROTECTED_ROUTES = [
  "/dashboard",
  "/settings",
  "/messages",
  "/notifications",
  "/listings/new",
  "/listings/edit",
  "/transactions",
  "/disputes",
  "/collaborations",
];

// API routes that require authentication
const PROTECTED_API_ROUTES = [
  "/api/listings",       // POST, PUT, DELETE
  "/api/messages",
  "/api/notifications",
  "/api/transactions",
  "/api/disputes",
  "/api/collaborators",
  "/api/offers",
  "/api/bids",
  "/api/user",
  "/api/uploads",
  "/api/purchases",
  "/api/transfers",
  "/api/withdrawals",
  "/api/referrals",
  "/api/token-launch",
  "/api/watchlist",
  "/api/agent",
  "/api/profile",
  "/api/purchase-partners",
  "/api/github",
  "/api/reviews",        // POST/PUT/DELETE need auth
];

// Admin-only routes
const ADMIN_ROUTES = [
  "/admin",
  "/api/admin",
];

// Cron routes (require CRON_SECRET)
const CRON_ROUTES = [
  "/api/cron",
];

// Public API routes (no auth needed)
const PUBLIC_API_ROUTES = [
  "/api/auth",
  "/api/listings",    // GET only
  "/api/search",
  "/api/categories",
  "/api/health",
  "/api/stats",       // Public statistics
  "/api/leaderboard", // Public leaderboard
  "/api/users",       // Public user profiles
  "/api/openapi",     // API docs
  "/api/reviews",     // GET only (public reviews)
];

/**
 * SECURITY [M11]: Generate a nonce-based CSP response for page routes.
 * Replaces static 'unsafe-inline' with per-request nonces for script-src.
 * 'strict-dynamic' allows scripts loaded by nonced scripts to also execute.
 */
function createPageResponse(request: NextRequest): NextResponse {
  const nonce = randomBytes(16).toString("base64");

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://avatars.githubusercontent.com https://github.com https://raw.githubusercontent.com https://opengraph.githubassets.com https://*.public.blob.vercel-storage.com",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mainnet-beta.solana.com https://api.devnet.solana.com wss://api.mainnet-beta.solana.com wss://api.devnet.solana.com https://*.helius-rpc.com https://*.vercel-storage.com https://auth.privy.io https://*.privy.io wss://*.privy.io https://*.walletconnect.com wss://*.walletconnect.com https://explorer-api.walletconnect.com",
    "frame-src 'self' https://phantom.app https://solflare.com https://auth.privy.io https://*.privy.io",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");

  // Pass nonce to page components via request header
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

// NOTE: CSRF protection is provided by:
// 1. SameSite=Lax cookies (prevents cross-site cookie submission)
// 2. JSON Content-Type requirement (simple forms can't send JSON)
// 3. Origin/Referer checking by Next.js
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;
  const isApiRoute = pathname.startsWith("/api/");

  // Skip static files and public assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    /\.(ico|png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|eot|map)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Cron route protection - require CRON_SECRET
  if (CRON_ROUTES.some(route => pathname.startsWith(route))) {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("[Middleware] CRON_SECRET not configured");
      return NextResponse.json(
        { error: "Server misconfiguration" },
        { status: 500 }
      );
    }

    // SECURITY: Use constant-time comparison to prevent timing attacks
    const expectedHeader = `Bearer ${cronSecret}`;
    let isValid = false;

    if (authHeader && authHeader.length === expectedHeader.length) {
      try {
        isValid = timingSafeEqual(
          Buffer.from(authHeader),
          Buffer.from(expectedHeader)
        );
      } catch {
        isValid = false;
      }
    }

    if (!isValid) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.next();
  }

  // Get user token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // SECURITY [M5]: Check session revocation via Redis (Edge-compatible).
  // This is defense-in-depth — routes also check via getAuthToken() with Prisma.
  if (token?.sessionId) {
    try {
      const valid = await isSessionNotRevokedEdge(
        token.sessionId as string,
        token.id as string,
        token.iat as number | undefined
      );
      if (!valid) {
        if (isApiRoute) {
          return NextResponse.json({ error: "Session revoked" }, { status: 401 });
        }
        const signInUrl = new URL("/auth/signin", request.url);
        signInUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(signInUrl);
      }
    } catch {
      // If Redis is down, fall through — API-level Prisma check is authoritative
    }
  }

  // Admin route protection
  if (ADMIN_ROUTES.some(route => pathname.startsWith(route))) {
    if (!token) {
      if (isApiRoute) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/auth/signin", request.url));
    }

    if (!token.isAdmin) {
      if (isApiRoute) {
        return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/", request.url));
    }

    return isApiRoute ? NextResponse.next() : createPageResponse(request);
  }

  // Protected page routes
  if (PROTECTED_ROUTES.some(route => pathname.startsWith(route))) {
    if (!token) {
      const signInUrl = new URL("/auth/signin", request.url);
      signInUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(signInUrl);
    }
    return createPageResponse(request);
  }

  // Protected API routes
  if (PROTECTED_API_ROUTES.some(route => pathname.startsWith(route))) {
    const isPublicRead =
      (method === "GET" && pathname.startsWith("/api/listings") && !pathname.includes("/my-listings")) ||
      (method === "GET" && pathname.startsWith("/api/reviews")) ||
      (method === "GET" && pathname.startsWith("/api/stats")) ||
      (method === "GET" && pathname.startsWith("/api/leaderboard")) ||
      (method === "GET" && pathname.startsWith("/api/users")) ||
      (method === "GET" && pathname.startsWith("/api/profile/") && !pathname.includes("/upload"));

    if (!isPublicRead && !token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.next();
  }

  // All other routes (public pages) — apply CSP nonce
  return isApiRoute ? NextResponse.next() : createPageResponse(request);
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
