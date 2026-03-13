"use client";

import { useState, useEffect, useCallback } from "react";
import { CSRF_COOKIE, CSRF_HEADER } from "@/lib/csrf";

/**
 * Hook to manage CSRF tokens for state-changing API requests
 *
 * Usage:
 * const { csrfToken, csrfHeaders, refreshToken } = useCsrf();
 *
 * // Include csrfHeaders in fetch calls:
 * fetch('/api/listings', {
 *   method: 'POST',
 *   headers: { ...csrfHeaders, 'Content-Type': 'application/json' },
 *   body: JSON.stringify(data)
 * });
 */
export function useCsrf() {
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchToken = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/csrf", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch CSRF token");
      }

      const data = await response.json();
      setCsrfToken(data.csrfToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch CSRF token");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch token on mount
  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  // Headers object to include in requests
  const csrfHeaders: Record<string, string> = csrfToken
    ? { [CSRF_HEADER]: csrfToken }
    : {};

  return {
    csrfToken,
    csrfHeaders,
    loading,
    error,
    refreshToken: fetchToken,
  };
}

/**
 * Helper function to get CSRF token from cookie (for SSR-safe code)
 */
export function getCsrfTokenFromCookie(): string | null {
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
