# Insecure Defaults Detection Report

**Project:** App-Market (Next.js Marketplace)
**Date:** 2026-03-01
**Scope:** Full codebase excluding `node_modules/`, `.next/`, `.git/`

---

## Executive Summary

The App-Market codebase demonstrates a generally strong security posture with multiple defense-in-depth patterns. The application uses fail-secure patterns for critical secrets (NEXTAUTH_SECRET, ENCRYPTION_SECRET, CRON_SECRET) and enforces stricter validation in production. However, the analysis identified **12 findings** across 4 severity levels. The most notable patterns involve hardcoded Solana wallet/program addresses used as fallback defaults, a production-accessible debug page, and token encryption silently falling back to plaintext on failure.

### Severity Breakdown

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 1 | Fail-open pattern with financial impact |
| HIGH | 3 | Patterns that could lead to security bypass or data exposure |
| MEDIUM | 5 | Defense weaknesses that reduce security posture |
| LOW / INFO | 3 | Minor issues or positive observations |

---

## CRITICAL Findings

### C-1: Token Encryption Fails Open -- OAuth Tokens Stored in Plaintext on Error

**File:** `/home/user/App-Market/lib/account-token-encryption.ts` (lines 22-29)

```typescript
} catch (error) {
    // SECURITY: Log structured warning for monitoring -- token will be stored in plaintext
    console.error(`[Token Encryption] SECURITY WARNING: Failed to encrypt ${field}:`, error);
    if (process.env.NODE_ENV === "production") {
        console.error(`[Token Encryption] ALERT: ${field} stored UNENCRYPTED -- investigate immediately`);
    }
    // NOTE: No throw -- execution continues with plaintext token
}
```

**Analysis:** When encryption fails (e.g., misconfigured `ENCRYPTION_SECRET`, memory issues, or crypto errors), OAuth tokens (`refresh_token`, `access_token`, `id_token`) are silently stored in the database **in plaintext**. The code logs a warning but does not throw or prevent the write. This is a **fail-open** pattern.

**Impact:** If `ENCRYPTION_SECRET` is misconfigured or the encryption library encounters an error, sensitive OAuth tokens will be stored unencrypted in the database. A database breach would then expose these tokens directly.

**Code Path:** `db-middleware.ts` -> `encryptAccountTokens()` -> catches error -> continues with plaintext value -> Prisma writes to database.

**Recommendation:** Throw an error when encryption fails in production to prevent storing plaintext secrets. Add a circuit breaker or alert mechanism.

---

## HIGH Findings

### H-1: Hardcoded Solana Program ID and Treasury Wallet Fallback Addresses

**Files:**
- `/home/user/App-Market/lib/solana.ts` (lines 8-25)
- `/home/user/App-Market/lib/config.ts` (lines 164-185)

```typescript
// lib/solana.ts
export const PROGRAM_ID = new PublicKey(
    process.env.NEXT_PUBLIC_PROGRAM_ID || "9udUgupraga6dj92zfLec8bAdXUZsU3FGNN3Lf8XGzog"
);
export const TREASURY_WALLET = new PublicKey(
    process.env.NEXT_PUBLIC_TREASURY_WALLET || "3BU9NRDpXqw7h8wed1aTxERk4cg5hajsbH4nFfVgYkJ6"
);
export const PLATFORM_TOKEN_MINT = new PublicKey(
    process.env.NEXT_PUBLIC_APP_TOKEN_MINT || "Ansto3G3SzGt6bXo3pMddiM4YkW9Yt8y7Qvwy47dBAGS"
);
export const USDC_MINT = new PublicKey(
    process.env.NEXT_PUBLIC_USDC_MINT || "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);
```

**Analysis:** These are **fail-open** patterns. If the environment variables are not set:
- `PROGRAM_ID` falls back to what appears to be a devnet program address.
- `TREASURY_WALLET` falls back to a hardcoded wallet -- potentially a development or test wallet.
- `PLATFORM_TOKEN_MINT` and `USDC_MINT` fall back to hardcoded addresses.

These are `NEXT_PUBLIC_*` vars, meaning `env-validation.ts` only marks them required in production (`required: process.env.NODE_ENV === "production"`). In any non-production deployment that mistakenly handles real funds (staging, preview deployments), the fallback addresses would silently direct fees and escrow funds to incorrect wallets.

**Impact:** If env vars are missing in a staging or preview deployment that processes real Solana transactions, platform fees would be sent to a potentially uncontrolled hardcoded wallet address. The `PROGRAM_ID` fallback could cause the app to interact with a wrong or devnet smart contract.

**Code Path:** Module-level constants evaluated at import time. No runtime validation outside of production.

