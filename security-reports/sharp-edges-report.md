# Sharp Edges Security Analysis Report

**Application:** App Market (Next.js / Prisma / Solana)
**Date:** 2026-02-27
**Methodology:** Trail of Bits "Sharp Edges" Analysis
**Scope:** Authentication, authorization, cryptography, input validation, configuration, session management, Solana integration, price/auction handling

---

## Executive Summary

This report identifies security-relevant API design patterns, dangerous defaults, configuration cliffs, silent failures, and footgun-prone code paths in the App Market codebase. The application demonstrates generally strong security awareness -- it uses AES-256-GCM encryption, timing-safe comparisons, CSRF protection, rate limiting, and replay-attack prevention. However, several critical and high-severity issues were identified that could lead to private key exposure, financial precision errors, authorization bypasses, and SSRF.

**Finding Count by Severity:**
- Critical: 3
- High: 5
- Medium: 8
- Low: 4

---

## Critical Findings

### CRIT-01: Private Mint Keypair Exposed to Client in Token Launch Deploy Endpoint

**File:** `app/api/token-launch/deploy/route.ts` (line 176)
**Category:** Primitive vs Semantic APIs
**Severity:** Critical

The token launch deploy endpoint returns the full secret key of the vanity mint keypair to the client:

```typescript
return NextResponse.json({
  // ...
  mintKeypairBytes: Array.from(decryptedKeypair.secretKey),
});
```

The server decrypts the vanity keypair from the database (`decrypt(tokenLaunch.vanityKeypair)`) and then serializes the raw `secretKey` bytes (all 64 bytes of an Ed25519 keypair) into the HTTP response body. While the stated intent is for the client to co-sign the pool creation transaction, this transmits a long-lived private key over the network where it could be:
1. Logged by intermediary proxies or CDN edge nodes
2. Captured in browser developer tools and persisted in history
3. Intercepted if TLS is terminated early
4. Stored in browser memory accessible to XSS attacks

**Threat Model:**
- *The Scoundrel*: An attacker with XSS on any page could read this response and steal the mint keypair to mint unauthorized tokens.
- *The Lazy Developer*: A developer might log this response during debugging, persisting the secret key in log aggregation systems.

**Recommendation:** Sign the transaction server-side with the mint keypair and return only the pre-signed (partially signed) serialized transaction to the client. The private key should never leave the server boundary.

---

### CRIT-02: Floating-Point Arithmetic in Financial Calculations

**File:** `lib/solana.ts` (lines 136-138, 252-254), `lib/config.ts` (lines 288-295), `app/api/transactions/route.ts`
**Category:** Primitive vs Semantic APIs
**Severity:** Critical

Multiple financial calculation functions use JavaScript floating-point `number` for currency amounts:

```typescript
// lib/solana.ts
export const calculatePlatformFee = (amount: number, currency?: string): number => {
  const feeBps = getFeeRateBps(currency);
  return (amount * feeBps) / 10000;
};

// lib/solana.ts
export const toTokenUnits = (amount: number, currency: "SOL" | "APP" | "USDC"): BN => {
  const decimals = TOKEN_DECIMALS[currency];
  return new BN(Math.floor(amount * Math.pow(10, decimals)));
};
```

JavaScript `number` is IEEE 754 double-precision, which cannot precisely represent many decimal values. For example, `0.1 + 0.2 !== 0.3` in JavaScript. When fee calculations chain multiple floating-point operations (fee calculation -> seller proceeds -> collaborator split -> referral earnings), rounding errors can accumulate.

The `calculatePartnerPayments` function in `lib/validation.ts` correctly uses `BigInt` for lamport-level precision, but the upstream callers in `solana.ts` and `config.ts` feed it floating-point-derived values, undermining the precision.

Additionally, `toTokenUnits` uses `Math.floor(amount * Math.pow(10, decimals))` which can produce incorrect results for amounts that cannot be exactly represented in IEEE 754 (e.g., `Math.floor(1.005 * 1e9)` = `1004999999` instead of `1005000000`).

**Threat Model:**
- *The Scoundrel*: Could craft bid/offer amounts that exploit rounding to pay slightly less than intended or receive more than deserved through systematic exploitation across many transactions.

