# Security Audit: Authentication & Authorization

**Audit Date:** 2026-02-10
**Scope:** Authentication, authorization, session management, access control
**Auditor:** Automated Security Review (Claude Opus 4.6)

---

## Summary Table

| # | Severity | Finding | File | Line(s) |
|---|----------|---------|------|---------|
| 1 | **CRITICAL** | Mint keypair secret key leaked to client in API response | `app/api/token-launch/deploy/route.ts` | 176 |
| 2 | **HIGH** | 26 API route files use `getServerSession` which bypasses session revocation checks | Multiple (see Finding 2) | Various |
| 3 | **HIGH** | CSRF protection missing on most state-changing endpoints | Multiple (see Finding 3) | Various |
| 4 | **HIGH** | Debug session page exposed in production | `app/debug/session/page.tsx` | 1-213 |
| 5 | **HIGH** | Registration endpoint creates passwordHash but no CredentialsProvider uses it | `app/api/auth/register/route.ts` | 59-79 |
| 6 | **MEDIUM** | Middleware session revocation gap -- revoked sessions pass middleware | `middleware.ts` | 134-143 |
| 7 | **MEDIUM** | `getServerSession` used in financial endpoints (offers, withdrawals, transactions) without session revocation | Multiple (see Finding 7) | Various |
| 8 | **MEDIUM** | Missing authentication on `GET /api/listings/[slug]/purchase-partners` | `app/api/listings/[slug]/purchase-partners/route.ts` | 1-109 |
| 9 | **MEDIUM** | Twitter disconnect lacks CSRF protection for state-changing POST | `app/api/auth/twitter/disconnect/route.ts` | 8-37 |
| 10 | **MEDIUM** | In-memory rate limiting fallback in production provides no real protection | `lib/rate-limit.ts` | 126-134 |
| 11 | **MEDIUM** | Middleware allows GET requests to `/api/agent/*` without auth | `middleware.ts` | 182-199 |
| 12 | **LOW** | Password complexity requirements lack special character mandate | `lib/validation.ts` | 207-227 |
| 13 | **LOW** | Admin check relies on `isAdmin` boolean field in JWT -- potential stale token | `lib/auth.ts` | 452-462 |
| 14 | **LOW** | Referral code generation uses only 4 random bytes (32-bit entropy) | `lib/auth.ts` | 36 |
| 15 | **LOW** | `looksEncrypted` heuristic in encryption module could mask failed encryption | `lib/encryption.ts` | 94-102 |
| 16 | **INFO** | Well-implemented: CSRF double-submit cookie with HMAC signing | `lib/csrf.ts` | 29-77 |
| 17 | **INFO** | Well-implemented: API key hashing with bcrypt (12 rounds) | `lib/agent-auth.ts` | 77-79 |
| 18 | **INFO** | Well-implemented: Wallet signature replay protection with nonce tracking | `lib/validation.ts` | 232-276 |
| 19 | **INFO** | Well-implemented: Timing-safe comparisons for secret validation | `middleware.ts`, `lib/cron-auth.ts`, `lib/agent-auth.ts` | Various |
| 20 | **INFO** | Well-implemented: Session revocation with database-backed blacklist | `lib/auth.ts` | 57-127 |

---

## Detailed Findings

---

### Finding 1: CRITICAL -- Mint Keypair Secret Key Leaked to Client

**File:** `/home/user/App-Market/app/api/token-launch/deploy/route.ts`
**Line:** 176

**Description:**
The `/api/token-launch/deploy` endpoint returns the full secret key bytes of a Solana mint keypair to the client in the API response body. This private key is decrypted from the database (where it is stored encrypted) and then sent in plaintext to the browser:

```typescript
// Line 176
mintKeypairBytes: Array.from(decryptedKeypair.secretKey),
```

While the comment says "the mint keypair must sign the pool creation tx," sending the entire secret key to the client means any interceptor (proxy, browser extension, logging middleware, XSS) can capture it. This keypair controls the token mint authority.

**Impact:** If the keypair is intercepted, an attacker could mint arbitrary tokens, undermining the entire token launch integrity.

**Recommended Fix:**
- Sign the transaction server-side using the mint keypair, rather than sending the secret key to the client
- If client-side signing is absolutely required, use a one-time ephemeral key and verify the transaction server-side before broadcasting

---

### Finding 2: HIGH -- 26 Route Files Use `getServerSession` Bypassing Session Revocation

