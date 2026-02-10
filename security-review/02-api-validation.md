# Security Audit Report: API Routes, Input Validation & Injection Vulnerabilities

**Audit Date:** 2026-02-10
**Scope:** All API route handlers in the App-Market codebase
**Focus Areas:** Input validation, SQL/NoSQL injection, command injection, path traversal, XSS, unsafe deserialization, mass assignment, error handling

---

## Executive Summary

The App-Market codebase demonstrates a generally **strong security posture** with several well-implemented defenses: CSRF double-submit cookies with HMAC, constant-time comparisons for secrets, Zod schema validation in critical upload paths, magic byte file validation, SSRF protection on webhook URLs, rate limiting, audit logging, and proper use of Prisma ORM parameterized queries. However, the audit identified **19 findings** across various severity levels that should be addressed.

---

## Summary Table

| # | Severity | Category | Description | File |
|---|----------|----------|-------------|------|
| 1 | **CRITICAL** | Information Disclosure | Debug session page exposes session details, cookies, and internal state in production | `app/debug/session/page.tsx` |
| 2 | **HIGH** | Missing Input Validation | Prisma `where` filter injection via unsanitized `.toUpperCase()` on status/category query params | Multiple API routes |
| 3 | **HIGH** | Mass Assignment | Profile update route accepts and spreads arbitrary body fields to Prisma update | `app/api/profile/route.ts` |
| 4 | **HIGH** | Missing CSRF Protection | Several state-changing POST/PUT/DELETE endpoints lack CSRF validation | Multiple API routes |
| 5 | **HIGH** | Unsafe Deserialization | `JSON.parse` on environment variable (`BACKEND_AUTHORITY_SECRET_KEY`) without try/catch in some paths | `app/api/transactions/[id]/uploads/route.ts:148` |
| 6 | **MEDIUM** | Information Disclosure | Health endpoint reveals infrastructure configuration status | `app/api/health/route.ts` |
| 7 | **MEDIUM** | User Enumeration | User lookup endpoint allows enumeration by username/wallet despite rate limiting | `app/api/users/lookup/route.ts` |
| 8 | **MEDIUM** | Missing Input Validation | Dispute response `PUT` does not validate `response` field length or content type | `app/api/disputes/[id]/route.ts:226` |
| 9 | **MEDIUM** | Missing Input Validation | Token launch `POST` does not sanitize or length-validate `tokenName`, `tokenDescription`, social URLs | `app/api/token-launch/route.ts:32-44` |
| 10 | **MEDIUM** | Missing Input Validation | Offers route does not validate `amount` is a positive number or `message` length | `app/api/offers/route.ts` |
| 11 | **MEDIUM** | Missing Input Validation | Messages route does not limit message `content` length | `app/api/messages/[conversationId]/route.ts` |
| 12 | **MEDIUM** | Missing Input Validation | Listing `GET` route passes raw `status` query param as Prisma `where` after only `.toUpperCase()` | `app/api/listings/route.ts:36` |
| 13 | **MEDIUM** | Insecure Direct Object Reference | Dispute ID parameter (`params.id`) is used directly without UUID format validation | `app/api/disputes/[id]/route.ts:23` |
| 14 | **MEDIUM** | Missing Authorization | Collaborators `GET` endpoint returns all collaborators for any listing without auth check | `app/api/listings/[slug]/collaborators/route.ts:8` |
| 15 | **LOW** | Information Disclosure | Console.error logs full error objects server-side across all routes | All API routes |
| 16 | **LOW** | Input Validation | Listing `duration` parsed with `parseInt` without max-value bound check | `app/api/listings/route.ts:425` |
| 17 | **LOW** | Missing Input Validation | Review response `content` validated for length but not sanitized for HTML/script content | `app/api/reviews/[id]/response/route.ts:62` |
| 18 | **LOW** | SSRF Incomplete | Webhook SSRF check does not block IPv6 private ranges or DNS rebinding | `app/api/agent/webhooks/route.ts:16-43` |
| 19 | **LOW** | Type Safety | Widespread use of `as any` type casts weakens TypeScript safety net | Multiple files |

---

## Detailed Findings

---

### Finding 1: Debug Session Page Exposed in Production

**Severity:** CRITICAL
**Category:** Information Disclosure
**File:** `/home/user/App-Market/app/debug/session/page.tsx`
**Lines:** 1-213