**Recommendation:** Use integer lamport/smallest-unit arithmetic throughout the entire fee and payment pipeline. Parse monetary inputs as strings, convert to `BigInt` lamports immediately, and only convert back to display strings at the response boundary.

---

### CRIT-03: Missing Bid Amount Upper Bound Allows Potential Overflow

**File:** `app/api/bids/route.ts` (lines 99-105)
**Category:** Configuration Cliffs
**Severity:** Critical

The bid endpoint validates that the amount is a positive number but does not enforce a maximum cap:

```typescript
// SECURITY: Validate amount is positive
if (typeof amount !== 'number' || amount <= 0) {
  return NextResponse.json(
    { error: "Amount must be a positive number" },
    { status: 400 }
  );
}
```

In contrast, the offers endpoint correctly caps at `MAX_OFFER_AMOUNT = 1_000_000`:

```typescript
// app/api/offers/route.ts
const MAX_OFFER_AMOUNT = 1_000_000;
amount: z.number().positive().max(MAX_OFFER_AMOUNT, ...),
```

An attacker could submit a bid with `amount: Number.MAX_SAFE_INTEGER` or `amount: 1e308`, which would then flow into fee calculations like `(amount * feeBps) / 10000` causing `Infinity` or precision loss. This would corrupt transaction records and potentially allow completion of a transaction with invalid financial data.

The `maxBid` field is also accepted from the request body without validation:
```typescript
const { listingId, amount, maxBid, currency, onChainTx } = body;
```

**Recommendation:** Add `MAX_BID_AMOUNT` validation matching the offers cap, and validate `maxBid` similarly. Reject `NaN`, `Infinity`, and non-finite values explicitly.

---

## High Findings

### HIGH-01: Inconsistent CSRF Protection Across State-Changing Endpoints

**Files:** Multiple API routes
**Category:** Dangerous Defaults
**Severity:** High

Several state-changing POST/PUT/DELETE endpoints lack CSRF validation. The following state-changing routes were found WITHOUT `validateCsrfRequest`:

| Route | Method | Has CSRF? |
|-------|--------|-----------|
| `app/api/messages/route.ts` | POST | **No** |
| `app/api/disputes/route.ts` | POST | **No** |
| `app/api/reviews/route.ts` | POST | **No** |
| `app/api/profile/route.ts` | PUT | **No** |
| `app/api/profile/upload-picture/route.ts` | POST/DELETE | **No** |
| `app/api/github/verify/route.ts` | POST | **No** |
| `app/api/watchlist/route.ts` | POST/DELETE | **No** |
| `app/api/notifications/route.ts` | PATCH | **No** |
| `app/api/token-launch/route.ts` | POST | **No** |
| `app/api/token-launch/deploy/route.ts` | POST | **No** |
| `app/api/purchases/route.ts` | POST | **No** |
| `app/api/transfers/[id]/complete/route.ts` | POST | **No** |

While the middleware comment states "CSRF protection is provided by SameSite=Lax cookies and JSON Content-Type requirement", this is defense-in-depth that relies on browser behavior. SameSite=Lax still allows top-level navigation POSTs, and Content-Type restrictions can be bypassed in certain scenarios (e.g., `navigator.sendBeacon`).

The most dangerous omissions are `transfers/[id]/complete` (releases escrow funds) and `token-launch/deploy` (deploys on-chain transactions).

**Recommendation:** Apply `validateCsrfRequest` consistently to all state-changing endpoints, especially financial ones. Consider using the `withCsrfProtection` HOF wrapper which already exists but is unused.

---

### HIGH-02: SSRF Bypass via DNS Rebinding in Webhook URLs

**File:** `app/api/agent/webhooks/route.ts` (lines 16-43)
**Category:** Primitive vs Semantic APIs
**Severity:** High

The SSRF protection in `checkSsrfUrl` validates the hostname string at registration time but does not protect against DNS rebinding attacks. An attacker can:

1. Register a webhook with a domain they control (e.g., `evil.example.com`) that initially resolves to a public IP
2. After registration passes SSRF checks, change the DNS A record to `169.254.169.254` (AWS metadata endpoint) or `127.0.0.1`
3. When the webhook fires (`lib/webhooks.ts` -> `attemptDelivery`), the `fetch()` call resolves the hostname again and connects to the internal IP

The check also misses:
- IPv6 mapped addresses (e.g., `[::ffff:127.0.0.1]`, `[::ffff:169.254.169.254]`)
- Decimal/octal IP notations (e.g., `0x7f000001`, `2130706433`)
- AWS metadata endpoint at `169.254.169.254` (the regex pattern only checks the `169.254.*.*` range by IP regex, but the hostname `metadata.google.internal` check does not cover the AWS IP directly when provided as an IP string)

**Recommendation:** Resolve the webhook URL hostname to an IP at delivery time and re-validate the resolved IP against the blocklist. Use a dedicated HTTP client library that supports connection-level IP filtering. Consider requiring HTTPS for webhook URLs.

---

### HIGH-03: Agent Wallet Signature Auth Lacks Nonce Replay Protection

**File:** `lib/agent-auth.ts` (lines 174-248)
**Category:** Silent Failures
**Severity:** High

The agent wallet signature authentication uses a 30-second timestamp tolerance but does NOT implement nonce tracking to prevent replay attacks within that window:

```typescript
const SIGNATURE_TIMESTAMP_TOLERANCE_MS = 30 * 1000; // 30 seconds

async function verifyWalletSignature(
  walletAddress: string,
  signature: string,
  timestamp: string,
  nonce?: string  // <-- Optional nonce, not enforced
): Promise<AgentAuthResult> {
  // ...validates timestamp window but no nonce dedup...
  const message = generateAuthMessage(timestampNum, nonce);
  // No nonce tracking or replay detection
```

The `nonce` parameter is optional and even when provided, it is included in the signed message but never checked against a used-nonce store. Compare this with the user-facing `validateWalletSignatureMessage` in `lib/validation.ts` which correctly uses atomic check-and-set via Redis.

An attacker who captures a valid agent authentication request (e.g., from network logs or a compromised CI/CD pipeline) can replay it within the 30-second window for full API access.

**Recommendation:** Make the nonce mandatory for agent wallet auth and implement check-and-set deduplication using the same Redis-backed `checkAndSetNonce` function from `lib/validation.ts`.

---

### HIGH-04: Session Revocation Not Checked in Middleware (Edge Runtime Limitation)

**File:** `middleware.ts` (lines 134-143)
**Category:** Silent Failures
**Severity:** High

The middleware explicitly notes that session revocation is NOT checked:

```typescript
// NOTE: Session revocation is checked in API route handlers via getAuthToken().
// Middleware uses getToken() which does not check revocation because Prisma
// is not available in Edge Runtime.
```

This means that even after `revokeSession()` or `revokeAllUserSessions()` is called, a revoked session can still:
1. Access protected page routes (dashboard, settings, messages, etc.) until the JWT expires
2. Pass middleware admin checks (`token.isAdmin`) for admin pages

While API routes that use `getAuthToken()` correctly check revocation, any route that relies solely on middleware for auth (page routes, or API routes that use `getServerSession` instead of `getAuthToken`) will accept revoked sessions.

Several API routes use `getServerSession(authOptions)` instead of `getAuthToken(request)`:
- `app/api/offers/route.ts`
- `app/api/disputes/route.ts`
- `app/api/withdrawals/route.ts`
- `app/api/purchase-partners/invites/route.ts`
- `app/api/offers/[offerId]/cancel/route.ts`

These routes do NOT check session revocation.

**Recommendation:** Standardize all API routes to use `getAuthToken(request)` which includes revocation checks. For page routes, consider implementing a lightweight revocation check using an Edge-compatible store (e.g., Upstash Redis REST API which works in Edge Runtime).

---

### HIGH-05: Inconsistent Auth Pattern Creates Authorization Confusion

**Files:** Multiple API routes
**Category:** Stringly-Typed Security
**Severity:** High

The codebase uses two different authentication patterns interchangeably:

1. `getAuthToken(request)` - JWT-based, checks session revocation
2. `getServerSession(authOptions)` - Server session, does NOT check revocation

