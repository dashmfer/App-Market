# Security Audit Report: CSRF Protection, Rate Limiting, Middleware & Transport Security

**Audit Date:** 2026-02-10
**Scope:** CSRF protection, CORS configuration, rate limiting, security headers, cookie security, file uploads, middleware ordering, HTTPS enforcement, request size limits, and logging gaps
**Codebase:** App-Market (Next.js 14 + Prisma + Solana)

---

## Summary Table

| # | Finding | Severity | File(s) | Status |
|---|---------|----------|---------|--------|
| 1 | CSRF protection missing on multiple state-changing endpoints | **HIGH** | Multiple API routes | Open |
| 2 | Rate limiting missing on critical financial endpoints | **HIGH** | `transfers/complete`, `withdrawals/claim`, `offers/accept`, others | Open |
| 3 | CSP allows `unsafe-inline` for scripts | **MEDIUM** | `next.config.js:77` | Open |
| 4 | In-memory rate limiting fallback not blocked in production | **HIGH** | `lib/rate-limit.ts:126-133` | Open |
| 5 | No explicit CORS policy defined (relies on Next.js defaults) | **MEDIUM** | `middleware.ts`, `next.config.js` | Open |
| 6 | HSTS missing `preload` directive | **LOW** | `next.config.js:64` | Open |
| 7 | CSRF cookie `httpOnly: false` by design (double-submit pattern) | **INFO** | `lib/csrf.ts:116` | Accepted |
| 8 | File upload endpoints missing rate limiting | **MEDIUM** | `profile/upload-picture/route.ts`, `user/profile/image/route.ts` | Open |
| 9 | No request body size limit for API routes (only server actions) | **MEDIUM** | `next.config.js:29-31` | Open |
| 10 | Profile update endpoint missing CSRF validation | **MEDIUM** | `app/api/profile/route.ts:82` | Open |
| 11 | Transaction confirm endpoint missing both CSRF and rate limiting | **HIGH** | `app/api/transactions/[id]/confirm/route.ts` | Open |
| 12 | Listing reserve/unreserve missing CSRF and rate limiting | **MEDIUM** | `app/api/listings/[slug]/reserve/route.ts` | Open |
| 13 | Watchlist POST/DELETE missing CSRF and rate limiting | **LOW** | `app/api/watchlist/route.ts` | Open |
| 14 | Audit logging not applied to most endpoints | **MEDIUM** | Multiple API routes | Open |
| 15 | Dispute creation missing CSRF validation | **MEDIUM** | `app/api/disputes/route.ts:69` | Open |
| 16 | Messages endpoint missing CSRF validation | **MEDIUM** | `app/api/messages/route.ts:84` | Open |
| 17 | User/profile image upload endpoint missing magic byte validation | **LOW** | `app/api/user/profile/image/route.ts` | Open |
| 18 | Middleware does not check session revocation in Edge Runtime | **LOW** | `middleware.ts:140-143` | Documented |
| 19 | Purchase endpoint missing CSRF validation | **MEDIUM** | `app/api/purchases/route.ts:10` | Open |
| 20 | Listing update (PUT) missing CSRF validation | **MEDIUM** | `app/api/listings/[slug]/route.ts:143` | Open |

---

## Detailed Findings

### Finding 1: CSRF Protection Missing on Multiple State-Changing Endpoints

**Severity:** HIGH
**Category:** CSRF Protection

**Description:**
The codebase implements a well-designed double-submit cookie CSRF pattern (in `lib/csrf.ts`) using HMAC-signed tokens with timing-safe comparison. However, this protection is only applied to 4 endpoints:

- `POST /api/listings` (creating listings)
- `POST /api/transactions` (creating transactions)
- `POST /api/offers` (creating offers)
- `POST /api/bids` (placing bids)

The following state-changing endpoints **lack** CSRF validation:

| Endpoint | Method | Risk |
|----------|--------|------|
| `/api/profile` | PUT | Profile tampering |
| `/api/profile/upload-picture` | POST, DELETE | Image replacement |
| `/api/purchases` | POST | Unauthorized purchase |
| `/api/disputes` | POST | Fraudulent dispute creation |
| `/api/messages` | POST | Message spoofing |
| `/api/transactions/[id]/confirm` | POST | Premature confirmation of asset transfer |
| `/api/transfers/[id]/complete` | POST | Premature fund release |
| `/api/listings/[slug]/reserve` | POST, DELETE | Listing state manipulation |
| `/api/offers/[offerId]/accept` | POST | Accepting offers without consent |
| `/api/offers/[offerId]/cancel` | POST | Canceling offers |
| `/api/watchlist` | POST, DELETE | Watchlist modification |
| `/api/withdrawals/[id]/claim` | POST | Claiming withdrawals |
| `/api/reviews` | POST | Fake reviews |
| `/api/collaborators/[id]/respond` | POST | Unauthorized collaboration responses |
| `/api/listings/[slug]/nda` | POST | NDA signing |
| `/api/transfers/[id]/sign-apa` | POST | Agreement signing |

**Files:**
- `/home/user/App-Market/lib/csrf.ts` (implementation)
- All listed API routes above

**Recommended Fix:**
Apply `validateCsrfRequest()` or `withCsrfProtection()` to all POST/PUT/DELETE API route handlers that perform state-changing operations. The infrastructure already exists; it just needs to be applied consistently. Consider adding CSRF validation at the middleware level for all non-GET, non-HEAD methods on `/api/*` routes (excluding `/api/auth/*`, `/api/cron/*`, `/api/agent/*`, and `/api/webhooks/*`).

---

### Finding 2: Rate Limiting Missing on Critical Financial Endpoints

**Severity:** HIGH
**Category:** Rate Limiting

**Description:**
The codebase has a robust rate limiting system using Upstash Redis (`lib/rate-limit.ts`) with well-configured presets (auth: 5/min, write: 10/min, search: 30/min, read: 100/min). However, several critical financial endpoints have no rate limiting:

| Endpoint | Method | Risk |
|----------|--------|------|
| `/api/transfers/[id]/complete` | POST | Escrow release / fund disbursement |
| `/api/withdrawals/[id]/claim` | POST | SOL withdrawal |
| `/api/offers/[offerId]/accept` | POST | Offer acceptance (triggers transaction creation) |
| `/api/offers/[offerId]/cancel` | POST | Offer cancellation |
| `/api/transactions/[id]/confirm` | POST | Transfer confirmation (can trigger fund release) |
| `/api/listings/[slug]/reserve` | POST | Listing reservation |
| `/api/profile` | PUT | Profile update |
| `/api/profile/upload-picture` | POST | File upload (DoS vector) |
| `/api/user/profile/image` | POST | File upload (DoS vector) |
| `/api/collaborators/[id]/respond` | POST | Collaboration responses |
| `/api/transactions/[id]/uploads` | POST | Asset uploads |
| `/api/transactions/[id]/buyer-info` | POST | Buyer info submission |

**Files:**
- `/home/user/App-Market/app/api/transfers/[id]/complete/route.ts`
- `/home/user/App-Market/app/api/withdrawals/[withdrawalId]/claim/route.ts`
- `/home/user/App-Market/app/api/offers/[offerId]/accept/route.ts`
- `/home/user/App-Market/app/api/transactions/[id]/confirm/route.ts`
- `/home/user/App-Market/app/api/profile/upload-picture/route.ts`
- All other listed routes

**Recommended Fix:**
Add `withRateLimitAsync('write', '<endpoint-name>')` to all state-changing endpoints. For financial endpoints (transfers, withdrawals, offer acceptance), consider a stricter custom limit (e.g., 3 requests/minute) rather than the standard `write` preset of 10/minute.

---

### Finding 3: Content Security Policy Allows `unsafe-inline` for Scripts

**Severity:** MEDIUM
**Category:** Security Headers

**Description:**
The CSP header in `next.config.js` includes `script-src 'self' 'unsafe-inline'`. While this is a common necessity with Next.js (which injects inline scripts for hydration), it weakens XSS protection because an attacker who can inject HTML could also inject inline `<script>` tags.

**File:** `/home/user/App-Market/next.config.js`, line 77