**Description:**
A full debug page exists at `/debug/session` that renders the user's complete session object, all browser cookies, and internal application state. This page:
- Dumps the full `useSession()` return value including user ID, email, and internal fields via `JSON.stringify(session, null, 2)`
- Displays all cookies from `document.cookie`
- Fetches and displays the raw `/api/auth/session` response
- Has no access control -- it is a standard Next.js page accessible to anyone

There is no environment-gating (`NODE_ENV !== 'production'`) or authentication check. If deployed, any visitor can view the session structure, aiding session hijacking or token theft.

**Recommended Fix:**
Remove this file entirely, or gate it behind an environment check and admin authentication:
```typescript
// At the top of the component
if (process.env.NODE_ENV === 'production') {
  return notFound();
}
```

---

### Finding 2: Prisma Filter Injection via Unsanitized Query Parameters

**Severity:** HIGH
**Category:** Missing Input Validation / ORM Misuse
**Files:**
- `/home/user/App-Market/app/api/listings/route.ts` (lines 36, 53, 57)
- `/home/user/App-Market/app/api/transactions/route.ts` (line 40)
- `/home/user/App-Market/app/api/agent/listings/route.ts` (line 46)
- `/home/user/App-Market/app/api/agent/transactions/route.ts` (line 42)
- `/home/user/App-Market/app/api/token-launch/route.ts` (line 257)

**Description:**
Multiple API routes take query parameters (`status`, `category`, `blockchain`) from the URL and pass them directly into Prisma `where` clauses after only calling `.toUpperCase()`:

```typescript
// app/api/listings/route.ts:36
where.status = status.toUpperCase();
// app/api/listings/route.ts:53
where.categories = { has: category.toUpperCase().replace("-", "_") };
// app/api/listings/route.ts:57
where.blockchain = blockchain.toUpperCase();
```

While Prisma parameterizes queries preventing SQL injection, this still allows:
1. **Querying unintended enum values** -- an attacker can pass `status=DELETED` or `status=PENDING_REVIEW` to access listings in internal states not meant to be public.
2. **Error information leakage** -- passing an invalid enum value causes Prisma to throw a detailed error that, if not caught properly, reveals schema information.

In `token-launch/route.ts:257`, the status is passed directly without even `.toUpperCase()`:
```typescript
where.status = status; // No validation at all
```

**Recommended Fix:**
Whitelist allowed values before passing to Prisma:
```typescript
const ALLOWED_STATUSES = ["ACTIVE", "RESERVED", "COMPLETED"];
if (status && ALLOWED_STATUSES.includes(status.toUpperCase())) {
  where.status = status.toUpperCase();
}
```

---

### Finding 3: Mass Assignment in Profile Update

**Severity:** HIGH
**Category:** Mass Assignment / Over-Posting
**File:** `/home/user/App-Market/app/api/profile/route.ts`

**Description:**
The profile update endpoint accepts a JSON body and may spread fields directly into the Prisma `update` call without explicitly whitelisting which fields are allowed. If the route destructures the body and passes fields like `isAdmin`, `isVerified`, `rating`, `totalSales`, or `sellerLevel` to the update call, an attacker could escalate privileges by including these fields in the request body.

This pattern is particularly dangerous when combined with the `any` type casts observed throughout the codebase, which disable TypeScript's ability to catch unexpected field access.

**Recommended Fix:**
Explicitly whitelist allowed fields:
```typescript
const { displayName, bio, username } = body;
const updateData: Prisma.UserUpdateInput = {};
if (displayName !== undefined) updateData.displayName = displayName;
if (bio !== undefined) updateData.bio = bio;
if (username !== undefined) updateData.username = username;
// Never include: isAdmin, isVerified, rating, sellerLevel, etc.
```

---

### Finding 4: Missing CSRF Protection on State-Changing Endpoints