**Files:** 26 route files (listed below)
**Description:**
The codebase implements two auth patterns:

1. `getAuthToken(request)` -- Reads the JWT, then checks the `RevokedSession` database table (line 155 of `lib/auth.ts`). This is the **secure** pattern.
2. `getServerSession(authOptions)` -- Uses NextAuth's built-in session resolution. This does **NOT** check session revocation.

The following 26 route files use `getServerSession` and therefore will honor sessions that have been revoked:

| Route File | Operations |
|---|---|
| `app/api/admin/audit-logs/route.ts` | GET (admin) |
| `app/api/admin/reset-listings/route.ts` | DELETE (admin, destructive) |
| `app/api/disputes/route.ts` | GET, POST |
| `app/api/disputes/[id]/route.ts` | GET, POST |
| `app/api/listings/[slug]/required-info/route.ts` | GET, POST |
| `app/api/offers/route.ts` | GET, POST |
| `app/api/offers/[offerId]/accept/route.ts` | POST (financial) |
| `app/api/offers/[offerId]/cancel/route.ts` | POST |
| `app/api/profile/upload-picture/route.ts` | POST, DELETE |
| `app/api/purchase-partners/invites/route.ts` | GET |
| `app/api/referrals/route.ts` | GET, POST |
| `app/api/token-launch/route.ts` | GET, POST |
| `app/api/token-launch/[id]/route.ts` | GET, PUT |
| `app/api/token-launch/claim-fees/route.ts` | POST (financial) |
| `app/api/token-launch/deploy/route.ts` | POST (financial, deploys on-chain) |
| `app/api/transactions/[id]/buyer-info/route.ts` | GET, POST |
| `app/api/transactions/[id]/confirm/route.ts` | POST (financial) |
| `app/api/transactions/[id]/partners/route.ts` | GET, POST, PUT, DELETE |
| `app/api/transactions/[id]/partners/[partnerId]/deposit/route.ts` | POST (financial) |
| `app/api/transactions/[id]/partners/[partnerId]/transfer-lead/route.ts` | POST |
| `app/api/transactions/[id]/uploads/route.ts` | POST |
| `app/api/user/profile/route.ts` | GET, PUT |
| `app/api/user/profile/image/route.ts` | POST, DELETE |
| `app/api/user/stats/route.ts` | GET |
| `app/api/withdrawals/route.ts` | GET |
| `app/api/withdrawals/[withdrawalId]/claim/route.ts` | POST (financial) |

**Impact:** If an admin revokes a user's session (e.g., after account compromise), the user can still perform financial operations, file disputes, accept offers, claim withdrawals, and deploy tokens via any route that uses `getServerSession`.

**Recommended Fix:**
- Migrate all 26 route files from `getServerSession(authOptions)` to `getAuthToken(request)` which checks the revocation blacklist
- Alternatively, create a wrapper function that calls `getServerSession` and then performs the revocation check

---

### Finding 3: HIGH -- CSRF Protection Missing on Most State-Changing Endpoints

**Files:** Most POST/PUT/DELETE endpoints
**Description:**
CSRF protection (via `validateCsrfRequest`) is only applied to **4 out of approximately 40+** state-changing POST/PUT/DELETE endpoints:

**Protected (4 routes):**
- `POST /api/listings` (create listing)
- `POST /api/bids` (place bid)
- `POST /api/offers` (create offer)
- `POST /api/transactions` (create transaction)

**NOT protected (examples of high-impact routes):**
- `POST /api/offers/[offerId]/accept` -- Accept offer (creates transaction)
- `POST /api/withdrawals/[withdrawalId]/claim` -- Claim withdrawal (financial)
- `POST /api/token-launch/deploy` -- Deploy token on-chain
- `POST /api/disputes` -- Open dispute
- `POST /api/transactions/[id]/confirm` -- Confirm asset transfer
- `PUT /api/profile` -- Update profile
- `POST /api/messages` -- Send messages
- `POST /api/reviews` -- Submit reviews
- `POST /api/listings/[slug]/cancel` -- Cancel listing
- `POST /api/auth/twitter/disconnect` -- Disconnect Twitter
- `POST /api/agent/keys` -- Create API keys
- All transfer-related POST endpoints