**Recommendation:** These constants should throw on missing env vars in all environments, not just production. Alternatively, wrap them in lazy getters that validate at first use.

---

### H-2: Debug Session Page Accessible in Production

**File:** `/home/user/App-Market/app/debug/session/page.tsx`

```typescript
export default function SessionDebugPage() {
    // Displays: full session object, all cookies, API session endpoint data
    // No environment check, no auth guard
}
```

**Analysis:** The `/debug/session` page is a fully functional debug tool that displays:
- Complete session JSON (user ID, email, wallet address, admin status)
- All browser cookies
- Raw API session response

This page has **no authentication check** and **no production environment guard**. It is a Next.js page route, so it is not covered by the middleware's `PROTECTED_ROUTES` list (which only protects `/dashboard`, `/settings`, etc. -- not `/debug`).

**Impact:** Any user (authenticated or not) can access `/debug/session` in production. While the page uses client-side `useSession()` and only shows the current user's own session, the page itself should not exist in production as it exposes implementation details and can aid reconnaissance.

**Recommendation:** Either remove the page, gate it behind `NODE_ENV === "development"`, or add it to the `PROTECTED_ROUTES` and `ADMIN_ROUTES` lists in `middleware.ts`.

---

### H-3: Environment Validation Only Throws in Production

**File:** `/home/user/App-Market/lib/env-validation.ts` (lines 131-141)

```typescript
if (!result.valid) {
    for (const error of result.errors) {
        console.error(`[ENV] ${error}`);
    }
    if (process.env.NODE_ENV === "production") {
        throw new Error(
            `Environment validation failed with ${result.errors.length} error(s). Fix before deploying to production.`
        );
    }
    // In non-production: errors are logged but app continues running
}
```

**Analysis:** In development and staging environments, the app **logs errors but continues running** even when critical environment variables like `DATABASE_URL`, `NEXTAUTH_SECRET`, or `ENCRYPTION_SECRET` are missing. While `lib/auth.ts` line 43 independently throws if `NEXTAUTH_SECRET` is missing, the centralized validation system itself is fail-open outside production.

**Impact:** In staging/preview environments, the app could start with missing or invalid configuration, potentially leading to subtle failures (e.g., encryption disabled, wrong wallet addresses, no rate limiting).

**Recommendation:** Consider throwing on missing critical secrets (NEXTAUTH_SECRET, ENCRYPTION_SECRET, DATABASE_URL) in all environments, while allowing optional vars to be warnings-only.

---

## MEDIUM Findings

### M-1: Client-Side Solana RPC Fallback to Public Devnet

**File:** `/home/user/App-Market/components/providers.tsx` (line 19)

```typescript
const endpoint = useMemo(() => {
    return process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl("devnet");
}, []);
```

**Analysis:** The client-side Solana connection provider falls back to the **public devnet endpoint** if `NEXT_PUBLIC_SOLANA_RPC_URL` is not set. Unlike the server-side `getConnection()` in `lib/solana.ts` (which throws in production), this client-side code has no environment check.

**Impact:** If the env var is missing in a production build, the client would connect to devnet instead of mainnet. Users would see incorrect on-chain data and wallet interactions would fail silently or target the wrong network.

**Code Path:** `components/providers.tsx` -> `ConnectionProvider` -> all client-side Solana interactions.

---

### M-2: CSRF Secret Falls Back to NEXTAUTH_SECRET

**File:** `/home/user/App-Market/lib/csrf.ts` (lines 19-24)

```typescript
function getCsrfSecret(): string {
    const secret = process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET;
    if (!secret) {
        throw new Error("CSRF_SECRET or NEXTAUTH_SECRET must be set");
    }
    return secret;
}
```

**Analysis:** The CSRF token generation uses `NEXTAUTH_SECRET` as a fallback when `CSRF_SECRET` is not set. While the code does throw if neither is set (fail-secure), using the same secret for both CSRF tokens and JWT signing violates the security principle of key separation. If either key is compromised, the attacker gains both capabilities.

**Impact:** Reduced key isolation. A compromised NEXTAUTH_SECRET would also allow CSRF token forgery.

**Recommendation:** Require `CSRF_SECRET` as its own env var, or at minimum derive a separate key from `NEXTAUTH_SECRET` using HKDF.

---

### M-3: .env.example Contains Weak Placeholder Secrets

**File:** `/home/user/App-Market/.env.example` (lines 9, 68, 72)

```bash
NEXTAUTH_SECRET="your-super-secret-key-change-in-production"
ADMIN_SECRET="your-admin-secret-change-in-production"
CRON_SECRET="your-cron-secret-change-in-production"
```

