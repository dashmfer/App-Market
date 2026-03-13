/**
 * SECURITY [H6]: Global fetch wrapper that auto-injects CSRF headers.
 *
 * Instead of requiring every page/component to import useCsrf() and manually
 * attach the token, this utility reads the CSRF cookie (set by the server via
 * the double-submit cookie pattern) and attaches it as a header for any
 * state-changing request (POST / PUT / DELETE / PATCH).
 *
 * Usage:
 *   import { secureFetch } from "@/lib/fetch";
 *   const res = await secureFetch("/api/listings", { method: "POST", body: ... });
 */

const CSRF_COOKIE_NAME =
  typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? '__Host-csrf-token'
    : 'csrf-token';
const CSRF_HEADER = 'x-csrf-token';

// SECURITY [L10]: Cookie parsing is duplicated across multiple files.
// TODO: Extract to a shared utility in lib/cookies.ts
function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find(c => c.startsWith(`${CSRF_COOKIE_NAME}=`));
  return match ? match.split('=')[1] : null;
}

export async function secureFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method || 'GET').toUpperCase();

  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      const headers = new Headers(init?.headers);
      if (!headers.has(CSRF_HEADER)) {
        headers.set(CSRF_HEADER, csrfToken);
      }
      init = { ...init, headers };
    }
  }

  return fetch(input, init);
}
