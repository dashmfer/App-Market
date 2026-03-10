# Insecure Defaults Analysis Report

**Date**: 2026-03-05
**Target**: /home/user/App-Market
**Framework**: Next.js 14 + Solana + Prisma

---

## Overall Assessment: GOOD

The codebase has been significantly hardened with fail-secure patterns. Most critical secrets use fail-closed behavior (throw on missing). Notable findings are limited to low/informational severity.

---

## Findings

### Finding 1: CSP allows unsafe-inline and unsafe-eval (MEDIUM)

**Location**: `next.config.js:78`
**Pattern**: `script-src 'self' 'unsafe-inline' 'unsafe-eval'`

**Verification**: This is the production CSP. `unsafe-inline` and `unsafe-eval` weaken XSS protections significantly. The comment notes this is "needed until Next.js nonce support is adopted."

**Production Impact**: An XSS vulnerability would not be mitigated by CSP because inline scripts execute freely.

**Recommendation**: Implement Next.js nonce-based CSP (`experimental.appDir` + nonce headers) to remove `unsafe-inline` and `unsafe-eval`.

---

### Finding 2: Solana address fallbacks with hardcoded mainnet values (LOW)

**Location**: `lib/solana.ts:9,14,19,24`
**Pattern**: `process.env.NEXT_PUBLIC_PROGRAM_ID || "9udUgupraga6dj92zfLec8bAdXUZsU3FGNN3Lf8XGzog"`

**Verification**: These are public-facing Solana addresses (PROGRAM_ID, TREASURY_WALLET, TOKEN_MINT, USDC_MINT). The `env-validation.ts` requires these in production, and `getConnection()` throws in production without RPC URL. Fallbacks only apply in development.

**Production Impact**: NONE — `env-validation.ts` enforces presence in production. These are public values, not secrets.

**Status**: ACCEPTABLE — fail-secure via env validation at startup.

---

### Finding 3: CSRF secret falls back to NEXTAUTH_SECRET (LOW)

**Location**: `lib/csrf.ts:19`
**Pattern**: `const secret = process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET`

**Verification**: If neither is set, throws error (fail-closed). Using NEXTAUTH_SECRET as CSRF secret is acceptable since both are HMAC secrets, though separate secrets provide better key separation.

**Production Impact**: LOW — secret reuse doesn't create a vulnerability, but key compromise affects both systems.

**Recommendation**: Set a dedicated CSRF_SECRET in production for defense-in-depth.

---

### Finding 4: Rate limiting disabled without Redis in dev (INFORMATIONAL)

**Location**: `lib/rate-limit.ts:127-130`
**Pattern**: In-memory fallback in development, throws in production without Upstash.

**Verification**: Production explicitly throws: "CRITICAL: Rate limiting requires Upstash Redis in production." Development uses in-memory fallback with warning.

**Production Impact**: NONE — fail-closed in production.

**Status**: CORRECTLY IMPLEMENTED — fail-secure pattern.

---

### Finding 5: Token encryption falls back to plaintext with warning (MEDIUM)

**Location**: `lib/account-token-encryption.ts:22-29`
**Pattern**: On encryption failure, logs warning but stores token unencrypted.

**Verification**: If `ENCRYPTION_SECRET` is missing, `getEncryptionSecret()` throws. But if encryption itself fails for other reasons (e.g., corrupted key), the catch block logs a warning and stores the token in plaintext.

**Production Impact**: MEDIUM — encryption failure silently degrades to plaintext storage. Monitoring alert is logged but token is saved unencrypted.

**Recommendation**: Consider failing the operation entirely when encryption fails, rather than storing plaintext. At minimum, add structured monitoring alerts that trigger PagerDuty/Slack notifications.

---

### Finding 6: .env.example contains placeholder values that look like real secrets (INFORMATIONAL)

**Location**: `.env.example:9,68,72`
**Pattern**: `NEXTAUTH_SECRET="your-super-secret-key-change-in-production"`, `ADMIN_SECRET="your-admin-secret-change-in-production"`

**Verification**: These are explicitly marked as placeholders. The env-validation.ts enforces minLength=32 for these secrets, so these short placeholder values would fail validation.

**Production Impact**: NONE — env validation catches weak secrets.

**Status**: ACCEPTABLE — placeholder pattern with validation backstop.

---

### Finding 7: Debug mode enabled in development (INFORMATIONAL)

**Location**: `lib/auth.ts:463`
**Pattern**: `debug: process.env.NODE_ENV === 'development'`

**Verification**: Debug mode only activates when NODE_ENV is 'development'. In production, NODE_ENV is always 'production'.

**Production Impact**: NONE — correctly gated.

---

## Fail-Secure Patterns Confirmed

The following critical secrets correctly use fail-closed behavior:

| Secret | Location | Behavior |
|--------|----------|----------|
| NEXTAUTH_SECRET | lib/auth.ts:42 | `throw new Error("NEXTAUTH_SECRET must be set")` |
| ENCRYPTION_SECRET | lib/encryption.ts:27 | `throw new Error("ENCRYPTION_SECRET must be set")` |
| CRON_SECRET | middleware.ts:92-97 | Returns 500 "Server misconfiguration" |
| ADMIN_SECRET | api/admin/reset-listings/route.ts:17 | Returns 403 if missing |
| Privy credentials | lib/auth.ts:237-239 | `throw new Error("Privy is not configured")` |
| Redis (production) | lib/rate-limit.ts:127-130 | `throw new Error("Rate limiting requires Upstash Redis")` |
| Nonce Redis (production) | lib/agent-auth.ts:219-221 | Returns 503 "Authentication service unavailable" |
| WEBHOOK_SECRET | api/webhooks/pool-graduation/route.ts:102 | Returns 401 if missing |

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 2 (CSP unsafe-inline, encryption fallback to plaintext) |
| LOW | 2 (CSRF secret reuse, Solana address fallbacks) |
| INFORMATIONAL | 3 |
| **Total** | **7** |