**Analysis:** While `.env.example` is meant to be a template, these placeholder values could be accidentally copied into `.env` without modification. The `env-validation.ts` does enforce `minLength: 32` for these secrets, so the placeholders `"your-super-secret-key-change-in-production"` (44 chars) and `"your-admin-secret-change-in-production"` (38 chars) and `"your-cron-secret-change-in-production"` (37 chars) would **pass the length check**.

**Impact:** If a developer copies `.env.example` to `.env` without changing the secrets, the app would run with known, guessable secrets. The length validation provides a partial safeguard, but the values are predictable.

**Recommendation:** Use obviously invalid placeholders that would be caught by validation (e.g., empty strings or values with `CHANGE_ME` that are deliberately short) or add a known-weak-value check to `env-validation.ts`.

---

### M-4: Cookie `secure` Flag Disabled Outside Production

**Files:**
- `/home/user/App-Market/lib/auth.ts` (line 456): `secure: process.env.NODE_ENV === "production"`
- `/home/user/App-Market/lib/csrf.ts` (line 118): `secure: process.env.NODE_ENV === "production"`
- `/home/user/App-Market/app/api/auth/twitter/connect/route.ts` (line 75): `secure: process.env.NODE_ENV === "production"`

**Analysis:** Session cookies, CSRF cookies, and OAuth state cookies all have the `secure` flag disabled in non-production environments. This is a common and generally acceptable pattern for local development over `http://localhost`. However, staging or preview deployments that may be served over HTTPS but with `NODE_ENV !== "production"` would transmit cookies over unencrypted connections.

**Impact:** In misconfigured staging environments, session tokens could be intercepted over unencrypted HTTP.

**Recommendation:** Consider using `secure: process.env.NODE_ENV !== "development"` to also protect staging deployments, or tie the flag to the URL scheme rather than `NODE_ENV`.

---

### M-5: Twitter OAuth Redirect URI Falls Back to Empty String in Production

**File:** `/home/user/App-Market/app/api/auth/twitter/connect/route.ts` (line 12)