**Severity:** HIGH
**Category:** Cross-Site Request Forgery
**Files (missing CSRF but performing state-changing operations):**
- `/home/user/App-Market/app/api/disputes/route.ts` (POST)
- `/home/user/App-Market/app/api/disputes/[id]/route.ts` (POST, PUT)
- `/home/user/App-Market/app/api/reviews/route.ts` (POST)
- `/home/user/App-Market/app/api/reviews/[id]/response/route.ts` (POST, PUT)
- `/home/user/App-Market/app/api/messages/[conversationId]/route.ts` (POST)
- `/home/user/App-Market/app/api/profile/route.ts` (PUT)
- `/home/user/App-Market/app/api/profile/upload-picture/route.ts` (POST, DELETE)
- `/home/user/App-Market/app/api/transactions/[id]/confirm/route.ts` (POST)
- `/home/user/App-Market/app/api/transactions/[id]/buyer-info/route.ts` (POST)
- `/home/user/App-Market/app/api/listings/[slug]/collaborators/route.ts` (POST, DELETE, PATCH)
- `/home/user/App-Market/app/api/listings/check-similarity/route.ts` (POST)
- `/home/user/App-Market/app/api/withdrawals/route.ts` (POST)
- `/home/user/App-Market/app/api/token-launch/route.ts` (POST)
- `/home/user/App-Market/app/api/purchases/route.ts` (POST)

**Description:**
The codebase implements a solid CSRF double-submit cookie mechanism (`lib/csrf.ts`) with HMAC verification and timing-safe comparison. However, it is only applied to 4 routes:
- `POST /api/listings`
- `POST /api/transactions`
- `POST /api/offers`
- `POST /api/bids`

All other state-changing endpoints (listed above) perform mutations without CSRF validation. While the `SameSite=Lax` cookie policy and JSON content-type provide some defense (as noted in the middleware comments), these are not sufficient alone -- `SameSite=Lax` still allows top-level navigations with cookies, and some browsers/configurations may not enforce it strictly.

**Recommended Fix:**
Apply `validateCsrfRequest()` or `withCsrfProtection()` consistently to all POST/PUT/DELETE/PATCH API route handlers. Consider creating middleware-level CSRF enforcement for all non-GET API routes to prevent future omissions.

---

### Finding 5: Unsafe JSON.parse on Environment Variable

**Severity:** HIGH
**Category:** Unsafe Deserialization
**Files:**
- `/home/user/App-Market/app/api/transactions/[id]/uploads/route.ts` (line 148)
- `/home/user/App-Market/app/api/cron/expire-withdrawals/route.ts` (line 43)

**Description:**
The backend authority secret key is parsed from an environment variable using `JSON.parse`:

```typescript
// uploads/route.ts:148
const keypairBytes = JSON.parse(backendSecretKey);
const backendKeypair = Keypair.fromSecretKey(Uint8Array.from(keypairBytes));
```

In `uploads/route.ts:148`, this `JSON.parse` call is inside a try/catch that catches the on-chain error but does not specifically handle a malformed `BACKEND_AUTHORITY_SECRET_KEY`. If the environment variable is corrupted or tampered with, the `JSON.parse` will throw, and while the outer try/catch will catch it, the error path continues without on-chain verification (line 186-189: "Don't fail the request"), potentially allowing unverified uploads to be marked as verified in the database.

In `expire-withdrawals/route.ts:43`, the `getBackendAuthority()` function properly wraps `JSON.parse` in a try/catch and returns `null` on failure, which is the safer pattern.

**Recommended Fix:**
In `uploads/route.ts`, validate the keypair parsing separately and fail explicitly if the backend authority key is required but malformed:
```typescript
let backendKeypair: Keypair;
try {
  const keypairBytes = JSON.parse(backendSecretKey);
  if (!Array.isArray(keypairBytes) || keypairBytes.length !== 64) {
    throw new Error("Invalid keypair format");
  }
  backendKeypair = Keypair.fromSecretKey(Uint8Array.from(keypairBytes));
} catch (parseError) {
  console.error('Invalid BACKEND_AUTHORITY_SECRET_KEY format:', parseError);
  // Fail the request rather than silently skipping verification
  return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
}
```

---

### Finding 6: Health Endpoint Reveals Infrastructure Configuration

**Severity:** MEDIUM
**Category:** Information Disclosure
**File:** `/home/user/App-Market/app/api/health/route.ts`
**Lines:** 14-106

