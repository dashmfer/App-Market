# Differential Security Review Report

**Project:** App Market - Solana-based Software Marketplace
**Reviewer:** Trail of Bits Differential Review Skill
**Date:** 2026-02-27
**Scope:** All security-related changes from commits `1986461` through `d4fb743` (HEAD)
**Commits analyzed:** ~20 security-specific commits across 4 rounds of fixes
**Files changed:** 173 files, +10,866 / -2,600 lines

---

## Executive Summary

The App Market codebase has undergone four rounds of security hardening. While the security posture has substantially improved (rate limiting, CSRF protection, timing-safe comparisons, replay protection, session revocation, audit logging, input validation), this review identified **3 CRITICAL**, **5 HIGH**, **6 MEDIUM**, and **4 LOW** severity findings. The most concerning is a private key exposure in the token launch API response.

---

## 1. Risk Classification Table

| File | Risk | Category | Notes |
|------|------|----------|-------|
| `lib/auth.ts` | HIGH | Authentication, Session | JWT + Privy auth, session revocation |
| `lib/csrf.ts` | HIGH | CSRF protection | HMAC double-submit cookie |
| `lib/encryption.ts` | HIGH | Cryptography | AES-256-GCM with AAD |
| `lib/validation.ts` | HIGH | Input validation, Replay protection | Nonce tracking, state machines |
| `lib/agent-auth.ts` | HIGH | API authentication | API keys (bcrypt), wallet sig |
| `lib/rate-limit.ts` | HIGH | Rate limiting | Upstash Redis, prod enforcement |
| `lib/wallet-verification.ts` | HIGH | Auth, Wallet verification | Signature verification |
| `middleware.ts` | HIGH | Route protection | Auth gate, cron protection |
| `lib/cron-auth.ts` | HIGH | Cron authentication | Timing-safe comparison |
| `app/api/offers/[offerId]/accept/route.ts` | HIGH | Financial, Race conditions | Offer acceptance with escrow |
| `app/api/offers/route.ts` | HIGH | Financial | Offer creation, Serializable tx |
| `app/api/bids/route.ts` | HIGH | Financial, Auction | Bid placement with anti-snipe |
| `app/api/transfers/[id]/complete/route.ts` | HIGH | Financial, Escrow release | Transfer completion |
| `app/api/disputes/route.ts` | HIGH | Financial, Disputes | Dispute creation |
| `app/api/disputes/[id]/route.ts` | HIGH | Financial, Admin | Dispute resolution |
| `app/api/token-launch/deploy/route.ts` | **CRITICAL** | Crypto, Key exposure | Mint keypair leaked to client |
| `app/api/withdrawals/[withdrawalId]/claim/route.ts` | HIGH | Financial | Withdrawal claims |
| `app/api/listings/route.ts` | MEDIUM | Business logic | Listing creation |
| `app/api/listings/[slug]/route.ts` | MEDIUM | Business logic | Listing update |
| `app/api/github/verify/route.ts` | MEDIUM | SSRF risk | External API calls |
| `app/api/messages/route.ts` | MEDIUM | Content validation | Messaging |
| `app/api/user/profile/image/route.ts` | MEDIUM | File upload | Profile images |
| `app/api/webhooks/pool-graduation/route.ts` | MEDIUM | Webhook auth | Pool graduation |
| `programs/app-market/src/lib.rs` | HIGH | Smart contract | On-chain escrow logic |
| `lib/sol-price.ts` | MEDIUM | Oracle | Price feed |
| `lib/config.ts` | MEDIUM | Configuration | Fee structure |
| `lib/file-security.ts` | LOW | File validation | Upload security |
| `lib/audit.ts` | LOW | Logging | Audit trail |
| `lib/env-validation.ts` | LOW | Configuration | Env var checks |
| `next.config.js` | LOW | HTTP headers | CSP, HSTS, etc. |

---

## 2. Findings by Severity

### CRITICAL