Routes using `getServerSession` (which skips revocation):
- `app/api/offers/route.ts` (POST for creating offers)
- `app/api/disputes/route.ts` (POST for opening disputes)
- `app/api/withdrawals/route.ts`
- `app/api/admin/reset-listings/route.ts`
- `app/api/purchase-partners/invites/route.ts`
- `app/api/offers/[offerId]/cancel/route.ts`
- `app/api/offers/[offerId]/accept/route.ts`
- `app/api/profile/upload-picture/route.ts`
- `app/api/token-launch/deploy/route.ts`
- `app/api/token-launch/route.ts`

This inconsistency means a developer could copy from an existing route that uses `getServerSession` and unknowingly skip revocation checks. The two functions also return different shapes (`token.id` vs `session.user.id`), creating type confusion.

**Recommendation:** Deprecate and remove direct use of `getServerSession` in API routes. Create a single canonical auth function (e.g., `requireAuth(request)`) that always checks revocation and returns a consistent shape.

---

## Medium Findings

### MED-01: Collaborator Percentage Validation After Listing Creation

**File:** `app/api/listings/route.ts` (lines 538-548)
**Category:** Silent Failures
**Severity:** Medium

The collaborator total percentage validation occurs AFTER the listing has already been created in the database:

```typescript
// Create listing (line 456)
const listing = await prisma.listing.create({ ... });

// Validate collaborator percentages AFTER listing creation (line 538-548)
if (hasCollaborators) {
  const totalCollaboratorPercentage = collaborators.reduce(...);
  if (totalCollaboratorPercentage > 100) {
    return NextResponse.json(
      { error: `Total collaborator percentage exceeds 100%` },
      { status: 400 }
    );
  }
```

If the percentage check fails, the listing is already persisted in the database in `PENDING_COLLABORATORS` status but the collaborator records are never created. This leaves an orphaned listing that the seller cannot complete the collaborator flow for.

**Recommendation:** Move percentage validation before the listing creation, or wrap both operations in a database transaction with rollback.

---

### MED-02: Missing `unsafe-eval` in CSP but `unsafe-inline` for Scripts

**File:** `next.config.js` (lines 74-94)
**Category:** Configuration Cliffs
**Severity:** Medium

The Content Security Policy allows `script-src 'self' 'unsafe-inline'`:

```javascript
"script-src 'self' 'unsafe-inline'",
```

While `unsafe-inline` is noted as "needed for Next.js", it significantly weakens the protection against XSS. Combined with the fact that the CSRF cookie is set with `httpOnly: false` (required for double-submit pattern in `lib/csrf.ts` line 117), an XSS vulnerability could:
1. Read the CSRF token from the cookie
2. Execute arbitrary inline scripts
3. Make authenticated requests on behalf of the user

**Recommendation:** Use Next.js nonce-based CSP to eliminate `unsafe-inline`. Generate a per-request nonce and pass it to `<Script nonce={nonce}>` components.

---

### MED-03: GitHub Repository Verification Proves Existence, Not Ownership

**File:** `app/api/github/verify/route.ts`
**Category:** Stringly-Typed Security
**Severity:** Medium

The GitHub verification endpoint checks if a public repository exists but does not verify that the authenticated user owns it:

```typescript
// For public repos, we consider them "verified" if they exist
return NextResponse.json({
  verified: true,
  note: "Repository found. Ownership will be verified during the transfer process.",
});
```

The `owner` and `repo` parameters come directly from user input with no sanitization against path traversal in the GitHub API URL:

```typescript
const { owner, repo } = await request.json();
const repoResponse = await fetch(
  `https://api.github.com/repos/${owner}/${repo}`,