The middleware comment (line 79-82 of `middleware.ts`) notes that CSRF relies on SameSite=Lax cookies and JSON Content-Type. While SameSite=Lax prevents cross-site cookie submission on top-level navigations, it does NOT protect against:
- Subresource requests from attacker sites using `fetch()` with `credentials: 'include'` (blocked by CORS, but misconfiguration could bypass)
- Attacker scripts already running on the same site (e.g., XSS)

**Impact:** If CORS is misconfigured or an XSS vulnerability exists, the lack of CSRF tokens on most endpoints means cross-site requests could accept offers, claim withdrawals, deploy tokens, etc.

**Recommended Fix:**
- Apply `validateCsrfRequest` consistently to ALL state-changing (POST/PUT/PATCH/DELETE) endpoints
- Or implement CSRF validation in the middleware layer so it applies globally to all non-GET requests

---

### Finding 4: HIGH -- Debug Session Page Exposed in Production

**File:** `/home/user/App-Market/app/debug/session/page.tsx`
**Lines:** 1-213

**Description:**
A debug page at `/debug/session` is present in the codebase with no access control. It displays:
- Full session data (user ID, email, name, wallet address)
- Cookie values visible in the browser
- API session endpoint response

This page is not in the `PROTECTED_ROUTES` list in the middleware, so it is publicly accessible without authentication. While the page uses client-side `useSession()` which only shows data for authenticated users, its very existence in production:
1. Reveals the internal session structure to potential attackers
2. Could be used for session debugging/reconnaissance
3. Leaks session cookie names and authentication flow details

**Impact:** Information disclosure aiding targeted attacks.

**Recommended Fix:**
- Remove the `/debug/session` route entirely from production builds
- If needed for development, gate it behind `process.env.NODE_ENV === 'development'` or move it to a separate debug-only build
- At minimum, add `/debug` to the `PROTECTED_ROUTES` and `ADMIN_ROUTES` lists in `middleware.ts`

---

### Finding 5: HIGH -- Registration Endpoint Creates Orphaned Password Hashes

**File:** `/home/user/App-Market/app/api/auth/register/route.ts`
**Lines:** 59-79

**Description:**
The registration endpoint at `POST /api/auth/register` accepts email/password, validates password complexity, hashes the password with bcrypt (12 rounds), and stores it as `passwordHash` on the User model. However, the NextAuth configuration in `lib/auth.ts` only defines two CredentialsProviders:
1. `"wallet"` -- Authenticates via Solana wallet signature
2. `"privy"` -- Authenticates via Privy token

There is **no email/password CredentialsProvider** configured. This means:
- Users can register with email/password
- But they can never sign in with those credentials
- The `passwordHash` field is written to the database but never used for authentication

**Impact:** Users who register via email/password are unable to authenticate. This is a functional bug with security implications -- password hashes are stored but the authentication path is broken/incomplete.

**Recommended Fix:**
- Either add an email/password CredentialsProvider to `authOptions.providers` in `lib/auth.ts`
- Or remove the registration endpoint if email/password login is not intended
- If the endpoint is kept but unused, it creates an unnecessary attack surface for credential stuffing

---

### Finding 6: MEDIUM -- Middleware Cannot Check Session Revocation

**File:** `/home/user/App-Market/middleware.ts`
**Lines:** 134-143

**Description:**
The middleware (which runs in Edge Runtime) uses `getToken()` from NextAuth to validate the JWT. However, as noted in the comment on line 140-143:

```typescript
// NOTE: Session revocation is checked in API route handlers via getAuthToken().
// Middleware uses getToken() which does not check revocation because Prisma
// is not available in Edge Runtime. This is defense-in-depth...
```

This means a revoked session will still pass the middleware checks. The user will receive a valid 200 response from the middleware, and only the route handler (if it uses `getAuthToken`) will reject it. However, as documented in Finding 2, 26 route files do NOT use `getAuthToken`, so the revocation check never happens.

**Impact:** Revoked sessions can access protected dashboard pages (rendered by Next.js SSR) and 26 API routes.

**Recommended Fix:**
- Use an Edge-compatible database client (e.g., Prisma with Edge runtime adapter, or a direct REST/HTTP call to a revocation check endpoint) in the middleware
- Alternatively, maintain a short-lived in-memory cache of recently revoked session IDs in the middleware, synced periodically

---

### Finding 7: MEDIUM -- Financial Endpoints Use `getServerSession` Without Revocation Check

**Files:** See below
**Description:**
The following endpoints handle financial operations but use `getServerSession` instead of `getAuthToken`, meaning revoked sessions can still execute these actions:

| Endpoint | Action |
|---|---|
| `POST /api/offers/[offerId]/accept` | Accept offer, create transaction |
| `POST /api/withdrawals/[withdrawalId]/claim` | Claim pending withdrawal |
| `POST /api/token-launch/deploy` | Deploy token on Solana blockchain |
| `POST /api/token-launch/claim-fees` | Claim trading fees |
| `POST /api/transactions/[id]/confirm` | Confirm asset transfer (releases escrow) |
| `POST /api/transactions/[id]/partners/[partnerId]/deposit` | Record partner deposit |

**Impact:** A compromised account whose session has been revoked by an admin can still claim withdrawals, accept offers, deploy tokens, and confirm transfers.

**Recommended Fix:**
- Migrate these routes to use `getAuthToken(request)` which performs the revocation check
- These are highest priority for migration due to their financial impact

---

### Finding 8: MEDIUM -- Missing Authentication on Purchase Partners Endpoint

**File:** `/home/user/App-Market/app/api/listings/[slug]/purchase-partners/route.ts`
**Lines:** 1-109

**Description:**
The `GET /api/listings/[slug]/purchase-partners` endpoint has no authentication check. It does not call `getAuthToken`, `getServerSession`, or any auth verification. It returns partner information including:
- Partial wallet addresses (truncated, but still present)
- User IDs, usernames, display names, profile images
- Deposit amounts, deposit status
- Transaction status

While the middleware does protect `/api/listings/*` for non-GET requests, GET requests to `/api/listings/*` are explicitly allowed without auth (line 185 of `middleware.ts`).

**Impact:** Any unauthenticated user can enumerate purchase partner details for any listing.

**Recommended Fix:**
- Add authentication to this endpoint
- At minimum, verify the requesting user is the seller, buyer, or a partner in the transaction

---

### Finding 9: MEDIUM -- Twitter Disconnect Lacks CSRF Protection

**File:** `/home/user/App-Market/app/api/auth/twitter/disconnect/route.ts`
**Lines:** 8-37

**Description:**
The `POST /api/auth/twitter/disconnect` endpoint removes the user's Twitter link (sets twitterId, twitterUsername, twitterVerified to null). It requires authentication but has no CSRF validation. This is a state-changing POST that modifies the user's profile.

Similarly, other profile-modifying routes like `PUT /api/profile`, `POST /api/profile/upload-picture`, and `POST /api/messages` lack CSRF protection.

**Impact:** If an attacker can trigger a POST to this endpoint (via XSS or CSRF in a misconfigured environment), they can disconnect a user's Twitter verification -- which is required for writing reviews.

**Recommended Fix:**
- Add `validateCsrfRequest` to this and other state-changing endpoints

---

### Finding 10: MEDIUM -- In-Memory Rate Limiting Fallback in Production

**File:** `/home/user/App-Market/lib/rate-limit.ts`
**Lines:** 126-134

**Description:**
When Upstash Redis is not configured, the rate limiter falls back to an in-memory store. The code logs a warning but **does not refuse to operate** in production:

```typescript
if (process.env.NODE_ENV === "production") {
  console.error(
    "CRITICAL: Rate limiting falling back to in-memory in production!..."
  );
}
```

In a serverless environment (Vercel), in-memory rate limiting is ineffective because:
- Each function invocation has its own memory space
- The rate limit counter resets with every cold start
- Concurrent invocations do not share state

**Impact:** If Upstash is not configured in production, rate limiting provides essentially no protection, enabling brute-force attacks on auth endpoints and rapid-fire bid/offer spam.

**Recommended Fix:**
- Throw an error and refuse to start in production if Upstash is not configured
- Or implement a hard fallback that rejects all requests when distributed rate limiting is unavailable

---

### Finding 11: MEDIUM -- Middleware Allows Unauthenticated GET to Agent API

**File:** `/home/user/App-Market/middleware.ts`
**Lines:** 182-199

**Description:**
The middleware's `isPublicRead` logic only blocks non-GET requests to protected API routes. The `/api/agent` prefix is in the `PROTECTED_API_ROUTES` list, but any GET request to `/api/agent/*` will pass through the middleware without authentication.

While individual agent route handlers check auth via `authenticateAgent()`, the middleware layer provides no protection for GET requests. This means unauthenticated GET requests reach the route handlers, relying entirely on handler-level auth checks.

**Impact:** If any agent GET endpoint has a bug where it forgets to call `authenticateAgent()`, it would be publicly accessible. This is a defense-in-depth concern.