#### C-1: Private Key Exposed in API Response (token-launch/deploy)

**File:** `/home/user/App-Market/app/api/token-launch/deploy/route.ts`, line 176
**Evidence:**
```typescript
// Include the vanity keypair bytes for the client to co-sign
// (the mint keypair must sign the pool creation tx)
mintKeypairBytes: Array.from(decryptedKeypair.secretKey),
```

**Description:** The token launch deploy endpoint decrypts the vanity mint keypair from the database and sends the **full 64-byte secret key** to the client in the JSON response. While the comment explains this is needed for the client to co-sign the pool creation transaction, this is a severe security issue:

1. The private key travels over the network and is visible in browser DevTools, network logs, and any proxy/CDN that caches responses.
2. Any XSS vulnerability would allow an attacker to steal mint keypairs.
3. The key is stored in browser memory and JavaScript heap, accessible to any malicious extension or script on the page.
4. CDN/proxy caching could inadvertently expose the key to other users.

**Recommendation:** The server should sign the transaction server-side using the vanity keypair and only return the partially-signed transaction to the client. The client then adds their own signature and submits. The private key should never leave the server.

---

#### C-2: Dispute Resolution Not Atomic with Fund Movement

**File:** `/home/user/App-Market/app/api/disputes/[id]/route.ts`, lines 82-143
**Evidence:**
```typescript
// Apply resolution
let newTransactionStatus = transaction.status;
let buyerRefund = 0;
let sellerPayout = 0;
// ...
// Update dispute
await prisma.dispute.update({...});
// Update transaction
await prisma.transaction.update({...});
```

**Description:** The dispute resolution endpoint calculates refund/payout amounts and updates the dispute and transaction status, but it does NOT actually execute the on-chain escrow release or refund. The `buyerRefund` and `sellerPayout` variables are computed but never used to trigger any actual fund transfer. This means:

1. An admin can "resolve" a dispute with "RELEASE_TO_SELLER" but the funds remain locked in escrow.
2. The database says "COMPLETED" while the on-chain state hasn't changed.
3. There is no mechanism to actually move the funds after dispute resolution.

Additionally, the dispute update and transaction update are NOT wrapped in a Prisma `$transaction`, so a failure between the two operations leaves the system in an inconsistent state.

**Recommendation:**
- Wrap dispute resolution in a Prisma `$transaction` block.
- Integrate on-chain escrow release/refund execution (similar to `executeOnChainRelease` in transfer complete).
- Add a reconciliation cron job that detects disputes marked resolved with funds still locked.

---

#### C-3: No On-Chain Verification Before Database State Transitions

**File:** `/home/user/App-Market/app/api/transfers/[id]/complete/route.ts`, lines 111-142
**Evidence:**
```typescript
// Execute on-chain escrow release if backend authority and listing on-chain data exist
let onChainTxSig: string | null = null;
// ...
if (!onChainTxSig) {
  console.error(`[Transfer Complete] On-chain release failed for transaction ${params.id}`);
  // Don't block completion if on-chain fails -- log for manual resolution
}
// Atomic status transition to prevent race conditions
const updateResult = await prisma.transaction.updateMany({...});
```

**Description:** The transfer completion proceeds even if the on-chain escrow release fails. The database marks the transaction as "COMPLETED" and the listing as "SOLD" regardless of whether the actual SOL transfer happened. This creates a state where the database says funds were released but the on-chain escrow still holds the funds.

**Recommendation:** Either:
- Make the on-chain release a requirement for completion, returning an error if it fails.
- Or implement a two-phase commit: mark as "PENDING_RELEASE" first, then "COMPLETED" only after on-chain confirmation.
- Add a reconciliation cron that checks for COMPLETED transactions with no `onChainTx` hash.

---

### HIGH

#### H-1: SSRF via GitHub Verification Endpoint