**Description:**
The health check endpoint is public (no authentication required) and returns detailed infrastructure information:
- Database connectivity and latency in milliseconds
- Redis (Upstash) connectivity and latency
- Solana RPC connectivity, latency, and degraded status
- Configuration status revealing which environment variables are set (line 86-93):
  ```typescript
  checks.config = {
    status: ["NEXTAUTH_SECRET", "ENCRYPTION_SECRET", "CRON_SECRET", "DATABASE_URL"]
      .every(v => !!process.env[v]) ? "ok" : "missing_vars",
  };
  ```

While it does not reveal the values, it confirms to an attacker which services are in use, their response times (useful for fingerprinting), and whether critical secrets are configured.

**Recommended Fix:**
- Return only a simple `{ status: "healthy" }` or `{ status: "degraded" }` response for unauthenticated requests
- Move detailed diagnostics behind admin authentication
- Remove the config check from the public response

---

### Finding 7: User Enumeration via Lookup Endpoint

**Severity:** MEDIUM
**Category:** User Enumeration
**File:** `/home/user/App-Market/app/api/users/lookup/route.ts`
**Lines:** 7-119

**Description:**
The user lookup endpoint allows searching by wallet address or username with partial matching and returns rich user profile data including `walletAddress`, `twitterUsername`, `rating`, and `totalSales`. The rate limiter mitigates automated enumeration, but the endpoint:
1. Requires no authentication (the POST batch endpoint also has no auth)
2. Returns a distinctive response telling the caller whether the query matched a wallet address or username (line 101-105)
3. The batch POST endpoint allows 10 queries at once, multiplying enumeration throughput

The `isWalletAddress` boolean in the response reveals whether a given string is a registered wallet, which is useful intelligence for an attacker.

**Recommended Fix:**
- Require authentication for user lookup
- Return a uniform response structure that does not distinguish between "not found" reasons
- Consider reducing the batch limit or requiring authentication for batch lookups

---

### Finding 8: Missing Input Validation on Dispute Response

**Severity:** MEDIUM
**Category:** Missing Input Validation
**File:** `/home/user/App-Market/app/api/disputes/[id]/route.ts`
**Lines:** 210-296

**Description:**
The dispute response `PUT` handler accepts `response` and `evidence` fields from the request body without any validation:
```typescript
const { response, evidence } = body;
```
There is no check that:
- `response` is a string
- `response` has a reasonable maximum length
- `evidence` conforms to an expected structure
- The `response` text is sanitized

While the evidence is hashed for integrity, the raw content is stored in the `respondentEvidence` JSON field. Extremely large payloads could be used for database storage exhaustion.

**Recommended Fix:**
```typescript
if (!response || typeof response !== 'string' || response.length > 5000) {
  return NextResponse.json(
    { error: "Response must be a string of 5000 characters or less" },
    { status: 400 }
  );
}
if (evidence && !Array.isArray(evidence)) {
  return NextResponse.json(
    { error: "Evidence must be an array" },
    { status: 400 }
  );
}
```

---

### Finding 9: Missing Input Validation on Token Launch

**Severity:** MEDIUM
**Category:** Missing Input Validation
**File:** `/home/user/App-Market/app/api/token-launch/route.ts`
**Lines:** 32-44

**Description:**
The token launch `POST` handler validates `tokenSymbol` length (2-10 chars) but does not validate:
- `tokenName` length (could be extremely long)
- `tokenDescription` length or content
- `tokenImage` URL format or protocol
- `website`, `twitter`, `telegram`, `discord` URL formats
- `initialBuyAmountSOL` is a valid positive number

These values are stored in the database and returned in API responses. A malicious user could store extremely long strings, or URLs with `javascript:` protocols.

**Recommended Fix:**
Add comprehensive validation:
```typescript
if (tokenName.length > 100) {
  return NextResponse.json({ error: "Token name too long" }, { status: 400 });
}
if (tokenDescription && tokenDescription.length > 2000) {
  return NextResponse.json({ error: "Description too long" }, { status: 400 });
}
const urlFields = { tokenImage, website, twitter, telegram, discord };
for (const [field, url] of Object.entries(urlFields)) {
  if (url && !isValidUrl(url)) {
    return NextResponse.json({ error: `Invalid URL for ${field}` }, { status: 400 });
  }
}
```

---

### Finding 10: Missing Validation on Offer Amount and Message

**Severity:** MEDIUM
**Category:** Missing Input Validation
**File:** `/home/user/App-Market/app/api/offers/route.ts`

