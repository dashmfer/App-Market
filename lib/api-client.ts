"use client";

import { CSRF_COOKIE, CSRF_HEADER } from "@/lib/csrf";

/**
 * Get CSRF token from cookie for inclusion in API requests.
 */
function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === CSRF_COOKIE) {
      return decodeURIComponent(value);
    }
  }
  return null;
}

/**
 * Fetch wrapper that automatically includes CSRF headers for state-changing requests.
 * Drop-in replacement for fetch() in client components.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const method = (init?.method || "GET").toUpperCase();
  const needsCsrf = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  if (needsCsrf) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      const headers = new Headers(init?.headers);
      if (!headers.has(CSRF_HEADER)) {
        headers.set(CSRF_HEADER, csrfToken);
      }
      init = { ...init, headers };
    }
  }

  return fetch(input, { ...init, credentials: "include" });
}