```typescript
const TWITTER_REDIRECT_URI = `${process.env.NEXT_PUBLIC_SITE_URL || (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000")}/api/auth/twitter/callback`;
```

**Analysis:** If `NEXT_PUBLIC_SITE_URL` is not set in production, the redirect URI becomes `"/api/auth/twitter/callback"` (relative path with empty host). This would cause the Twitter OAuth flow to fail, which is **fail-secure** in effect (OAuth breaks rather than misdirecting). However, the resulting error would be opaque.

Similarly in `callback/route.ts` line 11, `SITE_URL` falls back to empty string in production, which would cause all `NextResponse.redirect()` calls to redirect to root-relative URLs.

**Impact:** OAuth flow breaks silently if `NEXT_PUBLIC_SITE_URL` is missing in production. This is fail-secure but provides poor diagnostics.

**Recommendation:** Throw a clear error at startup if `NEXT_PUBLIC_SITE_URL` is not set in production (already partially covered by `env-validation.ts`, but the module-level constant evaluation happens before validation).

---

## LOW / INFORMATIONAL Findings

### L-1: In-Memory Rate Limiting and Nonce Checking in Development

**Files:**
- `/home/user/App-Market/lib/rate-limit.ts` (lines 126-135)
- `/home/user/App-Market/lib/validation.ts` (lines 41-53)
- `/home/user/App-Market/lib/agent-auth.ts` (lines 219-222)

**Analysis:** When Redis is unavailable:
- **Rate limiting** throws an error in production (fail-secure) but falls back to in-memory in development.
- **Nonce validation** returns `true` (already used) in production (fail-secure) but falls back to in-memory in development.
- **Agent wallet auth nonce** returns a 503 error in production (fail-secure) but allows through in development.

All three subsystems correctly **fail closed in production**. The in-memory fallbacks in development are acceptable for local testing but would be ineffective in any multi-instance deployment.

**Status:** Appropriately handled. No action needed.

---

### L-2: Buyback Percentage Parsed with Double Fallback

**File:** `/home/user/App-Market/lib/config.ts` (line 42)

```typescript
buybackPercentage: Math.max(0, Math.min(100, parseInt(process.env.BUYBACK_PERCENTAGE || "20") || 20)),
```

**Analysis:** The buyback percentage has a double fallback: first to `"20"` if the env var is missing, then to `20` if `parseInt` returns `NaN` (which would happen if the env var is set to a non-numeric value). The `Math.max(0, Math.min(100, ...))` clamp ensures the value stays in a valid range.

**Impact:** Minimal. This is a non-security configuration value. The double fallback ensures a sensible default.

---

### L-3: PATO Config Keys Fall Back to Null

**File:** `/home/user/App-Market/lib/config.ts` (lines 106-109)

```typescript
configKey: process.env.PATO_DBC_CONFIG_KEY || null,
feeClaimerWallet: process.env.PATO_FEE_CLAIMER_WALLET || null,
```

**Analysis:** These optional feature configuration values fall back to `null` when not set, which disables the PATO (Post-Acquisition Token Offering) feature. This is a **fail-secure** pattern -- the feature is disabled rather than running with incorrect values.

**Status:** Appropriately handled.

---

## Positive Security Observations

The following patterns demonstrate strong security engineering:

1. **NEXTAUTH_SECRET hard crash:** `lib/auth.ts` line 43-45 throws immediately if `NEXTAUTH_SECRET` is missing, preventing the app from starting without session signing capability.

2. **ENCRYPTION_SECRET hard crash:** `lib/encryption.ts` lines 26-38 throws if `ENCRYPTION_SECRET` is missing or too short.

3. **No CORS wildcards:** No `Access-Control-Allow-Origin: *` headers found anywhere. The OpenAPI route explicitly documents this decision.

4. **No weak cryptography:** No MD5, SHA1, DES, RC4, or ECB usage found. All encryption uses AES-256-GCM with proper IV/salt/auth tags.

5. **Constant-time comparisons everywhere:** All secret comparisons use `timingSafeEqual` with buffer padding to prevent timing attacks (middleware.ts, cron-auth.ts, admin routes, webhook verification, CSRF verification, Twitter OAuth state).

6. **bcrypt for API keys:** Agent API keys are hashed with bcrypt (cost factor 12) rather than simple hashing.

7. **Comprehensive security headers:** `next.config.js` sets HSTS, X-Frame-Options, CSP, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy.

8. **Rate limiting fails closed in production:** `lib/rate-limit.ts` throws an error if Redis is unavailable in production rather than silently disabling rate limits.

9. **Nonce replay prevention fails closed:** `lib/validation.ts` rejects requests when Redis is unavailable in production.

10. **Magic byte validation:** File uploads validate both MIME type and actual file magic bytes to prevent extension spoofing.

11. **Atomic idempotent operations:** Cron jobs use `updateMany` with WHERE filters for idempotent claim-and-process patterns.

---

## Summary Table

| ID  | Severity | Finding | Pattern | File |
|-----|----------|---------|---------|------|
| C-1 | CRITICAL | OAuth token encryption fails open | Fail-open | `lib/account-token-encryption.ts` |
| H-1 | HIGH | Hardcoded Solana addresses as fallbacks | Fail-open | `lib/solana.ts`, `lib/config.ts` |
| H-2 | HIGH | Debug page accessible in production | Missing auth | `app/debug/session/page.tsx` |
| H-3 | HIGH | Env validation only throws in production | Fail-open | `lib/env-validation.ts` |
| M-1 | MEDIUM | Client-side RPC devnet fallback | Fail-open | `components/providers.tsx` |
| M-2 | MEDIUM | CSRF secret shared with NEXTAUTH_SECRET | Weak isolation | `lib/csrf.ts` |
| M-3 | MEDIUM | .env.example has plausible-length placeholders | Weak defaults | `.env.example` |
| M-4 | MEDIUM | Cookie secure flag disabled outside production | Config gap | `lib/auth.ts`, `lib/csrf.ts` |
| M-5 | MEDIUM | Twitter OAuth URI empty in production | Fail-secure (opaque) | `app/api/auth/twitter/connect/route.ts` |
| L-1 | LOW | In-memory fallbacks in dev only | Acceptable | `lib/rate-limit.ts`, `lib/validation.ts` |
| L-2 | LOW | Buyback percentage double fallback | Acceptable | `lib/config.ts` |
| L-3 | LOW | PATO config null fallback | Fail-secure | `lib/config.ts` |

---

## Recommended Priority Actions

1. **[CRITICAL] Fix C-1:** Make `encryptAccountTokens()` throw in production when encryption fails, preventing plaintext token storage.

2. **[HIGH] Fix H-2:** Remove or protect the `/debug/session` page. Add it to `ADMIN_ROUTES` in `middleware.ts` or guard with `NODE_ENV === "development"`.

3. **[HIGH] Fix H-1:** Change hardcoded Solana address fallbacks to throw errors in all environments, or add explicit `required: true` to env-validation for these variables.

4. **[MEDIUM] Fix M-2:** Generate a derived CSRF secret from `NEXTAUTH_SECRET` using HKDF rather than using the raw value directly.

5. **[MEDIUM] Fix M-3:** Use obviously invalid or deliberately short placeholder secrets in `.env.example` that will fail the minLength validation.