**Recommended Fix:**
- Remove `/api/agent` from the generic public-read bypass logic
- Or add an explicit check: GET requests to `/api/agent/*` should require auth at the middleware level

---

### Finding 12: LOW -- Password Complexity Lacks Special Character Requirement

**File:** `/home/user/App-Market/lib/validation.ts`
**Lines:** 207-227

**Description:**
The `validatePasswordComplexity` function requires:
- Minimum 8 characters
- Maximum 128 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

It does **not** require a special character. While NIST SP 800-63B (2024) actually recommends against mandatory special characters, the minimum length of 8 characters is on the low end. NIST recommends a minimum of 8 but suggests allowing up to 64+ characters and checking against a breached password list.

**Impact:** Passwords like `Password1` would pass validation. Without a breached password check, commonly-used passwords are allowed.

**Recommended Fix:**
- Consider increasing minimum length to 10-12 characters
- Implement a breached password check (e.g., HaveIBeenPwned API) during registration
- These are improvements, not urgent vulnerabilities

---

### Finding 13: LOW -- Admin Status Refreshed on JWT Callback but Stale Between Requests

**File:** `/home/user/App-Market/lib/auth.ts`
**Lines:** 452-462

**Description:**
The JWT callback re-checks `isAdmin` from the database on every JWT refresh (line 452-462). This is good practice. However, JWT tokens are valid for up to 7 days, and the `isAdmin` status is only refreshed when the JWT callback runs (which happens on session access, not on every request).

The middleware reads `token.isAdmin` directly from the JWT (line 157), which could be stale if the admin status was revoked between JWT refreshes.

The codebase mitigates this well in the route handlers -- admin routes like `audit-logs` and `reset-listings` perform a fresh database check for `isAdmin`. The middleware check is a first layer, and the route handler provides the authoritative check.

**Impact:** Low -- there is a brief window where a demoted admin could pass the middleware check, but the route handler would block them. This is defense-in-depth working correctly.

**Recommended Fix:**
- This is adequately mitigated by the double-check pattern. No urgent action needed.
- For additional hardening, consider shorter JWT expiry times (e.g., 1 hour) with silent refresh

---

### Finding 14: LOW -- Referral Code Low Entropy

**File:** `/home/user/App-Market/lib/auth.ts`
**Line:** 36

**Description:**
Referral codes are generated with `crypto.randomBytes(4).toString("hex")`, producing 8 hex characters (32 bits of entropy). With ~4 billion possible codes, this is adequate for referral codes (which are not security-sensitive), but collision probability increases as users grow.

The code does check for uniqueness in the database (in `wallet-verification.ts`), but a retry loop with max 5 attempts could fail at scale.

**Impact:** Low -- referral codes are not a security mechanism. Collision handling could fail at very large scale.

**Recommended Fix:**
- Consider increasing to 6 bytes (48 bits) for better collision resistance
- This is a minor improvement, not a security vulnerability

---

### Finding 15: LOW -- `looksEncrypted` Heuristic Could Mask Encryption Failures

**File:** `/home/user/App-Market/lib/encryption.ts`
**Lines:** 94-102

**Description:**
The `looksEncrypted` function checks if data is base64-encoded and exceeds a minimum length. This heuristic is used in `account-token-encryption.ts` to avoid double-encryption. However, any base64 string longer than 64 bytes would be considered "encrypted," potentially causing the system to skip encryption of data that was never actually encrypted.

**Impact:** Low -- the decrypt function would fail with an auth tag mismatch if data is not properly encrypted, so the heuristic would cause a runtime error rather than a silent security failure.

**Recommended Fix:**
- Add a known prefix to encrypted data (e.g., `enc:`) to make detection deterministic rather than heuristic

---

## Positive Findings (Well-Implemented Security Controls)

### Finding 16: CSRF Double-Submit Cookie with HMAC

**File:** `/home/user/App-Market/lib/csrf.ts`
**Lines:** 29-77

The CSRF implementation uses a proper double-submit cookie pattern with HMAC-SHA256 signing and timing-safe comparison. Tokens include timestamps and expire after 24 hours. The cookie uses `__Host-` prefix, `secure` flag in production, and `sameSite: "strict"`. This is a solid implementation -- it just needs to be applied to more endpoints (see Finding 3).

---

### Finding 17: API Key Hashing with Bcrypt