```

An attacker could list someone else's popular repository (e.g., `facebook/react`) on the marketplace and it would show as "verified". While the note says ownership is verified later, the UI shows `verified: true` which misleads buyers.

Additionally, the `owner` and `repo` fields are not validated for path traversal characters, potentially allowing SSRF-like behavior against the GitHub API (e.g., `owner: "../orgs/secret-org/members?per_page=100#"`).

**Recommendation:** Validate `owner` and `repo` against a strict alphanumeric-plus-hyphens pattern. Do not return `verified: true` -- use a distinct status like `exists: true, ownershipVerified: false`. Require GitHub OAuth or gist-based ownership proof.

---

### MED-04: `looksEncrypted` Heuristic Can Cause Silent Data Corruption

**File:** `lib/encryption.ts` (lines 112-120), `lib/account-token-encryption.ts` (lines 19, 39)
**Category:** Silent Failures
**Severity:** Medium

The `looksEncrypted` function uses a length heuristic to decide if data is already encrypted:

```typescript
export function looksEncrypted(data: string): boolean {
  try {
    const decoded = Buffer.from(data, "base64");
    return decoded.length > SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH; // > 64 bytes
  } catch {
    return false;
  }
}
```

Any base64 string longer than 64 decoded bytes will pass this check. This means:
- A long base64 JWT or access token could be falsely detected as "already encrypted", causing `encryptAccountTokens` to skip encryption and store it in plaintext
- A base64-encoded long string could be falsely detected as encrypted, causing `decryptAccountTokens` to attempt decryption, fail, and silently return the raw value (per the catch block in `account-token-encryption.ts` line 44)

The `encryptAccountTokens` function also silently catches encryption failures:
```typescript
} catch (error) {
  console.error(`[Token Encryption] Failed to encrypt ${field}:`, error);
  // Continue without encryption rather than breaking auth
}
```

This means tokens can be silently stored in plaintext if the ENCRYPTION_SECRET is misconfigured.

**Recommendation:** Use a deterministic prefix or structured envelope format (e.g., `enc:v1:...`) to distinguish encrypted from plaintext data instead of a length heuristic. Fail loudly on encryption errors rather than storing plaintext.

---

### MED-05: `BN.toNumber()` Can Overflow for Large Solana Amounts

**File:** `lib/solana.ts` (lines 125-128, 258-262)
**Category:** Primitive vs Semantic APIs
**Severity:** Medium

Several functions convert BN (arbitrary precision) to JavaScript `number` which is limited to `Number.MAX_SAFE_INTEGER` (2^53 - 1 = ~9 quadrillion):

```typescript
export const lamportsToSol = (lamports: number | BN): number => {
  const value = typeof lamports === "number" ? lamports : lamports.toNumber();
  return value / LAMPORTS_PER_SOL;
};

export const fromTokenUnits = (units: number | BN, currency: ...): number => {
  const value = typeof units === "number" ? units : units.toNumber();
  return value / Math.pow(10, decimals);
};
```

While `MAX_SAFE_INTEGER` lamports equals ~9.2 billion SOL (far exceeding the total supply of ~580M SOL), the same pattern for APP tokens with 9 decimals would overflow at ~9.2 billion APP tokens. If the token supply is 1 billion (as configured in `PLATFORM_CONFIG.pato.defaultTotalSupply`), the full supply in raw units is `1e18`, which is ABOVE `Number.MAX_SAFE_INTEGER` (`~9e15`). This means `toNumber()` would produce incorrect results for large APP token quantities.

**Recommendation:** Keep amounts in `BN` or `BigInt` throughout calculations and only convert to `number` for display purposes, accepting the precision loss is for display only.

---

### MED-06: Webhook Event ID Uses `Math.random()` for Uniqueness

**File:** `lib/webhooks.ts` (line 221)
**Category:** Primitive vs Semantic APIs
**Severity:** Medium

```typescript
function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
```

`Math.random()` is not cryptographically secure and `Date.now()` has millisecond resolution. In a serverless environment processing multiple webhook events concurrently, two events could receive the same ID. Duplicate event IDs would prevent idempotent processing by webhook consumers.

**Recommendation:** Use `crypto.randomUUID()` or `crypto.randomBytes(16).toString('hex')` for event IDs.

---

### MED-07: In-Memory Nonce Store Allows Replay in Development Mode

**File:** `lib/validation.ts` (lines 8, 42-46)
**Category:** Dangerous Defaults
**Severity:** Medium

When Upstash Redis is not configured (typical in development), nonce tracking falls back to an in-memory `Map`:

```typescript
const usedSignatureNonces = new Map<string, number>();

