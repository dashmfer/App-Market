# Sharp Edges Security Analysis Report

**Project:** App-Market (Next.js/TypeScript)
**Date:** 2026-03-06
**Scope:** Security-relevant APIs -- authentication, authorization, cryptography, session management, input validation, and configuration

---

## Table of Contents

1. [Cryptography Sharp Edges](#1-cryptography-sharp-edges)
2. [Authentication & Session Management Sharp Edges](#2-authentication--session-management-sharp-edges)
3. [Authorization Sharp Edges](#3-authorization-sharp-edges)
4. [Input Validation Sharp Edges](#4-input-validation-sharp-edges)
5. [Configuration Cliffs](#5-configuration-cliffs)
6. [Silent Failures](#6-silent-failures)
7. [CSRF Protection Gaps](#7-csrf-protection-gaps)
8. [File Security Sharp Edges](#8-file-security-sharp-edges)
9. [Summary Table](#9-summary-table)

---

## 1. Cryptography Sharp Edges

### 1.1 Encryption AAD Is Optional -- Omission Silently Disables Cross-Record Swap Protection

**Location:** `lib/encryption.ts:48,86` (`encrypt` and `decrypt` functions)

**Severity:** HIGH

**Description:**
The `encrypt(plaintext, aad?)` and `decrypt(encryptedData, aad?)` functions accept AAD (Additional Authenticated Data) as an optional parameter. When callers omit `aad`, ciphertexts are not bound to any context, meaning an attacker with database write access can swap encrypted values between rows (e.g., move one user's OAuth token to another user's record) without detection by GCM authentication.

This is a **primitive vs. semantic API** problem: the low-level encrypt/decrypt functions expose a raw "optional AAD" knob rather than requiring callers to provide a typed context. Every call site must independently remember to pass the correct AAD. Forgetting produces no error -- it just silently weakens security.

**Evidence:**
- `lib/account-token-encryption.ts:16` calls `encrypt(encrypted[field], aad)` where `aad` can be `undefined` if `extractAad` returns nothing (e.g., when `providerAccountId` is missing from the data payload).
- `lib/webhooks.ts:14` calls `decrypt(secret, aad)` with `aad` derived from `userId`, and on failure falls back to `decrypt(secret)` (no AAD) for backward compatibility -- this silently downgrades protection.

**Recommended Fix:**
Make AAD required by changing the function signature to `encrypt(plaintext: string, aad: string)`. Add an explicit `encryptWithoutAAD` for the rare case where context binding is intentionally skipped, making the security trade-off visible at the call site.

---

### 1.2 Encryption Failure Silently Falls Through to Plaintext Storage

**Location:** `lib/account-token-encryption.ts:25-34`

**Severity:** HIGH

**Description:**
When `encrypt()` throws an exception inside `encryptAccountTokens`, the catch block logs an error but returns the original unencrypted value. The token is then stored in the database in plaintext. This is a **silent failure** pattern: the caller (Prisma middleware) has no way to know that encryption was skipped.

In production, this means a misconfigured `ENCRYPTION_SECRET` or a transient crypto error causes all OAuth tokens to be stored unencrypted, with only a `console.error` as evidence. The same pattern exists in `decryptAccountTokens` (line 46-57), where decryption failure returns raw ciphertext, potentially exposing garbage data to downstream consumers.

**Recommended Fix:**
In production, throw on encryption failure rather than silently degrading. If silent degradation is intentional for backward compatibility, emit a metric/alert (not just a console log) and consider a circuit breaker that blocks writes if encryption repeatedly fails.

---

### 1.3 scryptSync Blocks the Event Loop on Every Encrypt/Decrypt

**Location:** `lib/encryption.ts:17-18`

**Severity:** Medium

**Description:**
`scryptSync` is a deliberately CPU-expensive key derivation function designed for password hashing. It is called synchronously on every `encrypt()` and `decrypt()` call. Since each call uses a fresh random salt (which is correct for security), the derived key cannot be cached.

On any request path that decrypts OAuth tokens (via `db-middleware.ts` Prisma middleware), this blocks the Node.js event loop for ~50-200ms per field. With 3 token fields per Account record, this can add 150-600ms of synchronous blocking per request.

**Recommended Fix:**
Replace `scryptSync` with HKDF (`crypto.hkdfSync` or `crypto.hkdf`), which is designed for deriving keys from already-high-entropy secrets (as opposed to passwords). HKDF is ~1000x faster and does not need to be intentionally slow since the input `ENCRYPTION_SECRET` is not a low-entropy password. If backward compatibility with existing ciphertext is needed, add a version flag (`enc:v2:`) and support both KDFs during migration.

---

### 1.4 Legacy Encrypted Data Detection Heuristic Can Misidentify Data

**Location:** `lib/encryption.ts:121-142` (`looksEncrypted` function)

**Severity:** Medium

**Description:**
The `looksEncrypted` function uses a heuristic for legacy (non-prefixed) encrypted data: it checks that the string is valid base64 and longer than salt+iv+authTag length. This heuristic can produce false positives on long base64 strings that happen to be the right length (e.g., long API tokens, base64-encoded images). A false positive causes `decrypt()` to be called on non-encrypted data, which will fail with a GCM auth tag error.

The function has mitigations (rejecting strings with dots, "http", or "ey" prefixes), but these are deny-list based and cannot cover all non-encrypted base64 strings.

**Recommended Fix:**
Set a deadline for migrating all legacy encrypted data to the `enc:v1:` prefix format, then remove the legacy heuristic entirely. Until then, log warnings when the legacy path is triggered so migration progress can be tracked.

---

### 1.5 No Encryption Key Rotation Support

**Location:** `lib/encryption.ts` (entire file)

**Severity:** Medium

**Description:**
The encryption module derives keys from a single `ENCRYPTION_SECRET` environment variable. There is no support for key versioning or rotation. If the secret is compromised and must be changed:

1. All previously encrypted data becomes undecryptable.
2. The `decryptAccountTokens` fallback (return raw value on failure) means old encrypted data will be silently returned as garbage strings rather than causing a clear error.
3. There is no mechanism to re-encrypt data under a new key.

A `scripts/rotate-tokens.ts` file exists but it duplicates the encryption logic rather than reusing the module, creating a maintenance divergence risk.

**Recommended Fix:**
Add a key version identifier to the ciphertext format (e.g., `enc:v1:keyid:...`). Support reading with any known key version, writing with the current key. Provide a migration script that re-encrypts all data under the new key.

---

## 2. Authentication & Session Management Sharp Edges

### 2.1 Middleware Cannot Check Session Revocation (Edge Runtime Limitation)

**Location:** `middleware.ts:129-137`

**Severity:** HIGH

**Description:**
The Next.js middleware runs in Edge Runtime, which cannot access Prisma (database). The middleware validates JWT tokens via `getToken()` but **cannot** check if the session has been revoked in the database. The comment on line 134-137 acknowledges this and states that API routes should use `getAuthToken()` for the authoritative check.

However, this creates a **defense-in-depth gap**: a revoked session's JWT is still accepted by middleware for protected page routes (lines 165-173). The user can access dashboard pages, settings, etc. with a revoked session until the JWT naturally expires (up to 7 days). Only API calls that use `getAuthToken()` will reject the revoked session.

This is a **configuration cliff**: the security guarantee of session revocation only works if every single API route handler independently remembers to call `getAuthToken()` instead of `getServerSession()`.

**Recommended Fix:**
Consider using a short-lived JWT (e.g., 15 minutes) with a refresh token pattern, so revocation takes effect much faster. Alternatively, use an Edge-compatible KV store (like Upstash Redis, which is already used for rate limiting) to check revocation in middleware.

---

### 2.2 Admin Check in JWT Relies on Database Query Per Request

**Location:** `lib/auth.ts:480-489` (JWT callback)

**Severity:** Low

**Description:**
The JWT callback re-checks `isAdmin` from the database on every token refresh. If the database query fails (line 487 catch block), `isAdmin` is silently set to `false`. This is a safe default (fail-closed), but it means a database outage temporarily strips all admins of their privileges with no alert.

Conversely, the `isAdmin` flag in the JWT is also checked in middleware (line 151), which does NOT re-query the database. The middleware trusts whatever `isAdmin` value is in the JWT token. If a user is granted admin status, they must re-authenticate to get a new JWT. If admin is revoked, the middleware will still honor the old JWT's `isAdmin=true` until the token is refreshed.

**Recommended Fix:**
Acceptable as-is for most threat models, but document the expected lag between admin role changes and enforcement. For high-security admin operations, add a real-time database check in the route handler (as `reset-listings/route.ts` already does).

---

### 2.3 Privy Client Initialization Fails Silently If Missing One Credential

**Location:** `lib/auth.ts:11-13`

**Severity:** Medium

**Description:**
```typescript
const privyClient = process.env.PRIVY_APP_ID && process.env.PRIVY_APP_SECRET
  ? new PrivyClient(process.env.PRIVY_APP_ID, process.env.PRIVY_APP_SECRET)
  : null;
```

If only `PRIVY_APP_ID` is set but `PRIVY_APP_SECRET` is missing (or vice versa), `privyClient` is `null`. The Privy authorize function (line 226-228) throws "Privy is not configured on the server", but this error message does not hint that only one of two required variables is set. An operator could spend time debugging the wrong thing.

Neither `PRIVY_APP_ID` nor `PRIVY_APP_SECRET` is checked in `lib/env-validation.ts`, so there is no startup warning about partial configuration.

**Recommended Fix:**
Add Privy credentials to `env-validation.ts` as conditionally required (if either is set, both must be set). Log a specific warning if exactly one is configured.

---

## 3. Authorization Sharp Edges

### 3.1 Agent Wallet Signature Auth Downgrades to No-Nonce If Header Missing

**Location:** `lib/agent-auth.ts:310-315`

**Severity:** Medium

**Description:**
```typescript
const nonce = request.headers.get("x-auth-nonce");
if (walletAddress && signature && timestamp) {
  return verifyWalletSignature(walletAddress, signature, timestamp, nonce || undefined);
}
```

The `x-auth-nonce` header is extracted and passed to `verifyWalletSignature`. Inside that function (line 201-203), a missing nonce is correctly rejected. However, the `authenticateAgent` function passes `nonce || undefined`, converting an empty string nonce header to `undefined`. If an attacker sends `x-auth-nonce: ""`, this converts to `undefined` inside the function, which is then rejected by the nonce-required check. This specific path is safe, but the `nonce || undefined` pattern is fragile -- if the inner function's behavior ever changes to treat `undefined` as "nonce not required", this would become a bypass.

**Recommended Fix:**
Pass the nonce value directly without the `|| undefined` coercion. Let the inner function handle empty/null/undefined consistently.

---

### 3.2 ADMIN_SECRET Not Validated at Startup in Non-Production

**Location:** `lib/env-validation.ts:55-58`

**Severity:** Medium

**Description:**
`ADMIN_SECRET` is only required when `NODE_ENV === "production"`. In staging or test environments that mirror production data, the admin endpoints (`/api/admin/*`) may be accessible without a secret if `ADMIN_SECRET` is not set. The middleware checks `token.isAdmin` (from JWT), which is a defense-in-depth layer, but the `validateAdminSecret` function in `reset-listings/route.ts` will return `false` if `ADMIN_SECRET` is undefined (safe default). However, the `.env.example` ships with `ADMIN_SECRET="your-admin-secret-change-in-production"`, which is 41 characters and passes the 32-character minimum check -- an operator might deploy to staging with this placeholder value.

**Recommended Fix:**
Add a check that `ADMIN_SECRET` does not contain common placeholder substrings like "change-in-production", "your-", or "xxx".

---

### 3.3 WEBHOOK_SECRET Not in Environment Validation or .env.example

**Location:** `app/api/webhooks/pool-graduation/route.ts:101`, `lib/env-validation.ts`

**Severity:** Medium

**Description:**
The pool graduation webhook endpoint requires `WEBHOOK_SECRET` for authentication, but this variable is not listed in `lib/env-validation.ts` and not documented in `.env.example`. If an operator deploys without setting it, the endpoint returns 401 for all requests (fail-closed, which is safe), but the operator has no startup warning about the missing configuration.

**Recommended Fix:**
Add `WEBHOOK_SECRET` to `env-validation.ts` as conditionally required (when pool graduation features are enabled) and document it in `.env.example`.

---

## 4. Input Validation Sharp Edges

### 4.1 File Extension Validation Uses Allow-by-Default for Unknown Extensions

**Location:** `lib/file-security.ts:61-91` (`validateFile` function)

**Severity:** Medium

**Description:**
The `validateFile` function checks against `BLOCKED_EXTENSIONS` and `WARNING_EXTENSIONS` lists, then defaults to `allowed: true` for anything not in either list. This means a file with an unusual but potentially dangerous extension (e.g., `.cgi`, `.asp`, `.aspx`, `.php5`, `.pl`, `.pyc`, `.wasm`) will be allowed through with no warning.

Additionally, the `getExtension` function only checks after the last dot, so a file named `malware.exe.txt` would be classified as `.txt` (safe).

**Recommended Fix:**
Invert the logic to deny-by-default: if an extension is not in `SAFE_EXTENSIONS`, deny it (or at minimum warn). This ensures new/unknown file types are not silently allowed.

---

### 4.2 Magic Byte Validation Skipped for Extensions Without Signatures

**Location:** `lib/file-security.ts:186-189`

**Severity:** Low

**Description:**
```typescript
if (!signatures) {
  return { valid: true, message: 'No magic byte signature defined for this file type' };
}
```

For extensions without defined magic bytes (like `.svg`, `.txt`, `.json`, `.html`), the validation always returns `valid: true`. An SVG file can contain embedded JavaScript. An HTML file can contain scripts. These are in the `SAFE_EXTENSIONS` list but could be weaponized.

**Recommended Fix:**
For SVG uploads specifically, sanitize the content (strip `<script>` tags and event handlers). For HTML uploads, consider blocking them or adding a warning.

---

### 4.3 URL Validation Treats Empty/Null as Valid

**Location:** `lib/validation.ts:95-103` (`isValidUrl`)

**Severity:** Low

**Description:**
```typescript
export function isValidUrl(url: string | null | undefined): boolean {
  if (!url) return true; // Empty URLs are valid (optional fields)
```

Returning `true` for null/undefined means this function cannot be used to validate required URL fields -- a caller would need to check for presence separately. This is documented behavior but creates a **stringly-typed security** issue: the return value `true` means both "URL is safe" and "no URL provided", which are semantically different.

**Recommended Fix:**
Return a result object `{ valid: boolean; reason: 'safe' | 'empty' | 'dangerous_protocol' }` to disambiguate the cases.

---

## 5. Configuration Cliffs

### 5.1 CSRF_SECRET Falls Back to NEXTAUTH_SECRET

**Location:** `lib/csrf.ts:18-24`

**Severity:** Medium

**Description:**
```typescript
function getCsrfSecret(): string {
  const secret = process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET;
```

If `CSRF_SECRET` is not set, the CSRF token HMAC uses `NEXTAUTH_SECRET`. This means a single compromised secret (`NEXTAUTH_SECRET`) would allow an attacker to both forge session JWTs AND forge CSRF tokens. The two secrets serve fundamentally different purposes and should be independent.

`CSRF_SECRET` is not listed in `env-validation.ts` or `.env.example`, so operators are unlikely to set it.

**Recommended Fix:**
Add `CSRF_SECRET` to `env-validation.ts` as required (at least in production). Document it in `.env.example`.

---

### 5.2 .env.example Ships Weak/Placeholder Secrets

**Location:** `.env.example:9,68,72`

**Severity:** Medium

**Description:**
```
NEXTAUTH_SECRET="your-super-secret-key-change-in-production"
ADMIN_SECRET="your-admin-secret-change-in-production"
CRON_SECRET="your-cron-secret-change-in-production"
```

These placeholder values are all longer than the 32-character minimum enforced by `env-validation.ts`, so they pass validation. An operator who copies `.env.example` to `.env` and forgets to change these values will have a "secure" deployment with publicly known secrets.

**Recommended Fix:**
Either leave these blank with a comment (forcing the operator to generate values), or set them to short strings like `CHANGEME` that will fail the minimum length check.

---

### 5.3 ENCRYPTION_SECRET Minimum Length Check Is Inconsistent

**Location:** `lib/encryption.ts:33` vs `lib/env-validation.ts:29`

**Severity:** Low

**Description:**
`lib/encryption.ts:33` checks `secret.length < 32` (32 characters minimum). The comment says "256-bit = 64 hex chars or 32 raw bytes". `lib/env-validation.ts:29` also requires `minLength: 32`. Both pass a 32-character ASCII string, but the comment suggests 64 hex characters for proper 256-bit entropy. A 32-character ASCII secret has ~192 bits of entropy (assuming printable ASCII), not the full 256 bits the comment implies.

**Recommended Fix:**
Either require 64 characters (hex encoding) and validate the hex format, or update the comment to reflect the actual entropy of a 32-character secret.

---

### 5.4 CSP Allows 'unsafe-inline' for Scripts

**Location:** `next.config.js:77`

**Severity:** Medium

**Description:**
```javascript
script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== 'production' ? " 'unsafe-eval'" : ""}
```

The Content Security Policy allows `'unsafe-inline'` for scripts in all environments, including production. This significantly weakens XSS protection, as any injected inline script will be allowed by CSP. The comment acknowledges this is needed "until Next.js nonce support is adopted."

**Recommended Fix:**
Migrate to nonce-based CSP. Next.js 13+ supports CSP nonces via the `nonce` prop on `<Script>` tags and the `headers()` function. This would allow removing `'unsafe-inline'` and significantly strengthening XSS protection.

---

## 6. Silent Failures

### 6.1 Fire-and-Forget API Key Usage Tracking

**Location:** `lib/agent-auth.ts:163-169`

**Severity:** Low

**Description:**
```typescript
prisma.apiKey.update({
  where: { id: matchedKey.id },
  data: { lastUsedAt: new Date(), totalRequests: { increment: 1 } },
}).catch(console.error);
```

The API key usage update is fire-and-forget. If the database update fails (e.g., connection timeout), the request count is lost. Over time, this can make `totalRequests` counts inaccurate, which could affect billing or abuse detection. More critically, `lastUsedAt` would be stale, potentially causing valid keys to appear unused and be garbage-collected.

**Recommended Fix:**
Acceptable for performance, but consider batching updates or using a counter in Redis that is periodically flushed to the database.

---

### 6.2 Webhook Dispatch Errors Are Fire-and-Forget

**Location:** `lib/webhooks.ts:97-98`

**Severity:** Low

**Description:**
```typescript
Promise.allSettled(deliveryPromises).catch(console.error);
```

Webhook delivery errors are caught by `Promise.allSettled` and then the overall promise chain errors are caught by `.catch(console.error)`. If the entire dispatch mechanism fails (e.g., database connection for creating delivery records), the error is only logged to console. No metric, alert, or retry is triggered for the outer failure.

**Recommended Fix:**
Add structured error logging with a severity level that triggers alerts in production.

---

### 6.3 Audit Logging Never Throws

**Location:** `lib/audit.ts:30-48`

**Severity:** Low

**Description:**
The `audit()` function catches all errors and logs them to console. This is intentional ("Audit logging should never break the main flow"), but it means a persistent database failure would silently disable all audit logging. Security-critical events (admin actions, session revocations) would occur with no audit trail.

**Recommended Fix:**
Add a health check that periodically verifies audit logging is working. Consider a fallback to structured console output that can be captured by log aggregation.

---

## 7. CSRF Protection Gaps

### 7.1 Inconsistent CSRF Enforcement Across State-Changing Endpoints

**Location:** Multiple API route files

**Severity:** HIGH

**Description:**
CSRF protection (`validateCsrfRequest`) is applied to some state-changing POST/PUT/DELETE endpoints but not all. Specifically:

**Protected endpoints (have CSRF checks):**
- `POST /api/listings` (create listing)
- `POST /api/bids` (place bid)
- `POST /api/offers` (create offer)
- `POST /api/transactions` (create transaction)
- `POST /api/messages` (send message)
- `POST /api/profile/upload-picture`
- `POST /api/reviews`
- And others (29 files total reference CSRF)

**Unprotected state-changing endpoints (NO CSRF checks):**
- `POST /api/transactions/[id]/confirm` (confirm transfer)
- `POST /api/transactions/[id]/buyer-info` (submit buyer info)
- `PUT /api/user/profile` (update profile)
- `POST /api/collaborators/[id]/respond` (accept/reject collaboration)
- `POST /api/purchase-partners/[id]` (partner operations)
- Various `/api/transfers/[id]/*` endpoints beyond those explicitly protected

The middleware comment (line 70-73) states that SameSite=Lax cookies and JSON Content-Type provide CSRF protection. While SameSite=Lax prevents most cross-site attacks, it does not protect against attacks from same-site subdomains or in browsers with SameSite bugs. The explicit CSRF token check provides defense-in-depth, but its inconsistent application means some endpoints have weaker protection than others.

**Recommended Fix:**
Either apply CSRF protection uniformly to all state-changing endpoints (use the `withCsrfProtection` HOF consistently), or document the explicit decision that SameSite=Lax is sufficient and remove per-endpoint CSRF checks to avoid confusion about which endpoints are protected.

---

## 8. File Security Sharp Edges

### 8.1 SVG Files Classified as Safe Despite XSS Risk

**Location:** `lib/file-security.ts:36`

**Severity:** Medium

**Description:**
`.svg` is listed in `SAFE_EXTENSIONS` and in the image file check (`isImageFile`). SVG files can contain embedded JavaScript, `<script>` tags, and event handlers (`onload`, `onerror`, etc.). If SVG files are served with a `Content-Type: image/svg+xml` header and displayed in a browser context, the embedded scripts can execute.

The magic bytes validation does not cover SVG (no signature defined), so `validateMagicBytes` returns `valid: true` for any SVG content.

**Recommended Fix:**
Either remove `.svg` from `SAFE_EXTENSIONS` and add it to `WARNING_EXTENSIONS`, or implement SVG sanitization that strips scripts and event handlers before storage.

---

## 9. Summary Table

| ID | Finding | Severity | Category |
|----|---------|----------|----------|
| 1.1 | Encryption AAD optional -- omission silently disables swap protection | HIGH | Crypto |
| 1.2 | Encryption failure silently stores plaintext tokens | HIGH | Crypto / Silent Failure |
| 1.3 | scryptSync blocks event loop on every encrypt/decrypt | Medium | Crypto / Performance |
| 1.4 | Legacy encrypted data heuristic can misidentify data | Medium | Crypto |
| 1.5 | No encryption key rotation support | Medium | Crypto |
| 2.1 | Middleware cannot check session revocation (Edge Runtime) | HIGH | Session Management |
| 2.2 | Admin JWT check stale between token refreshes | Low | Authorization |
| 2.3 | Privy partial configuration fails silently | Medium | Authentication |
| 3.1 | Agent nonce header coercion fragility | Medium | Authorization |
| 3.2 | ADMIN_SECRET not validated in non-production | Medium | Configuration |
| 3.3 | WEBHOOK_SECRET missing from env validation | Medium | Configuration |
| 4.1 | File validation allow-by-default for unknown extensions | Medium | Input Validation |
| 4.2 | Magic byte validation skipped for extensions without signatures | Low | Input Validation |
| 4.3 | URL validation returns true for null (ambiguous semantics) | Low | Input Validation |
| 5.1 | CSRF_SECRET falls back to NEXTAUTH_SECRET | Medium | Configuration Cliff |
| 5.2 | .env.example ships weak placeholder secrets that pass validation | Medium | Configuration Cliff |
| 5.3 | ENCRYPTION_SECRET length check inconsistent with comment | Low | Configuration |
| 5.4 | CSP allows unsafe-inline for scripts in production | Medium | Configuration |
| 6.1 | Fire-and-forget API key usage tracking | Low | Silent Failure |
| 6.2 | Webhook dispatch errors silently swallowed | Low | Silent Failure |
| 6.3 | Audit logging never throws, can silently fail | Low | Silent Failure |
| 7.1 | Inconsistent CSRF enforcement across endpoints | HIGH | CSRF |
| 8.1 | SVG files classified as safe despite XSS risk | Medium | File Security |

---

## Positive Security Observations

The following patterns were well-implemented and demonstrate good security engineering:

1. **Timing-safe comparisons** are consistently used across all secret/token comparisons with proper buffer padding to prevent length-leaking.
2. **Fail-closed in production** for nonce checking and rate limiting -- refuses to fall back to in-memory stores in production.
3. **Privy auth uses server-verified claims**, never trusting client-supplied wallet/email for account linking.
4. **AES-256-GCM with random IV and salt** per encryption -- no IV reuse risk.
5. **bcrypt for API key hashing** with cost factor 12.
6. **Nonce replay protection** using atomic Redis SET NX.
7. **Database-backed session revocation** with cleanup of expired records.
8. **Admin endpoints require both secret AND session with isAdmin check** (defense-in-depth).
9. **Security headers** are comprehensive (HSTS, CSP, X-Frame-Options DENY, Permissions-Policy).
10. **Integer arithmetic (bigint/lamports)** for financial calculations to avoid floating-point errors.

---

*Report generated by Sharp Edges security analysis methodology.*