**File:** `/home/user/App-Market/lib/agent-auth.ts`
**Lines:** 77-79

API keys are hashed with bcrypt at 12 rounds before storage. Verification uses `bcrypt.compare`. Only the key prefix (first 12 chars) is stored in plaintext for fast lookup. This is an industry-standard approach.

---

### Finding 18: Wallet Signature Replay Protection

**File:** `/home/user/App-Market/lib/validation.ts`
**Lines:** 232-276

The wallet signature validation includes:
- Message format validation (expected prefix string)
- Wallet address verification (message must contain the authenticating wallet)
- Timestamp validation (5-minute window)
- One-time nonce tracking via Redis (production) or in-memory (development)
- Each wallet+timestamp combination can only be used once

This effectively prevents replay attacks.

---

### Finding 19: Timing-Safe Secret Comparisons

**Files:** `middleware.ts` (lines 115-121), `lib/cron-auth.ts` (line 28), `lib/agent-auth.ts` (line 360)

All secret comparisons (CRON_SECRET, WEBHOOK_SECRET, ADMIN_SECRET) use `crypto.timingSafeEqual()` with length pre-checks to prevent timing attacks. The implementation is consistent across the codebase.

---

### Finding 20: Database-Backed Session Revocation

**File:** `/home/user/App-Market/lib/auth.ts`
**Lines:** 57-127

The session revocation system is well-designed:
- Unique session IDs generated with 32 random bytes
- Revocations stored in database (works across serverless instances)
- Revocation records auto-expire after 7 days (matching JWT max age)
- `revokeAllUserSessions` function for emergency account lockout
- Cleanup function for expired revocation records

The weakness is that not all route handlers use `getAuthToken()` to check the revocation list (see Finding 2).

---

## Architecture Overview

### Authentication Methods

| Method | Provider | Implementation |
|---|---|---|
| Solana Wallet | NextAuth CredentialsProvider `"wallet"` | Signature verification via `nacl.sign.detached.verify` |
| Privy (email/Twitter/wallet) | NextAuth CredentialsProvider `"privy"` | Server-side token verification via `privyClient.verifyAuthToken` |
| API Key | Custom (agent-auth.ts) | Bcrypt-hashed keys with prefix-based lookup |
| Agent Wallet Signature | Custom (agent-auth.ts) | Ed25519 signature with 30-second timestamp window |
| Email/Password | Registration exists, but no auth provider | **Broken path -- see Finding 5** |

### Session Management

- **Strategy:** JWT (not database sessions)
- **Max Age:** 7 days
- **Cookie:** `__Secure-next-auth.session-token` (production) / `next-auth.session-token` (development)
- **Cookie Attributes:** `httpOnly: true`, `sameSite: "lax"`, `secure: true` (production), `path: "/"`
- **Session Revocation:** Database-backed blacklist checked by `getAuthToken()` (but not by `getServerSession()`)

### Authorization Layers

1. **Middleware (Edge Runtime):** Checks JWT presence and `isAdmin` flag for route-level protection
2. **Route Handlers:** Check auth via `getAuthToken()` or `getServerSession()`, then verify resource ownership
3. **Admin Routes:** Double-check `isAdmin` in database after JWT check
4. **Cron Routes:** Require `CRON_SECRET` in Authorization header (checked by both middleware and handler)
5. **Agent API:** Custom auth via API key or wallet signature with permission-based access control

---

## Recommendations Priority

### Immediate (CRITICAL/HIGH)

1. **Remove mint keypair from API response** in `token-launch/deploy/route.ts`. Sign the transaction server-side.
2. **Migrate all 26 `getServerSession` routes to `getAuthToken`** to enforce session revocation consistently.
3. **Add CSRF validation to all state-changing endpoints** or implement it in middleware.
4. **Remove or restrict the debug session page** at `/debug/session`.
5. **Fix or remove the orphaned registration endpoint** at `/api/auth/register`.

### Short-Term (MEDIUM)

6. Add authentication to `GET /api/listings/[slug]/purchase-partners`.
7. Investigate Edge-compatible session revocation for the middleware layer.
8. Ensure production deployments have Upstash Redis configured (or fail hard if not).
9. Add `/api/agent` routes to middleware auth requirements for GET requests.

### Long-Term (LOW)

10. Consider breached password checking for the registration flow.
11. Implement token refresh with shorter JWT expiry times.
12. Add a deterministic prefix to encrypted data instead of relying on `looksEncrypted`.