async function checkAndSetNonce(nonceKey: string): Promise<boolean> {
  const redis = await getNonceRedis();
  if (redis) { /* atomic Redis check */ }
  // In-memory fallback (dev only -- not safe for multi-instance production)
  if (usedSignatureNonces.has(nonceKey)) {
    return true;
  }
  usedSignatureNonces.set(nonceKey, Date.now());
  return false;
}
```

In development, if the Next.js dev server uses hot-reloading or module re-evaluation, the `Map` is reset, allowing all previously used nonces to be replayed. Additionally, Next.js API routes in development can run in separate worker threads, each with their own `Map` instance.

While the code comments note this is "dev only", the rate limiting module correctly throws an error in production without Redis (`lib/rate-limit.ts` line 128), but the nonce module silently falls back. This inconsistency means a production deployment that accidentally omits Redis config would silently lose replay protection.

**Recommendation:** Add a production guard that throws (like rate-limit.ts does) when Redis is unavailable for nonce checking in production. The `env-validation.ts` already checks for Redis in production, but the nonce module should also refuse to fall back.

---

### MED-08: Admin Secret Length Check Leaks Timing Information

**File:** `app/api/admin/reset-listings/route.ts` (lines 27-28), `middleware.ts` (lines 113)
**Category:** Silent Failures
**Severity:** Medium

Both the admin secret and cron secret validation perform a length pre-check before the timing-safe comparison:

```typescript
// middleware.ts
if (authHeader && authHeader.length === expectedHeader.length) {
  isValid = timingSafeEqual(...);
}

// admin reset-listings route.ts
if (secret.length !== ADMIN_SECRET.length) {
  return false;
}
```

While `timingSafeEqual` prevents timing-based content inference, the length pre-check reveals the exact length of the secret via timing side-channel. An attacker can binary-search for the correct length by measuring response times for different-length inputs. Once the length is known, the search space is reduced.

The CSRF verification in `lib/csrf.ts` correctly handles this by padding both values:
```typescript
const maxLen = Math.max(providedSignature.length, expectedSignature.length, 1);
const isValid = crypto.timingSafeEqual(
  Buffer.from(providedSignature.padEnd(maxLen, "\0")),
  Buffer.from(expectedSignature.padEnd(maxLen, "\0"))
);
```

**Recommendation:** Use the same padding-before-comparison pattern from `csrf.ts` for admin and cron secret validation. Alternatively, hash both the provided and expected values with a fixed-length hash before comparison.

---

## Low Findings

### LOW-01: `vercelJson` Cron Routes Use GET Instead of POST

**File:** `vercel.json`, `app/api/cron/escrow-auto-release/route.ts`
**Category:** Dangerous Defaults
**Severity:** Low

All cron routes are exported as `GET` handlers:

```typescript
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) { ... }
```

While Vercel invokes cron jobs via GET, using GET for state-changing operations violates HTTP semantics and means:
- Browser prefetching or link scanners could inadvertently trigger crons if the CRON_SECRET was accidentally exposed in a URL
- GET requests may be cached by intermediaries

The CRON_SECRET in the Authorization header mitigates this, but defense-in-depth would suggest POST.

**Recommendation:** Consider wrapping GET handlers with an explicit idempotency check (already partially done via `updateMany WHERE status IN [...]` pattern) and document the GET method choice.

---

### LOW-02: Account Token Encryption Silently Falls Back to Plaintext

**File:** `lib/account-token-encryption.ts` (lines 22-24, 43-45)
**Category:** Silent Failures
**Severity:** Low

Both encrypt and decrypt operations catch errors and continue:

```typescript
// Encrypt
} catch (error) {
  console.error(`[Token Encryption] Failed to encrypt ${field}:`, error);
  // Continue without encryption rather than breaking auth
}

