import { NextRequest, NextResponse } from "next/server";
import { generateCsrfToken, setCsrfCookie } from "@/lib/csrf";

/**
 * GET /api/csrf
 * Returns a CSRF token and sets it as a cookie
 */
export async function GET(request: NextRequest) {
  const token = generateCsrfToken();

  const response = NextResponse.json({ csrfToken: token });
  setCsrfCookie(response, token);

  return response;
}
