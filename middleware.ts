import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { timingSafeEqual } from "crypto";

/**
 * Middleware for route protection and security
 *
 * Protects:
 * - Dashboard routes (require auth)
 * - API routes that need authentication
 * - Admin routes (require admin role)
 * - Cron routes (require CRON_SECRET)
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
  "/api/listings", // POST, PUT, DELETE
  "/api/messages",
  "/api/notifications",
  "/api/transactions",
  "/api/disputes",
  "/api/collaborators",
  "/api/offers",
  "/api/bids",
  "/api/user",
  "/api/uploads",
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
  "/api/listings", // GET only
  "/api/search",
  "/api/categories",
  "/api/health",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Skip static files and public assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes(".") // files with extensions
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

  // Admin route protection
  if (ADMIN_ROUTES.some(route => pathname.startsWith(route))) {
    if (!token) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
      return NextResponse.redirect(new URL("/auth/signin", request.url));
    }

    if (!token.isAdmin) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Forbidden - Admin access required" },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  }

  // Protected page routes
  if (PROTECTED_ROUTES.some(route => pathname.startsWith(route))) {
    if (!token) {
      // Store the original URL to redirect back after login
      const signInUrl = new URL("/auth/signin", request.url);
      signInUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(signInUrl);
    }
    return NextResponse.next();
  }

  // Protected API routes
  if (PROTECTED_API_ROUTES.some(route => pathname.startsWith(route))) {
    // Allow GET requests to some routes without auth (public reads)
    const isPublicRead =
      method === "GET" &&
      (pathname.startsWith("/api/listings") && !pathname.includes("/my-listings"));

    if (!isPublicRead && !token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.next();
  }

  return NextResponse.next();
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