**File:** `/home/user/App-Market/app/api/github/verify/route.ts`, lines 37-48
**Evidence:**
```typescript
const repoResponse = await fetch(
  `https://api.github.com/repos/${owner}/${repo}`,
  { headers: { ... } }
);
```

**Description:** The `owner` and `repo` parameters are user-supplied strings interpolated directly into a URL. While this targets `api.github.com`, the `owner` and `repo` values are not validated for special characters. An attacker could potentially use path traversal (e.g., `owner=../../other-endpoint`) to make the server issue requests to unintended GitHub API endpoints. Additionally, the endpoint makes three sequential outbound HTTP requests (repo info, contents, commits) per API call, amplifying any abuse.

**Recommendation:**
- Validate `owner` and `repo` against `^[a-zA-Z0-9._-]+$` regex.
- Limit response body size when fetching external data.

---

#### H-2: Session Revocation Not Enforced in Middleware

**File:** `/home/user/App-Market/middleware.ts`, lines 134-141
**Evidence:**
```typescript
// NOTE: Session revocation is checked in API route handlers via getAuthToken().
// Middleware uses getToken() which does not check revocation because Prisma
// is not available in Edge Runtime.
```

**Description:** The middleware that protects all routes uses `getToken()` from next-auth, which only validates the JWT signature but does NOT check the session revocation database. This means a revoked session JWT will still pass middleware authentication. While individual API route handlers are supposed to use `getAuthToken()` which does check revocation, there is no guarantee all handlers do so, and the protected page routes (dashboard, settings, etc.) never perform a second check.

**Attack scenario:** An admin revokes a malicious user's sessions. The user's existing JWT continues to grant access to all protected pages (dashboard, settings, etc.) and any API routes that use `getServerSession()` instead of `getAuthToken()`.

**Recommendation:**
- Audit all API route handlers to ensure they use `getAuthToken()` not `getServerSession()`.
- Consider using a Redis-backed session store accessible from Edge Runtime for middleware-level revocation checks.
- Add a short JWT expiry (e.g., 15 minutes) with refresh token rotation to limit the window of revoked-but-valid tokens.

---

#### H-3: Multiple Auth Methods Create Inconsistent Session Checks

**Files:** Multiple API routes use different auth methods:
- `getAuthToken(request)` in: `bids`, `listings`, `transfers`, `messages`
- `getServerSession(authOptions)` in: `offers`, `disputes`, `withdrawals`, `profile/image`

**Description:** The codebase uses two different authentication methods inconsistently:
1. `getAuthToken(request)` - checks JWT token AND session revocation
2. `getServerSession(authOptions)` - checks session but does NOT check the revocation database

Routes using `getServerSession` are vulnerable to the session revocation bypass described in H-2. Financial routes like `/api/offers/[offerId]/accept` (line 33) and `/api/disputes` (line 80) use `getServerSession`.

**Recommendation:** Standardize on `getAuthToken()` for all API route handlers, especially financial operations.

---

#### H-4: Transfer Complete Route Missing CSRF Protection

**File:** `/home/user/App-Market/app/api/transfers/[id]/complete/route.ts`
**Evidence:** The POST handler starts directly with auth check at line 29, with no CSRF validation.

Compared to `offers/route.ts` (line 25: `validateCsrfRequest(req)`) and `bids/route.ts` (line 62: `validateCsrfRequest(request)`), the transfer complete endpoint - which releases escrow funds - has no CSRF protection.

**Also missing CSRF:** `seller-confirm`, `buyer-confirm`, `transfers/[id]/route.ts` (GET-only, acceptable), all `transfers/[id]/*` POST routes, `withdrawals/[withdrawalId]/claim`, `disputes/[id]` POST/PUT.

**Recommendation:** Add CSRF validation to all state-changing endpoints, especially financial ones.

---

#### H-5: Account Linking Without Verification Allows Account Takeover

**File:** `/home/user/App-Market/lib/auth.ts`, lines 260-300
**Evidence:**
```typescript
// Check if user exists by wallet address
if (credentials.walletAddress) {
  user = await prisma.user.findUnique({
    where: { walletAddress: credentials.walletAddress },
  });
  if (user) {
    // Link existing wallet user to Privy
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        privyUserId: credentials.privyUserId,
        authMethod: mapAuthMethod(credentials.authMethod),
      },
    });
  }
}
```

**Description:** When authenticating via Privy, if a user with the provided wallet address already exists, the code links that existing user to the Privy account. However, the Privy token only proves the Privy identity - it does NOT prove wallet ownership. The `walletAddress` comes from client-supplied `credentials.walletAddress`, and while the Privy token is verified, the wallet address binding is not.

**Attack scenario:** Attacker creates a Privy account (e.g., via email), then sends `walletAddress: <victim's_wallet>` in the credentials. The Privy token verifies the attacker's Privy identity, but the code links the victim's wallet-based account to the attacker's Privy ID. The attacker now controls the victim's account.

**Recommendation:** Only link a wallet address to a Privy account if the Privy user's verified linked wallets (from `verifiedClaims`) include that wallet address. Do not trust client-supplied wallet addresses for account linking.

---

### MEDIUM

#### M-1: In-Memory Nonce Store in Serverless Environment

**File:** `/home/user/App-Market/lib/validation.ts`, lines 8-46
**Evidence:**
```typescript
const usedSignatureNonces = new Map<string, number>();
```

**Description:** While the code correctly uses Redis (Upstash) for nonce tracking when configured, it falls back to an in-memory `Map` when Redis is not available. In a serverless environment (Vercel), each function instance has its own memory, making the in-memory fallback ineffective - two concurrent requests to different instances could both accept the same nonce.

The code does check for production Redis (env-validation.ts requires Upstash in production), but if Upstash becomes temporarily unavailable, the nonce check silently degrades to the in-memory fallback, re-enabling replay attacks.

**Recommendation:** If Redis is unavailable in production, the nonce check should fail closed (reject the request) rather than falling back to in-memory.

---

#### M-2: Collaborator Percentage Validation After Listing Creation

**File:** `/home/user/App-Market/app/api/listings/route.ts`, lines 538-548
**Evidence:**
```typescript
if (hasCollaborators) {
  const totalCollaboratorPercentage = collaborators.reduce(
    (sum: number, c: any) => sum + (Number(c.percentage) || 0), 0
  );
  if (totalCollaboratorPercentage > 100) {
    return NextResponse.json(
      { error: `Total collaborator percentage exceeds 100%` },
      { status: 400 }
    );
  }
```

**Description:** The collaborator percentage validation occurs AFTER the listing has already been created in the database (line 456). If the percentage exceeds 100%, the listing exists but the error response is returned. This creates an orphaned listing with no collaborators in a PENDING_COLLABORATORS state that will never resolve.

**Recommendation:** Move the collaborator percentage validation before the listing creation, or wrap both in a transaction and roll back.

---

#### M-3: Partial Refund Uses Hardcoded 50/50 Split

**File:** `/home/user/App-Market/app/api/disputes/[id]/route.ts`, lines 100-105
**Evidence:**
```typescript
case "PARTIAL_REFUND":
  // Split 50/50, dispute fee split proportionally
  buyerRefund = Number(transaction.salePrice) * 0.5 - (disputeFeeAmount * 0.5);
  sellerPayout = Number(transaction.salePrice) * 0.5 - Number(transaction.platformFee) * 0.5 - (disputeFeeAmount * 0.5);
```

**Description:** Partial refunds are always a hardcoded 50/50 split. The admin has no ability to specify a custom split (e.g., 70/30). This limits dispute resolution flexibility. Additionally, the `sellerPayout` calculation deducts `platformFee * 0.5` but the `buyerRefund` does not, meaning the sum of `buyerRefund + sellerPayout` does not equal `salePrice - disputeFee`, potentially leaving funds unaccounted.

**Recommendation:** Allow the admin to specify refund percentages. Verify that `buyerRefund + sellerPayout + totalFees = salePrice`.

---

#### M-4: CSP Allows unsafe-inline Scripts

**File:** `/home/user/App-Market/next.config.js`, line 77
**Evidence:**
```javascript
"script-src 'self' 'unsafe-inline'",
```

**Description:** The Content Security Policy allows `'unsafe-inline'` for scripts. This significantly weakens XSS protection since any injected inline script will execute. While Next.js often requires inline scripts for hydration, there are alternatives (nonce-based CSP).

**Recommendation:** Use nonce-based CSP with Next.js's built-in support (`nonce` attribute on Script components). At minimum, add `'strict-dynamic'` to limit inline script execution to only those generated by trusted scripts.

---

#### M-5: Wallet Ownership Verification Has Weak Domain Check

**File:** `/home/user/App-Market/lib/wallet-verification.ts`, lines 33-34
**Evidence:**
```typescript
if (!message.includes("App Market") && !message.includes("app-market")) {
  return { valid: false, error: "Invalid message format" };
}
```

**Description:** The `verifyWalletOwnership` function only checks if the signed message contains "App Market" or "app-market" as a substring. An attacker could create a message like "I authorize app-market.evil.com to drain my wallet" that would pass this check. The main `validateWalletSignatureMessage` in validation.ts has a much stricter check, but `verifyWalletOwnership` is used separately for collaborator verification.

**Recommendation:** Use a strict message format check (exact prefix match) rather than substring containment.

---

#### M-6: No Maximum Bid Amount Validation

**File:** `/home/user/App-Market/app/api/bids/route.ts`, lines 99-105
**Evidence:**
```typescript
// SECURITY: Validate amount is positive
if (typeof amount !== 'number' || amount <= 0) {
  return NextResponse.json(
    { error: "Amount must be a positive number" },
    { status: 400 }
  );
}
```

**Description:** While the offers route has a `MAX_OFFER_AMOUNT` cap of 1,000,000 SOL (to prevent overflow in fee calculations), the bids route has no upper bound. An extremely large bid amount could cause precision issues in fee calculations or overflow in downstream computations.

**Recommendation:** Add a `MAX_BID_AMOUNT` similar to the offers route.

---

### LOW

#### L-1: No Test Coverage for Security Changes

**Evidence:** The `tests/` directory only contains Solana smart contract tests (`app-market.ts`, `integration.ts`). There are zero test files (`*.test.ts`, `*.spec.ts`) for any of the API routes, authentication logic, CSRF validation, rate limiting, encryption, or input validation.

**Impact:** All security fixes from the 4 rounds of audits have no automated regression tests. Security invariants could silently break during future development.

**Recommendation:** Add test coverage for at minimum:
- Authentication flows (wallet, Privy, session revocation)
- CSRF token generation/validation
- Rate limiting behavior
- Input validation (wallet addresses, UUIDs, pagination)
- Transaction state machine transitions
- Authorization checks (only seller can accept offers, only buyer can complete transfer, etc.)

---

#### L-2: Debug Endpoints Still Present

**Files:** `/home/user/App-Market/app/api/debug/db-test/route.ts`, `/home/user/App-Market/app/api/test-session/route.ts`
**Description:** Debug/test endpoints are still in the codebase. While they may be blocked by middleware in production, they should be removed to reduce attack surface.

---

#### L-3: Verbose Error Logging May Leak PII

**File:** `/home/user/App-Market/lib/auth.ts`, lines 97, 116-117, 229, 241
**Description:** Several `console.log` statements log user creation, verification attempts, and referral information. While these are useful during development, in production they could leak PII into server logs.

---

#### L-4: HSTS Missing Preload Directive

**File:** `/home/user/App-Market/next.config.js`, line 64
**Evidence:**
```javascript
value: 'max-age=31536000; includeSubDomains',
```

**Description:** The HSTS header is missing the `preload` directive, preventing inclusion in browser HSTS preload lists.

---

## 3. Attack Scenarios

### Scenario 1: Account Takeover via Privy Linking (H-5)

1. Victim has an account created via wallet login with address `Abc123...`.
2. Attacker creates a Privy account via email login.
3. Attacker sends auth request with their valid Privy token and `walletAddress: "Abc123..."`.
4. Server verifies the Privy token (valid for attacker's Privy ID).
5. Server finds existing user by wallet `Abc123...` and links it to attacker's Privy ID.
6. Attacker now has full access to victim's account, including active listings and pending transactions.

### Scenario 2: Mint Keypair Theft via XSS (C-1)

1. Attacker finds an XSS vector (e.g., listing description, message content, stored XSS via any user-controlled field).
2. Victim (token launch creator) navigates to their token launch deploy page.
3. Malicious script intercepts the `/api/token-launch/deploy` response containing `mintKeypairBytes`.
4. Attacker exfiltrates the 64-byte secret key.
5. Attacker can now mint arbitrary tokens using the stolen mint authority.

### Scenario 3: Revoked Session Bypass (H-2 + H-3)

1. Admin detects a compromised account and revokes all sessions.
2. Attacker's JWT is added to the revocation database.
3. Attacker makes a request to `/api/offers/[id]/accept` which uses `getServerSession()` (does NOT check revocation).
4. The offer is accepted and the listing is marked as RESERVED despite the session being "revoked".

### Scenario 4: Double-Completion of Transfer (C-3)

1. Buyer clicks "Complete Transfer" - the on-chain release fails silently.
2. Database marks transaction as COMPLETED, listing as SOLD.
3. Funds remain locked in the on-chain escrow.
4. Neither buyer nor seller can retrieve the funds without admin intervention.
5. No automated system detects this inconsistency.

---

## 4. Test Coverage Gaps

| Security Feature | Test Coverage | Risk |
|-----------------|--------------|------|
| Authentication (wallet, Privy) | NONE | HIGH |
| Session revocation | NONE | HIGH |
| CSRF validation | NONE | HIGH |
| Rate limiting (Upstash + fallback) | NONE | MEDIUM |
| Input validation (all validators) | NONE | MEDIUM |
| Transaction state machine | NONE | HIGH |
| Authorization checks (ownership) | NONE | HIGH |
| Encryption/decryption round-trip | NONE | MEDIUM |
| Nonce replay protection | NONE | HIGH |
| Smart contract (Anchor tests exist) | PARTIAL | MEDIUM |

---

## 5. Positive Security Changes

The security audits introduced many valuable improvements:

1. **CSRF Protection:** Double-submit cookie pattern with HMAC signatures and timing-safe comparison.
2. **Rate Limiting:** Distributed rate limiting via Upstash Redis with production enforcement.
3. **Replay Protection:** Nonce tracking with atomic SET NX via Redis.
4. **Session Revocation:** Database-backed revocation with cleanup.
5. **Audit Logging:** Comprehensive audit trail for financial and admin operations.
6. **Timing-Safe Comparisons:** Used consistently across CSRF, cron auth, webhook verification.
7. **Encryption at Rest:** AES-256-GCM with AAD for OAuth tokens and sensitive data.
8. **Input Validation:** URL protocol validation, wallet address format validation, UUID validation, pagination sanitization.
9. **Smart Contract Hardening:** Checked math throughout, anti-snipe, bid spam prevention, withdrawal pattern, admin timelock, initialization frontrunning protection.
10. **CSP Headers:** Restrictive Content Security Policy (though with unsafe-inline).
11. **File Security:** Extension validation, magic byte verification, MIME type checks.
12. **Environment Validation:** Fail-fast on missing/weak secrets in production.

---

## 6. Recommendations Summary

### Immediate (Before Launch)

1. **C-1:** Remove `mintKeypairBytes` from the API response. Sign transactions server-side.
2. **C-2:** Wrap dispute resolution in `$transaction`. Add on-chain execution.
3. **C-3:** Either require on-chain success for completion, or implement a two-phase commit.
4. **H-5:** Verify wallet ownership through Privy's verified claims before account linking.
5. **H-4:** Add CSRF protection to all state-changing financial endpoints.

### Short-Term (Within 2 Weeks)

6. **H-2/H-3:** Standardize all route handlers on `getAuthToken()` for consistent revocation checks.
7. **H-1:** Validate GitHub owner/repo parameters against allowlisted character regex.
8. **M-1:** Fail closed when Redis is unavailable in production (reject nonce checks).
9. **M-2:** Move collaborator percentage validation before listing creation.
10. **M-6:** Add `MAX_BID_AMOUNT` to bids route.

### Medium-Term (Within 1 Month)

11. **L-1:** Add comprehensive test suites for all security-critical paths.
12. **M-4:** Implement nonce-based CSP to replace `unsafe-inline`.
13. **L-2:** Remove debug endpoints or gate them behind an env flag.
14. **M-5:** Strengthen wallet ownership verification message format check.
15. Add a reconciliation cron job that detects database/on-chain state inconsistencies.

---

## Appendix: Files Reviewed

### HIGH Risk (Deep Analysis)
- `/home/user/App-Market/lib/auth.ts`
- `/home/user/App-Market/lib/csrf.ts`
- `/home/user/App-Market/lib/rate-limit.ts`
- `/home/user/App-Market/lib/validation.ts`
- `/home/user/App-Market/lib/encryption.ts`
- `/home/user/App-Market/lib/wallet-verification.ts`
- `/home/user/App-Market/lib/agent-auth.ts`
- `/home/user/App-Market/lib/cron-auth.ts`
- `/home/user/App-Market/lib/account-token-encryption.ts`
- `/home/user/App-Market/lib/solana-contract.ts`
- `/home/user/App-Market/lib/config.ts`
- `/home/user/App-Market/middleware.ts`
- `/home/user/App-Market/app/api/offers/route.ts`
- `/home/user/App-Market/app/api/offers/[offerId]/accept/route.ts`
- `/home/user/App-Market/app/api/bids/route.ts`
- `/home/user/App-Market/app/api/transfers/[id]/complete/route.ts`
- `/home/user/App-Market/app/api/transfers/[id]/seller-confirm/route.ts`
- `/home/user/App-Market/app/api/transfers/[id]/route.ts`
- `/home/user/App-Market/app/api/disputes/route.ts`
- `/home/user/App-Market/app/api/disputes/[id]/route.ts`
- `/home/user/App-Market/app/api/withdrawals/[withdrawalId]/claim/route.ts`
- `/home/user/App-Market/app/api/token-launch/deploy/route.ts`
- `/home/user/App-Market/app/api/listings/route.ts`
- `/home/user/App-Market/app/api/listings/[slug]/route.ts`
- `/home/user/App-Market/programs/app-market/src/lib.rs`

### MEDIUM Risk (Standard Analysis)
- `/home/user/App-Market/app/api/github/verify/route.ts`
- `/home/user/App-Market/app/api/messages/route.ts`
- `/home/user/App-Market/app/api/messages/[conversationId]/route.ts`
- `/home/user/App-Market/app/api/user/profile/image/route.ts`
- `/home/user/App-Market/app/api/webhooks/pool-graduation/route.ts`
- `/home/user/App-Market/app/api/admin/audit-logs/route.ts`
- `/home/user/App-Market/app/api/withdrawals/route.ts`
- `/home/user/App-Market/lib/sol-price.ts`
- `/home/user/App-Market/lib/file-security.ts`
- `/home/user/App-Market/lib/audit.ts`

### LOW Risk (Spot Checked)
- `/home/user/App-Market/lib/env-validation.ts`
- `/home/user/App-Market/next.config.js`
- `/home/user/App-Market/app/api/debug/db-test/route.ts`
- `/home/user/App-Market/app/api/test-session/route.ts`