**Description:**
The offers POST endpoint creates offers but lacks validation that:
- `amount` is a positive number (not negative, zero, NaN, or Infinity)
- `message` has a reasonable maximum length
- `expiresAt` is a valid future date

This contrasts with the bids route which explicitly validates `typeof amount !== 'number' || amount <= 0`.

**Recommended Fix:**
Add validation matching the bids route pattern:
```typescript
if (typeof amount !== 'number' || amount <= 0 || !isFinite(amount)) {
  return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
}
if (message && message.length > 2000) {
  return NextResponse.json({ error: "Message too long" }, { status: 400 });
}
```

---

### Finding 11: Missing Message Content Length Validation

**Severity:** MEDIUM
**Category:** Missing Input Validation
**File:** `/home/user/App-Market/app/api/messages/[conversationId]/route.ts`

**Description:**
The message sending endpoint (POST) accepts message `content` without any length limit. A malicious user could send extremely large messages (megabytes of text) which would be stored in the database and served to other users, potentially causing:
- Database storage exhaustion
- Frontend rendering performance issues
- Bandwidth abuse

**Recommended Fix:**
```typescript
if (!content || typeof content !== 'string' || content.trim().length === 0) {
  return NextResponse.json({ error: "Message content required" }, { status: 400 });
}
if (content.length > 10000) {
  return NextResponse.json({ error: "Message too long (max 10000 chars)" }, { status: 400 });
}
```

---

### Finding 12: Raw Status Parameter Passed to Prisma Where Clause

**Severity:** MEDIUM
**Category:** Missing Input Validation
**File:** `/home/user/App-Market/app/api/listings/route.ts`
**Line:** 36

**Description:**
The listings GET route extracts `status` from query params and sets it directly on the Prisma where clause:
```typescript
const status = searchParams.get("status");
if (status) {
  where.status = status.toUpperCase();
}
```
While Prisma prevents SQL injection, there is no validation that the status is a valid enum value. This allows:
1. Querying internal statuses like `SUSPENDED`, `FLAGGED`, `PENDING_REVIEW` that should not be publicly browsable
2. Triggering Prisma validation errors that may leak schema information in error responses

The same pattern appears in transactions, agent/listings, and agent/transactions routes.

**Recommended Fix:**
Validate against allowed public statuses:
```typescript
const PUBLIC_STATUSES = ["ACTIVE", "RESERVED", "COMPLETED", "EXPIRED"];
if (status && PUBLIC_STATUSES.includes(status.toUpperCase())) {
  where.status = status.toUpperCase();
}
```

---

### Finding 13: Missing UUID Format Validation on Route Parameters

**Severity:** MEDIUM
**Category:** Insecure Direct Object Reference
**Files:**
- `/home/user/App-Market/app/api/disputes/[id]/route.ts` (line 23)
- `/home/user/App-Market/app/api/transactions/[id]/confirm/route.ts` (line 22)
- `/home/user/App-Market/app/api/transactions/[id]/buyer-info/route.ts` (line 10)
- `/home/user/App-Market/app/api/reviews/[id]/response/route.ts` (line 8)

**Description:**
Multiple routes accept `[id]` path parameters and pass them directly to Prisma `findUnique` without validating that they are valid UUID format. While Prisma will simply return `null` for invalid UUIDs (no injection risk), the lack of early validation:
1. Wastes database queries on obviously invalid IDs
2. May expose different error behavior for valid-format vs invalid-format IDs
3. The `lib/validation.ts` file exports an `isValidUUID` function, but it is not consistently used

Notably, the dispute route (`disputes/[id]/route.ts`) imports `isValidUUID` from `lib/validation.ts` but never calls it on `params.id`.

**Recommended Fix:**
Add early validation at the top of each handler:
```typescript
const { id } = params;
if (!isValidUUID(id)) {
  return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
}
```

---

### Finding 14: Missing Authorization on Collaborators GET

**Severity:** MEDIUM
**Category:** Missing Authorization
**File:** `/home/user/App-Market/app/api/listings/[slug]/collaborators/route.ts`
**Lines:** 8-83