```javascript
"script-src 'self' 'unsafe-inline'",
```

**Recommended Fix:**
Investigate using `'unsafe-inline'` only as a fallback with `'strict-dynamic'` and nonce-based CSP. Next.js 14+ supports nonce-based CSP via the `nonce` prop. If migrating to nonces is not feasible, the current configuration is an acceptable trade-off but should be documented. Additionally, `unsafe-eval` is correctly excluded -- keep it that way.

---

### Finding 4: In-Memory Rate Limiting Fallback Not Blocked in Production

**Severity:** HIGH
**Category:** Rate Limiting

**Description:**
When Upstash Redis is not configured (`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are missing), the rate limiter falls back to an in-memory store. In production, on a serverless platform like Vercel, each function invocation has its own memory space, making in-memory rate limiting completely ineffective -- each request would get its own fresh counter.

The code logs a `CRITICAL` warning (`lib/rate-limit.ts:126-128`) but **does not refuse service or fail closed**. Requests continue to be processed without effective rate limiting.

**File:** `/home/user/App-Market/lib/rate-limit.ts`, lines 126-133

```typescript
if (process.env.NODE_ENV === "production") {
    console.error(
      "CRITICAL: Rate limiting falling back to in-memory in production! Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN."
    );
}
```

**Recommended Fix:**
In production, when Upstash is not configured, the rate limiter should either:
1. **Fail closed:** Return `isLimited: true` for all requests (deny by default), or
2. **Throw an error** at startup to prevent deployment without proper configuration.

A startup-time check that throws if `NODE_ENV === 'production'` and Upstash is not configured would be the most robust approach.

---

### Finding 5: No Explicit CORS Policy Defined

**Severity:** MEDIUM
**Category:** CORS Configuration

**Description:**
The codebase does not define an explicit CORS policy. There are no `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, or `Access-Control-Allow-Credentials` headers set in `next.config.js`, the middleware, or individual API routes.

Next.js API routes by default do not include CORS headers, which means cross-origin fetch requests from other domains will be blocked by browsers. This is a secure default. However, the `/api/agent/*` endpoints are designed for third-party integrations (AI agents, bots) and use API key authentication rather than cookies. These endpoints may need explicit CORS headers to function for external clients.

Additionally, the OpenAPI spec route explicitly notes (line 700): `// SECURITY: No Access-Control-Allow-Origin header - OpenAPI spec is same-origin only`.

**Files:**
- `/home/user/App-Market/middleware.ts`
- `/home/user/App-Market/next.config.js`
- `/home/user/App-Market/app/api/openapi/route.ts`

**Recommended Fix:**
1. Document the CORS strategy explicitly (the current implicit "no CORS" approach is secure for browser clients).
2. For `/api/agent/*` endpoints: If these need to be called from external origins (e.g., browser-based agent UIs), add explicit CORS headers with an allowlist of trusted origins. Do NOT use wildcard `*` with credentialed requests.
3. Consider adding a preflight handler for agent API routes if needed.

---

### Finding 6: HSTS Missing `preload` Directive

**Severity:** LOW
**Category:** Transport Security

**Description:**
The `Strict-Transport-Security` header is configured with a good `max-age` of 1 year and `includeSubDomains`, but is missing the `preload` directive.

**File:** `/home/user/App-Market/next.config.js`, line 64

```javascript
value: 'max-age=31536000; includeSubDomains',
```

**Recommended Fix:**
Add `; preload` to the HSTS header value and submit the domain to the HSTS preload list (https://hstspreload.org/):

```javascript
value: 'max-age=31536000; includeSubDomains; preload',
```

---

### Finding 7: CSRF Cookie `httpOnly: false` (By Design)

**Severity:** INFO (Accepted Risk)
**Category:** Cookie Security

**Description:**
The CSRF token cookie (`__Host-csrf-token`) has `httpOnly: false`. This is **intentional and correct** for the double-submit cookie pattern, which requires JavaScript to read the cookie value and send it as a header. The `__Host-` prefix provides additional protection by ensuring the cookie is only set on the host domain over HTTPS with `path=/`.

**File:** `/home/user/App-Market/lib/csrf.ts`, line 116

```typescript
response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Must be readable by JavaScript for double-submit
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 24 * 60 * 60, // 24 hours
});
```

**Assessment:** The implementation is correct. The session token cookie (`__Secure-next-auth.session-token`) correctly uses `httpOnly: true`, which is the critical cookie to protect. The CSRF cookie's `SameSite: strict` provides additional protection.

---

### Finding 8: File Upload Endpoints Missing Rate Limiting

**Severity:** MEDIUM
**Category:** Rate Limiting / DoS Protection

**Description:**
Both profile picture upload endpoints accept file uploads (up to 5MB each) but have no rate limiting applied. An attacker could abuse these endpoints to:
- Consume Vercel Blob storage quota
- Generate excessive bandwidth costs
- Cause denial-of-service through resource exhaustion

Both endpoints do have proper file validation (MIME type checking, magic byte validation in one endpoint, 5MB size limit).

**Files:**
- `/home/user/App-Market/app/api/profile/upload-picture/route.ts` (has magic byte validation)
- `/home/user/App-Market/app/api/user/profile/image/route.ts` (relies on extension-based validation via `file-security.ts`)

**Recommended Fix:**
Add rate limiting with a strict preset to both upload endpoints:
```typescript
const rateLimitResult = await (withRateLimitAsync('auth', 'profile-upload'))(request);
```
The `auth` preset (5/min) would be appropriate for upload endpoints.

---

### Finding 9: No Request Body Size Limit for API Routes

**Severity:** MEDIUM
**Category:** Request Size Limits

**Description:**
The `next.config.js` only configures a body size limit for server actions:

```javascript
experimental: {
    serverActions: {
        bodySizeLimit: '2mb',
    },
},
```

Standard API routes (`app/api/**`) do not have an explicit body size limit configured. Next.js has a default limit (typically 1MB for JSON), but this is not explicitly enforced and may vary by deployment platform. Large payloads sent to API routes could potentially cause memory issues.

**File:** `/home/user/App-Market/next.config.js`, lines 28-32

**Recommended Fix:**
1. Set explicit `bodyParser.sizeLimit` in route segment configs for JSON-accepting endpoints
2. For Vercel deployments, configure function-level limits in `vercel.json`
3. Add explicit `Content-Length` checks in routes that accept large payloads (e.g., `/api/transactions/[id]/uploads`)

---

### Finding 10: Profile Update Endpoint Missing CSRF Validation

**Severity:** MEDIUM
**Category:** CSRF Protection

**Description:**
The `PUT /api/profile` endpoint allows updating the user's display name, username, bio, website URL, and Discord handle without CSRF validation. An attacker could craft a malicious page that submits a cross-origin request to change a user's profile data.

**File:** `/home/user/App-Market/app/api/profile/route.ts`, line 82

**Recommended Fix:**
Add CSRF validation at the start of the PUT handler:
```typescript
const csrfValidation = validateCsrfRequest(req);
if (!csrfValidation.valid) {
    return csrfError(csrfValidation.error || "CSRF validation failed");
}
```

---

### Finding 11: Transaction Confirm Endpoint Missing Both CSRF and Rate Limiting

**Severity:** HIGH
**Category:** CSRF Protection / Rate Limiting

**Description:**
`POST /api/transactions/[id]/confirm` is a critical endpoint that confirms asset transfer and, when all checklist items are confirmed, **triggers automatic escrow release and fund disbursement**. This endpoint has neither CSRF protection nor rate limiting.

An attacker could craft a malicious page that:
1. Submits confirmations for transfer checklist items on behalf of the victim
2. Once all items are confirmed, triggers automatic completion and fund release

The impact is direct financial loss.

**File:** `/home/user/App-Market/app/api/transactions/[id]/confirm/route.ts`

**Recommended Fix:**
Add both CSRF validation and rate limiting:
```typescript
const csrfValidation = validateCsrfRequest(request);
if (!csrfValidation.valid) {
    return csrfError(csrfValidation.error || "CSRF validation failed");
}
const rateLimitResult = await (withRateLimitAsync('write', 'transaction-confirm'))(request);
```

---

### Finding 12: Listing Reserve/Unreserve Missing CSRF and Rate Limiting

**Severity:** MEDIUM
**Category:** CSRF Protection / Rate Limiting

**Description:**
The `POST /api/listings/[slug]/reserve` and `DELETE /api/listings/[slug]/reserve` endpoints allow sellers to reserve listings for specific wallet addresses or remove reservations. Neither has CSRF validation or rate limiting. A CSRF attack could cause a seller to inadvertently reserve their listing for an attacker's wallet or remove an existing reservation.

**File:** `/home/user/App-Market/app/api/listings/[slug]/reserve/route.ts`

**Recommended Fix:**
Add CSRF validation and rate limiting to both POST and DELETE handlers.

---

### Finding 13: Watchlist POST/DELETE Missing CSRF and Rate Limiting

**Severity:** LOW
**Category:** CSRF Protection / Rate Limiting

**Description:**
The watchlist endpoints (`POST /api/watchlist` and `DELETE /api/watchlist`) have no CSRF validation or rate limiting. The impact is low since watchlist manipulation does not cause financial harm, but a CSRF attack could be used to manipulate a user's tracked listings.

**File:** `/home/user/App-Market/app/api/watchlist/route.ts`

**Recommended Fix:**
Add CSRF validation and rate limiting for completeness.

---

### Finding 14: Audit Logging Not Applied to Most Endpoints

**Severity:** MEDIUM
**Category:** Logging and Monitoring

**Description:**
The audit logging infrastructure (`lib/audit.ts`) is well-designed with proper action types, severity levels, and a fire-and-forget pattern that does not block the request flow. However, it is only used in a small number of endpoints:

**Endpoints WITH audit logging:**
- `POST /api/transfers/[id]/complete` (TRANSACTION_COMPLETED)
- `POST /api/withdrawals/[id]/claim` (WITHDRAWAL_CLAIMED)
- `POST /api/bids` (via audit call)
- `POST /api/purchases` (via audit call)
- `POST /api/collaborators/[id]/respond`
- `POST /api/cron/expire-withdrawals`
- Admin routes

**Endpoints MISSING audit logging (should have it):**
- `POST /api/transactions` (transaction creation)
- `POST /api/offers` (offer creation)
- `POST /api/offers/[offerId]/accept` (offer acceptance -- high value)
- `POST /api/disputes` (dispute creation)
- `POST /api/transactions/[id]/confirm` (transfer confirmation)
- `PUT /api/profile` (profile changes)
- `POST /api/listings` (listing creation)
- `PUT /api/listings/[slug]` (listing updates)
- `POST /api/auth/register` (user registration)
- `POST /api/auth/wallet/verify` (wallet verification)
- All file upload endpoints

**File:** `/home/user/App-Market/lib/audit.ts`

**Recommended Fix:**
Add audit logging to all state-changing operations, especially:
1. Financial operations (offer acceptance, transaction creation/confirmation)
2. Authentication events (registration, login, failed login attempts)
3. Listing lifecycle events (creation, update, cancellation)
4. Profile modifications

---

### Finding 15: Dispute Creation Missing CSRF Validation

**Severity:** MEDIUM
**Category:** CSRF Protection

**Description:**
`POST /api/disputes` creates a dispute, which locks the transaction into `DISPUTED` status and prevents normal fund release. Creating a fraudulent dispute via CSRF could lock a legitimate transaction and force the parties into an arbitration process, potentially holding funds hostage. The endpoint has rate limiting but no CSRF validation.

**File:** `/home/user/App-Market/app/api/disputes/route.ts`, line 69

**Recommended Fix:**
Add CSRF validation before rate limiting:
```typescript
const csrfValidation = validateCsrfRequest(request);
if (!csrfValidation.valid) {
    return csrfError(csrfValidation.error || "CSRF validation failed");
}
```

---

### Finding 16: Messages Endpoint Missing CSRF Validation

**Severity:** MEDIUM
**Category:** CSRF Protection

**Description:**
`POST /api/messages` sends messages on behalf of the authenticated user without CSRF validation. A CSRF attack could be used for social engineering by sending messages appearing to come from a legitimate user. The endpoint has rate limiting (10/min via `write` preset).

**File:** `/home/user/App-Market/app/api/messages/route.ts`, line 84

**Recommended Fix:**
Add CSRF validation to the POST handler.

---

### Finding 17: User Profile Image Upload Missing Magic Byte Validation

**Severity:** LOW
**Category:** File Upload Security

**Description:**
There are two profile picture upload endpoints:
- `/api/profile/upload-picture/route.ts` -- Has comprehensive validation: MIME type, 5MB size limit, AND magic byte validation
- `/api/user/profile/image/route.ts` -- Has MIME type and extension validation via `file-security.ts`, but does NOT validate magic bytes

Without magic byte validation, a user could potentially upload a file with a valid image extension but malicious content (though the MIME type check provides some protection, MIME types are client-provided and can be spoofed).

**Files:**
- `/home/user/App-Market/app/api/profile/upload-picture/route.ts` (lines 50-63, has magic bytes)
- `/home/user/App-Market/app/api/user/profile/image/route.ts` (no magic bytes)

**Recommended Fix:**
Add magic byte validation to `/api/user/profile/image/route.ts` using the existing `validateMagicBytes()` or `validateFileComprehensive()` from `lib/file-security.ts`.

---

### Finding 18: Middleware Does Not Check Session Revocation

**Severity:** LOW (Documented/Mitigated)
**Category:** Middleware

**Description:**
The middleware uses `getToken()` from `next-auth/jwt` which only validates the JWT signature but does not check if the session has been revoked (because Prisma/database access is not available in Edge Runtime). This is documented in a code comment (line 140-143).

The API routes use `getAuthToken()` from `lib/auth.ts`, which **does** check session revocation via a database lookup. This means the middleware may allow a request through for a revoked session, but the actual API handler will correctly reject it.

**File:** `/home/user/App-Market/middleware.ts`, lines 134-143

**Assessment:** This is a defense-in-depth limitation, not a vulnerability. The middleware provides an initial fast check, and the API handlers provide the authoritative check. The gap only affects the small window between middleware and route handler execution.

---

### Finding 19: Purchase Endpoint Missing CSRF Validation

**Severity:** MEDIUM
**Category:** CSRF Protection

**Description:**
`POST /api/purchases` creates a purchase (Buy Now) and initiates a financial transaction. It has rate limiting but no CSRF validation. A CSRF attack could potentially trigger a purchase on behalf of a user.

**File:** `/home/user/App-Market/app/api/purchases/route.ts`, line 10

**Recommended Fix:**
Add CSRF validation before the rate limiting check.

---

### Finding 20: Listing Update Missing CSRF Validation

**Severity:** MEDIUM
**Category:** CSRF Protection

**Description:**
`PUT /api/listings/[slug]` updates listing details (title, description, price, etc.) without CSRF validation. An attacker could modify a user's listing via CSRF, potentially changing the price to a very low amount before a purchase. The endpoint has rate limiting.

**File:** `/home/user/App-Market/app/api/listings/[slug]/route.ts`, line 143

**Recommended Fix:**
Add CSRF validation to the PUT handler.

---

## Positive Security Findings

The following security measures are well-implemented:

### Session Security
- **JWT with session revocation support** (`lib/auth.ts`): Sessions use database-backed revocation lists, enabling immediate session invalidation even with stateless JWTs.
- **7-day session max age** (line 414): Shorter than the default 30 days.
- **Session token cookie uses `__Secure-` prefix** in production (line 418-419).
- **Session cookie flags:** `httpOnly: true`, `sameSite: "lax"`, `secure: true` in production.

### CSRF Token Implementation
- **HMAC-signed tokens** with timing-safe comparison (`lib/csrf.ts`).
- **Token expiry** (24 hours) prevents reuse of stale tokens.
- **`__Host-` cookie prefix** for the CSRF cookie enforces HTTPS and path restrictions.
- **`SameSite: strict`** on the CSRF cookie.

### Security Headers
- **X-Frame-Options: SAMEORIGIN** -- Prevents clickjacking.
- **X-Content-Type-Options: nosniff** -- Prevents MIME sniffing.
- **Referrer-Policy: strict-origin-when-cross-origin** -- Good balance.
- **Permissions-Policy** -- Disables camera, microphone, geolocation, and FLoC.
- **X-Permitted-Cross-Domain-Policies: none** -- Prevents Flash/Acrobat cross-domain access.
- **CSP form-action 'self'** -- Prevents form submission to external domains.
- **CSP object-src 'none'** -- Blocks plugins.
- **upgrade-insecure-requests** in CSP.

### Cron Route Protection
- **Constant-time comparison** of `CRON_SECRET` using `timingSafeEqual` (`middleware.ts:109-121`).

### Admin Route Protection
- **Double-layer protection:** Middleware checks `isAdmin` JWT claim AND individual admin routes check `ADMIN_SECRET` with timing-safe comparison.

### Rate Limiting Implementation
- **Upstash Redis-backed** sliding window rate limiting with proper presets.
- **Client IP extraction** uses the rightmost IP from `x-forwarded-for` to prevent spoofing (`lib/rate-limit.ts:220-226`).
- **Rate limit headers** (`X-RateLimit-*`) returned to clients.

### File Upload Security
- **Magic byte validation** on `/api/profile/upload-picture` prevents extension spoofing.
- **5MB size limit** on all upload endpoints.
- **Blocked extension list** in `lib/file-security.ts` covers executables, scripts, and macro-enabled documents.
- **Comprehensive `validateFileComprehensive()`** function available for full validation.

### Wallet Authentication
- **Signature message replay protection** with 5-minute timestamp validity.
- **Privy token server-side verification** for third-party auth.
- **User ID mismatch check** prevents token reuse across accounts.

### Twitter OAuth
- **PKCE (S256)** for OAuth 2.0 flow.
- **Encrypted OAuth state cookie** using AES-256-GCM (`lib/encryption.ts`).
- **10-minute cookie expiry** for the OAuth flow.

---

## Risk Matrix

| Severity | Count | Recommendation |
|----------|-------|----------------|
| CRITICAL | 0 | -- |
| HIGH | 3 | Fix before next deployment |
| MEDIUM | 10 | Fix within next sprint |
| LOW | 4 | Fix when convenient |
| INFO | 1 | No action required |

---

## Priority Remediation Plan

### Immediate (Before Next Deployment)

1. **Add CSRF validation to `POST /api/transactions/[id]/confirm`** (Finding 11) -- This endpoint can trigger automatic fund release.
2. **Add rate limiting to `POST /api/transfers/[id]/complete` and `POST /api/withdrawals/[id]/claim`** (Finding 2) -- These are direct financial operations.
3. **Block in-memory rate limiting fallback in production** (Finding 4) -- Either fail closed or throw at startup.

### Short-Term (Next Sprint)

4. **Add CSRF validation to all remaining state-changing endpoints** (Findings 1, 10, 15, 16, 19, 20) -- Use the existing `withCsrfProtection()` HOF or add `validateCsrfRequest()` calls.
5. **Add rate limiting to file upload endpoints** (Finding 8).
6. **Add magic byte validation to `/api/user/profile/image`** (Finding 17).
7. **Expand audit logging coverage** (Finding 14).

### Medium-Term

8. **Evaluate nonce-based CSP** to remove `unsafe-inline` (Finding 3).
9. **Add HSTS preload** (Finding 6).
10. **Document and formalize CORS policy** (Finding 5).
11. **Configure explicit request body size limits** for all API routes (Finding 9).

---

## Methodology

This audit was conducted through static analysis of the source code, examining:
- All files in `app/api/` for endpoint-level security controls
- `middleware.ts` for request-level protections
- `next.config.js` for framework-level security configuration
- `lib/csrf.ts`, `lib/rate-limit.ts`, `lib/auth.ts`, `lib/audit.ts`, `lib/file-security.ts` for security utility implementations
- `package.json` for dependency versions and security-relevant packages
- `vercel.json` for deployment configuration