// Decrypt
} catch (error) {
  console.error(`[Token Encryption] Failed to decrypt ${field}:`, error);
  // Return the raw value if decryption fails (may be unencrypted legacy data)
}
```

While this ensures auth doesn't break during key rotation or migration, it means OAuth tokens could silently be stored/retrieved in plaintext without any monitoring alert beyond a console log.

**Recommendation:** Add structured error reporting (e.g., Sentry alert) for encryption failures. Track a metric of plaintext vs encrypted tokens to detect regression.

---

### LOW-03: Missing Rate Limiting on Several Sensitive Endpoints

**Files:** Multiple API routes
**Category:** Dangerous Defaults
**Severity:** Low

The following sensitive endpoints lack rate limiting:

| Route | Method | Risk |
|-------|--------|------|
| `app/api/transactions/route.ts` | POST | Transaction creation |
| `app/api/transfers/[id]/complete/route.ts` | POST | Fund release |
| `app/api/profile/route.ts` | PUT | Profile updates |
| `app/api/profile/upload-picture/route.ts` | POST | File upload |
| `app/api/notifications/route.ts` | PATCH | Mark as read |
| `app/api/token-launch/deploy/route.ts` | POST | On-chain deployment |

While these routes require authentication (limiting abuse to registered users), a compromised account or malicious user could abuse them without rate constraints.

**Recommendation:** Apply `withRateLimitAsync` with appropriate presets to all state-changing endpoints.

---

### LOW-04: Buyback Module Uses In-Memory State in Serverless Environment

**File:** `lib/buyback.ts` (line 40)
**Category:** Silent Failures
**Severity:** Low

```typescript
let accumulatedBuybackAmount = 0;
```

The buyback accumulator is stored in module-level memory. In a serverless environment like Vercel, each function invocation may run in a separate instance, so the accumulated amount would be lost between invocations and never reach the minimum threshold.

The module comment acknowledges this: "In-memory accumulator (would be persisted in production)". While the feature is currently disabled by default (`ENABLE_AUTO_BUYBACK !== "true"`), enabling it without persisting the accumulator to a database would result in buybacks never triggering.

**Recommendation:** Persist the accumulated buyback amount in the database or Redis before enabling this feature.

---

## Positive Security Patterns Observed

The following security practices are well-implemented and worth preserving:

1. **AES-256-GCM with AAD support** (`lib/encryption.ts`): Authenticated encryption with optional context binding prevents ciphertext swapping between records.

2. **Atomic nonce check-and-set via Redis SET NX** (`lib/validation.ts`): Properly prevents replay attacks with atomic operations.

3. **Serializable transaction isolation** for bids, offers, and disputes: Prevents TOCTOU race conditions.

4. **Session revocation via database blacklist** (`lib/auth.ts`): Supports multi-instance serverless deployment for session invalidation.

5. **SSRF protection on webhook URLs** (`app/api/agent/webhooks/route.ts`): Blocks private IPs and cloud metadata hostnames (with caveats noted in HIGH-02).

6. **Magic byte validation for file uploads** (`lib/file-security.ts`): Prevents extension spoofing attacks.

7. **Environment validation at startup** (`lib/env-validation.ts`): Fails fast on misconfiguration in production.

8. **Production guard on rate limiting** (`lib/rate-limit.ts`): Throws error if Upstash Redis is not configured in production, refusing to silently degrade.

9. **scryptSync key derivation** for encryption: Properly derives keys from secrets using a KDF.

10. **bcrypt for API key hashing** (`lib/agent-auth.ts`): Resistant to brute-force attacks on stolen key hashes.

---

## Remediation Priority

| Priority | Finding | Effort |
|----------|---------|--------|
| Immediate | CRIT-01: Private key exposure in token deploy | Medium |
| Immediate | CRIT-03: Missing bid amount cap | Low |
| Short-term | HIGH-01: CSRF gaps on financial endpoints | Medium |
| Short-term | HIGH-03: Agent auth replay window | Low |
| Short-term | HIGH-04/05: Session revocation gaps | Medium |
| Medium-term | CRIT-02: Float precision in financial math | High |
| Medium-term | HIGH-02: DNS rebinding in webhooks | Medium |
| Medium-term | MED-01-MED-08: Various medium findings | Medium |
| Long-term | LOW-01-LOW-04: Various low findings | Low |

---

*Report generated by Trail of Bits "Sharp Edges" security analysis methodology.*