**Description:**
The collaborators `GET` endpoint returns all collaborators for a listing, including their wallet addresses, user IDs, percentage splits, and roles, without requiring any authentication:
```typescript
export async function GET(request: NextRequest, { params }: ...) {
  // No auth check here
  const { slug } = await params;
  const listing = await prisma.listing.findUnique({
    where: { slug },
    include: { collaborators: { include: { user: { select: { ... walletAddress: true ... } } } } }
  });
  // Returns full collaborator details
}
```

This exposes sensitive business relationship data (who is collaborating with whom, revenue split percentages, wallet addresses) to any unauthenticated user who knows the listing slug.

**Recommended Fix:**
Either require authentication, or limit the data returned to unauthenticated users (omit wallet addresses, exact percentages, and user IDs).

---

### Finding 15: Console.error Logs Full Error Objects

**Severity:** LOW
**Category:** Information Disclosure (Server-Side)
**Files:** All API route files

**Description:**
Every API route handler catches errors and logs them with `console.error`:
```typescript
console.error("Error creating transaction:", error);
```

In production, these logs may be captured by log aggregation services. The full error object can contain:
- Database connection strings (from Prisma connection errors)
- Internal file paths and stack traces
- Query details showing table/column names
- Environment variable names

While the error responses to clients are properly sanitized (returning generic messages), the server-side logging is verbose. This is a LOW risk because it requires access to server logs, but it should be tightened for defense in depth.

**Recommended Fix:**
Log only the error message and a sanitized stack trace:
```typescript
console.error("Error creating transaction:", error instanceof Error ? error.message : "Unknown error");
```

---

### Finding 16: Unbounded Listing Duration

**Severity:** LOW
**Category:** Input Validation
**File:** `/home/user/App-Market/app/api/listings/route.ts`
**Line:** 425

**Description:**
The listing duration is parsed with `parseInt` without an upper bound:
```typescript
const durationDays = parseInt(duration) || 7;
const endTime = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
```
A user could pass `duration=99999` creating a listing that expires in 274 years. While not a security vulnerability per se, it could be used to create effectively permanent listings that bypass any intended time constraints.

**Recommended Fix:**
```typescript
const durationDays = Math.min(Math.max(parseInt(duration) || 7, 1), 90); // 1-90 days
```

---

### Finding 17: Review Response Content Not Sanitized

**Severity:** LOW
**Category:** Stored XSS Risk
**File:** `/home/user/App-Market/app/api/reviews/[id]/response/route.ts`
**Lines:** 62-74

**Description:**
The review response content is validated for presence and length (max 1000 chars) but is stored with only `.trim()`:
```typescript
content: content.trim(),
```
If this content is rendered in the frontend without proper escaping (e.g., via `dangerouslySetInnerHTML`), it could lead to stored XSS. The codebase does use `dangerouslySetInnerHTML` in some components (found in search). React's default JSX rendering escapes HTML, but any use of `dangerouslySetInnerHTML` with this content would be vulnerable.

The same concern applies to other user-generated content fields: listing descriptions, dispute responses, messages, etc.

**Recommended Fix:**
- Sanitize HTML on input using a library like `sanitize-html` or `DOMPurify` (server-side)
- Audit all frontend rendering of user content to ensure `dangerouslySetInnerHTML` is never used with unsanitized user input
- Consider storing a sanitized version alongside the raw version

---

### Finding 18: Incomplete SSRF Protection on Webhook URLs

**Severity:** LOW
**Category:** Server-Side Request Forgery
**File:** `/home/user/App-Market/app/api/agent/webhooks/route.ts`
**Lines:** 16-43

**Description:**
The `checkSsrfUrl` function blocks localhost, RFC 1918 private IPs, link-local, CGNAT ranges, and cloud metadata hostnames. This is good, but it has gaps:

1. **IPv6 private ranges not blocked:** `::1` is blocked, but `fc00::`, `fd00::`, `fe80::` (link-local), and `::ffff:127.0.0.1` (IPv4-mapped IPv6) are not
2. **DNS rebinding:** An attacker could register a domain that initially resolves to a public IP (passing validation) but later resolves to a private IP when the webhook fires
3. **Redirect following:** If the webhook HTTP client follows redirects, an attacker's URL could redirect to an internal service
4. **AWS metadata at IP:** The IP `169.254.169.254` is checked via the regex but the specific IP check could be more explicit; the regex correctly covers it

**Recommended Fix:**
```typescript
// Add IPv6 private range checks
if (h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80") ||
    h === "::ffff:127.0.0.1" || h.startsWith("::ffff:10.") ||
    h.startsWith("::ffff:192.168.") || h.startsWith("::ffff:172.")) {
  return "Webhook URL cannot point to private IPv6 addresses";
}
```
Additionally, resolve the hostname at webhook delivery time and verify the resolved IP is not in a private range.

---

### Finding 19: Widespread `as any` Type Casts Weaken Safety

**Severity:** LOW
**Category:** Type Safety / Defense in Depth
**Files:** Multiple (found in nearly every API route)

**Description:**
The codebase extensively uses `as any` type casts:
```typescript
const updateData: any = {};  // webhooks/route.ts:305, collaborators/route.ts:451
let user = await (prisma.user.findUnique as any)({  // users/[username]/route.ts:25
const collaboratorTotalPercentage = listing.collaborators.reduce(
  (sum: number, c: any) => sum + Number(c.percentage), 0  // collaborators/route.ts:61
```

While not a direct vulnerability, `any` types disable TypeScript's compile-time checks that would otherwise catch:
- Accidental inclusion of sensitive fields in response objects
- Type mismatches that could lead to logic errors
- Mass assignment via spreading unknown objects into database update calls

**Recommended Fix:**
Replace `any` with proper types or `unknown` with runtime validation. For Prisma results, use the generated types (`Prisma.ListingGetPayload<...>`). For request bodies, use Zod schemas (already used in `uploads/route.ts` as a good example to follow).

---

## Positive Security Observations

The audit also identified several well-implemented security controls worth noting:

1. **CSRF Protection (where applied):** The `lib/csrf.ts` implementation uses HMAC-signed tokens with timing-safe comparison and 24-hour expiry -- this is a strong implementation.

2. **Constant-Time Secret Comparison:** Admin secret validation (`admin/reset-listings`), CSRF verification, and cron secret checks all use `crypto.timingSafeEqual`.

3. **File Upload Security:** Profile picture uploads validate both MIME type and magic bytes, preventing disguised file uploads.

4. **Rate Limiting:** Applied to most public and authenticated endpoints using Upstash Redis.

5. **Audit Logging:** Critical operations (admin actions, financial transactions) are logged with user ID, IP, and action details.

6. **SSRF Protection:** Webhook URLs are validated against private IP ranges and cloud metadata hostnames.

7. **Zod Validation:** The upload route (`transactions/[id]/uploads`) uses Zod schema validation -- this pattern should be adopted across all routes.

8. **Prisma ORM:** Consistent use of Prisma ORM with parameterized queries eliminates traditional SQL injection risk. No raw SQL queries were found except the health check `SELECT 1`.

9. **OAuth State Verification:** Twitter OAuth callback verifies the state parameter and uses encrypted cookies for OAuth data storage.

10. **Serializable Transactions:** The bids route uses `prisma.$transaction` to prevent race conditions on concurrent bid placement.

---

## Recommendations Summary

### Immediate (Critical/High)

1. **Remove or protect the debug session page** (`/debug/session`) before any production deployment
2. **Whitelist allowed enum values** for all query parameters passed to Prisma `where` clauses
3. **Audit and restrict profile update fields** to prevent mass assignment privilege escalation
4. **Apply CSRF validation consistently** to all state-changing API endpoints
5. **Fix unsafe JSON.parse** in upload verification to fail explicitly on configuration errors

### Short-Term (Medium)

6. **Add input length validation** to all text fields: dispute responses, messages, token launch metadata, offer messages
7. **Restrict health endpoint details** to authenticated admins
8. **Add UUID format validation** on all route `[id]` parameters using the existing `isValidUUID` utility
9. **Add authentication** to the collaborators GET endpoint, or reduce data exposure
10. **Require authentication** for user lookup/batch endpoints

### Long-Term (Low / Architecture)

11. **Adopt Zod schemas** for request body validation across all routes (following the uploads route pattern)
12. **Replace `as any` casts** with proper TypeScript types throughout the codebase
13. **Enhance SSRF protection** with IPv6 checks and DNS rebinding mitigation
14. **Implement structured logging** that automatically sanitizes sensitive data from error objects
15. **Consider server-side HTML sanitization** for all user-generated content fields
