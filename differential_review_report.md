# Security Fix Differential Review Report

**Date:** 2026-03-01
**Scope:** Security fix commits on current branch vs `origin/main`
**Commits reviewed:** 11 commits (`f52bf72..8323781`)
**Focus:** Regressions, incomplete fixes, new vulnerabilities, and inconsistencies introduced by the security fix commits themselves

---

## Executive Summary

The security fix branch introduces meaningful improvements: constant-time comparisons with buffer padding, CSRF protection on many endpoints, `getAuthToken` migration for session revocation, private key removal from API responses, integer-precision fee math, nonce replay protection, and encryption format versioning. However, the fixes are **applied inconsistently**, creating a patchwork where some endpoints are hardened and adjacent, equally-sensitive endpoints are not. This inconsistency is itself a security concern because it creates false confidence that the codebase has been comprehensively secured.

**Summary of findings:**
- **3 HIGH** severity issues (new regressions or dangerous gaps introduced by partial fixes)
- **5 MEDIUM** severity issues (incomplete patterns leaving exploitable gaps)
- **4 LOW** severity issues (minor regressions, style issues, edge cases)

---

## HIGH Severity Findings

### H-1: CSP Regression -- `unsafe-eval` Added to Content-Security-Policy

**File:** `/home/user/App-Market/next.config.js`, line 78
**Commit:** `c220934` (comprehensive security fixes)

**Change:**
```diff
- "script-src 'self' 'unsafe-inline'",
+ "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
```

**Issue:** The security fix commit *added* `'unsafe-eval'` to the CSP `script-src` directive. This is a security **regression**, not a fix. `unsafe-eval` permits `eval()`, `Function()`, `setTimeout(string)`, and similar JavaScript code generation from strings, which is the primary attack vector for XSS exploitation. The comment says this is "needed for Next.js dev" but the CSP is applied to all routes including production.

**Impact:** Any XSS vector (e.g., injected HTML via user-generated content) can now execute arbitrary JavaScript through `eval()`. The original CSP with only `unsafe-inline` was already permissive; adding `unsafe-eval` makes it substantially weaker.

**Recommendation:** Remove `'unsafe-eval'` from the production CSP. If it is needed for development only, conditionally apply it:
```javascript
`script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ""}`,
```

---

### H-2: Auth Pattern Inconsistency -- `getServerSession` Still Used on Financial/State-Changing Endpoints

**Commit:** `c220934` migrated `offers/route.ts`, `offers/[offerId]/accept/route.ts`, and `withdrawals/route.ts` from `getServerSession` to `getAuthToken`. But numerous other state-changing endpoints were **not** migrated, despite the commit message saying "comprehensive security fixes."

**Endpoints still using `getServerSession` (no revocation checks):**

| Endpoint | Method | Financial? |
|----------|--------|-----------|
| `disputes/route.ts` | GET, POST | Yes (dispute creation) |
| `disputes/[id]/route.ts` | POST, PUT | Yes (dispute resolution, admin) |
| `withdrawals/[withdrawalId]/claim/route.ts` | POST | **Yes (fund claims)** |
| `offers/[offerId]/cancel/route.ts` | POST | Yes (offer cancellation) |
| `token-launch/route.ts` | POST | Yes (token launch creation) |
| `token-launch/deploy/route.ts` | POST | **Yes (on-chain deployment)** |
| `token-launch/claim-fees/route.ts` | POST | **Yes (fee claims)** |
| `token-launch/[id]/route.ts` | PATCH | Yes (token launch update) |
| `transactions/[id]/confirm/route.ts` | POST | Yes (transfer confirmation) |
| `transactions/[id]/buyer-info/route.ts` | POST | Yes |
| `transactions/[id]/uploads/route.ts` | POST | Yes |
| `transactions/[id]/partners/route.ts` | POST, DELETE, PATCH | Yes |
| `transactions/[id]/partners/[partnerId]/deposit/route.ts` | POST | **Yes (deposits)** |
| `transactions/[id]/partners/[partnerId]/transfer-lead/route.ts` | POST | Yes |
| `profile/upload-picture/route.ts` | POST, DELETE | No (but uses getServerSession) |
| `user/profile/route.ts` | PUT | No |
| `user/profile/image/route.ts` | POST, DELETE | No |
| `referrals/route.ts` | PATCH | No |
| `admin/reset-listings/route.ts` | DELETE | Yes (admin) |
| `listings/[slug]/required-info/route.ts` | PATCH | No |

**Impact:** A user whose session has been revoked (e.g., after account compromise detected by admin) can still execute financial operations on all the above endpoints. The fix created a two-tier authentication system where some endpoints respect revocation and others do not, with no clear pattern for which is which.

**Recommendation:** Migrate ALL endpoints from `getServerSession` to `getAuthToken`, or at minimum all financial/state-changing ones. The current partial migration is worse than no migration at all because it implies revocation works when it does not for critical paths.

---

### H-3: CSRF Protection Applied Inconsistently Across State-Changing Endpoints

**Commit:** `c220934` added CSRF validation to some POST/PUT/DELETE endpoints but missed many others of equal sensitivity.

**Endpoints WITH CSRF protection (from the fix):**

| Endpoint | Added by fix? |
|----------|--------------|
| `disputes/route.ts` POST | Yes |
| `messages/route.ts` POST | Yes |
| `profile/route.ts` PUT | Yes |
| `profile/upload-picture/route.ts` POST, DELETE | Yes |
| `reviews/route.ts` POST | Yes |
| `token-launch/route.ts` POST | Yes |
| `transfers/[id]/complete/route.ts` POST | Yes |
| `transfers/[id]/seller-confirm/route.ts` POST | Yes |
| `watchlist/route.ts` POST, DELETE | Yes |
| `withdrawals/[withdrawalId]/claim/route.ts` POST | Yes |

**Endpoints MISSING CSRF protection (not touched by fix):**

| Endpoint | Method | Sensitivity |
|----------|--------|-------------|
| `purchases/route.ts` | POST | **CRITICAL -- Buy Now (creates escrow transaction)** |
| `disputes/[id]/route.ts` | POST, PUT | **HIGH -- Admin dispute resolution** |
| `transactions/[id]/confirm/route.ts` | POST | HIGH -- Transfer confirmation |
| `transactions/[id]/buyer-info/route.ts` | POST | MEDIUM |
| `transactions/[id]/uploads/route.ts` | POST | MEDIUM |
| `transactions/[id]/partners/route.ts` | POST, DELETE, PATCH | HIGH -- Partner management |
| `transactions/[id]/partners/[partnerId]/deposit/route.ts` | POST | **HIGH -- Partner deposits** |
| `transactions/[id]/partners/[partnerId]/transfer-lead/route.ts` | POST | MEDIUM |
| `token-launch/deploy/route.ts` | POST | **HIGH -- On-chain deployment** |
| `token-launch/claim-fees/route.ts` | POST | **HIGH -- Fee claims** |
| `token-launch/[id]/route.ts` | PATCH | MEDIUM |
| `collaborators/[id]/respond/route.ts` | POST | MEDIUM |
| `listings/[slug]/collaborators/route.ts` | POST, DELETE, PATCH | MEDIUM |
| `listings/[slug]/required-info/route.ts` | PATCH | LOW |
| `listings/[slug]/nda/route.ts` | POST | LOW |
| `listings/[slug]/purchase-partners/route.ts` | POST | MEDIUM |
| `user/profile/route.ts` | PUT | LOW |
| `user/profile/image/route.ts` | POST, DELETE | LOW |
| `notifications/route.ts` | PATCH | LOW |
| `referrals/route.ts` | PATCH | LOW |
| `reviews/[id]/report/route.ts` | POST | LOW |
| `auth/wallet/verify/route.ts` | POST | MEDIUM |

**Impact:** The most critical gap is `purchases/route.ts` -- the "Buy Now" endpoint that creates escrow transactions. A CSRF attack on this endpoint could force a logged-in user to purchase a listing controlled by the attacker, locking the victim's funds in escrow.

---

## MEDIUM Severity Findings

### M-1: `solToLamportsBigInt` Crashes on Negative Numbers

**Files:** `/home/user/App-Market/lib/config.ts` (line 295), `/home/user/App-Market/lib/solana.ts` (line 141)

**Code:**
```typescript
function solToLamportsBigInt(sol: number): bigint {
  const [whole, decimal = ""] = sol.toString().split(".");
  const paddedDecimal = decimal.padEnd(9, "0").slice(0, 9);
  return BigInt(whole + paddedDecimal);
}
```

**Issue:** If `sol` is negative (e.g., `-1.5`), `toString()` produces `"-1"` and `"5"`, then `BigInt("-1" + "500000000")` produces `BigInt("-1500000000")` which is correct. However, if `sol` is `NaN`, `Infinity`, or `-Infinity`, `toString()` produces `"NaN"`, `"Infinity"`, or `"-Infinity"`, which will throw a `SyntaxError` from `BigInt()`. The function has no input validation.

While some callers validate their inputs (e.g., `bids/route.ts` now checks `Number.isFinite`), the fee calculation functions `calculatePlatformFee`, `calculateDisputeFee`, and `calculateSellerProceeds` are exported library functions that can be called from any context without pre-validation.

**Recommendation:** Add input guards to the conversion function:
```typescript
function solToLamportsBigInt(sol: number): bigint {
  if (!Number.isFinite(sol) || sol < 0) {
    throw new RangeError(`Invalid SOL amount: ${sol}`);
  }
  // ... existing logic
}
```

---

### M-2: Duplicate Fee Calculation Logic in `lib/config.ts` and `lib/solana.ts`

**Files:** `/home/user/App-Market/lib/config.ts` and `/home/user/App-Market/lib/solana.ts`

**Issue:** The security fix duplicated the `solToLamportsBigInt`/`lamportsToSolNumber` pattern into TWO separate files (`lib/config.ts` and `lib/solana.ts`), each with their own private copies of the same functions. Both files export `calculatePlatformFee`, `calculateDisputeFee`, and `calculateSellerProceeds`.

Different callers import from different modules. If one copy is fixed or updated (e.g., to add negative-number guards), the other may not be, causing divergent behavior across the codebase. This is a maintenance hazard that could re-introduce financial precision bugs.

**Recommendation:** Consolidate fee calculation into a single module and re-export from the other for backwards compatibility.

---

### M-3: Wallet Verification Message Validation Still Bypassable

**File:** `/home/user/App-Market/lib/wallet-verification.ts`, lines 33-38

**Change:**
```diff
- if (!message.includes("App Market") && !message.includes("app-market")) {
+ const validPrefixes = [
+   'Accept collaboration for "',
+   "Sign this message to prove you own this wallet",
+ ];
+ if (!validPrefixes.some(prefix => message.startsWith(prefix) || message.includes(`\n${prefix}`))) {
```

**Issue:** The fix replaced a loose `includes()` check with a prefix check, which is better. However, the `message.includes(\`\n${prefix}\`)` fallback still allows an attacker to embed the valid prefix after a newline in an otherwise attacker-controlled message. For example:
```
Malicious instruction to the user\nSign this message to prove you own this wallet
```
This is particularly dangerous because the message content before the newline could contain social-engineering text that tricks the user into believing they are signing something else. The wallet signature covers the entire message including the attacker-controlled first line.

**Recommendation:** Use only `startsWith()` without the `includes(\n...)` fallback, or validate the entire message structure rather than just the prefix.

---

### M-4: Encryption Format Migration -- `looksEncrypted` Legacy Fallback Is Overly Permissive

**File:** `/home/user/App-Market/lib/encryption.ts`, lines 115-127

**Change:** Added `"enc:v1:"` prefix for newly encrypted data, but `looksEncrypted()` still falls through to the legacy heuristic that returns `true` for any base64 string longer than 64 bytes.

**Issue:** The legacy heuristic is deliberately kept for backwards compatibility, but the comment says "will be removed after migration." There is no migration path defined, no tracking of which records use old vs. new format, and no deadline. Meanwhile, the heuristic will return `true` for many non-encrypted strings that happen to be long enough (e.g., base64-encoded images, long tokens, or other binary data). This can cause `decrypt()` to be called on non-encrypted data, which will throw an error (caught silently in `account-token-encryption.ts`), potentially masking data corruption.

**Recommendation:** Add logging when legacy format is detected so migration progress can be tracked, and define a deprecation timeline.

---

### M-5: `token.id as string` Type Assertion Without Validation

**Files:** Multiple files modified in the fix commit:
- `/home/user/App-Market/app/api/offers/[offerId]/accept/route.ts`, line 75
- `/home/user/App-Market/app/api/offers/route.ts`, lines 82, 91, etc.
- `/home/user/App-Market/app/api/withdrawals/route.ts`, line 22

**Code pattern:**
```typescript
if (offer.listing.sellerId !== token.id as string) {
```

**Issue:** The `as string` type assertion does not perform any runtime validation. If `token.id` were `undefined`, `null`, or a non-string type, the assertion would silently pass the type check but the comparison would evaluate incorrectly. While the preceding `!token?.id` check guards against `undefined`/`null`, the `as string` pattern is fragile -- if the guard is ever refactored away, the assertion provides no safety. Additionally, `token.id as string` has operator precedence issues: it parses as `(token.id) as string` which is fine in this context, but could be confusing and error-prone in more complex expressions.

**Recommendation:** Use `String(token.id)` for explicit conversion, or define a typed helper that returns a properly-typed user ID.

---

## LOW Severity Findings

### L-1: HSTS `preload` Added Without Verifying Submission

**File:** `/home/user/App-Market/next.config.js`, line 64

**Change:**
```diff
- value: 'max-age=31536000; includeSubDomains',
+ value: 'max-age=31536000; includeSubDomains; preload',
```

**Issue:** The `preload` directive tells browsers to include the domain in the HSTS preload list, but this requires the domain to be submitted to `hstspreload.org` and meet additional criteria (all subdomains must serve HTTPS). Adding the directive without submission has no effect, and if the domain has any HTTP-only subdomains, including `preload` could lock them out if the domain is eventually submitted.

**Recommendation:** Verify that all subdomains serve HTTPS before adding `preload`, and actually submit to the preload list.

---

### L-2: Agent Auth Nonce Redis Client Instantiated Per Request

**File:** `/home/user/App-Market/lib/agent-auth.ts`, lines 202-211

**Code:**
```typescript
let _nonceRedis: any = null;
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const { Redis } = await import("@upstash/redis");
    _nonceRedis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch { /* no redis */ }
```

**Issue:** The fix creates a new Redis client instance on every call to `verifyWalletSignature`. While Upstash's REST-based client is lightweight (HTTP-based, no persistent connection), instantiating it per-request adds unnecessary overhead and makes the nonce check's error handling inconsistent with the rest of the codebase (which likely has a shared Redis client).

**Recommendation:** Use a module-level singleton for the Redis client, consistent with how `lib/validation.ts` likely handles it.

---

### L-3: `require("crypto")` Used Instead of `import` in `lib/webhooks.ts`

**File:** `/home/user/App-Market/lib/webhooks.ts`, line 213

**Change:**
```typescript
const { randomBytes } = require("crypto");
return `evt_${Date.now()}_${randomBytes(8).toString("hex")}`;
```

**Issue:** The fix replaced `Math.random()` with `crypto.randomBytes()` (correct), but used `require()` instead of `import`. This is inconsistent with the rest of the codebase which uses ES module imports. In strict ESM environments (which Next.js may enforce in the future), `require()` may not be available. Other files in the same fix (e.g., `auth/register/route.ts`) correctly use `await import("crypto")`.

**Recommendation:** Use `import { randomBytes } from "crypto"` at the top of the file, or `await import("crypto")` if dynamic import is preferred.

---

### L-4: Non-Null Assertions on Values Already Guarded

**File:** `/home/user/App-Market/app/api/transfers/[id]/complete/route.ts`, lines 139-141

**Code:**
```typescript
onChainTxSig = await executeOnChainRelease(
  connection!,
  authority!,
  transaction.listing.onChainId!,
```

**Issue:** The `!` non-null assertions are applied to `connection`, `authority`, and `onChainId` which are already guaranteed non-null by the `requiresOnChainRelease` guard on line 123. While not a bug, excessive use of `!` assertions can mask future issues if the guard logic changes. This was introduced by the fix commit when refactoring the on-chain release logic.

**Recommendation:** Use proper narrowing (e.g., pass the values through the guard check) rather than `!` assertions.

---

## Positive Assessment of Fixes

The following security fixes are well-implemented and represent genuine improvements:

1. **Constant-time comparison padding** (`cron-auth.ts`, `middleware.ts`, `admin/reset-listings/route.ts`, `webhooks/pool-graduation/route.ts`, `twitter/callback/route.ts`): The buffer padding approach correctly eliminates length-leaking timing attacks. All four locations use a consistent pattern.

2. **Private key removal from API response** (`token-launch/deploy/route.ts`): Removing `mintKeypairBytes` from the response and adding server-side `partialSign` is the correct approach. This was a critical vulnerability in the original code.

3. **Privy auth hardening** (`lib/auth.ts`): Extracting verified wallet/email from Privy's server-side claims rather than trusting client-supplied credentials prevents account takeover attacks. The fix is thorough and well-commented.

4. **Integer fee arithmetic** (`lib/config.ts`, `lib/solana.ts`): The `solToLamportsBigInt` approach avoids floating-point precision loss in financial calculations. The string-parsing conversion method is sound for positive numbers.

5. **Dispute resolution atomicity** (`disputes/[id]/route.ts`): Wrapping dispute resolution and transaction update in `prisma.$transaction` prevents inconsistent state.

6. **Transfer completion -- fail on on-chain error** (`transfers/[id]/complete/route.ts`): Blocking completion when on-chain release fails (returning 502) prevents the database from marking funds as released when they are still in escrow.

7. **Nonce replay protection for agent auth** (`lib/agent-auth.ts`): Making nonce mandatory and adding Redis-backed replay detection closes a replay attack vector.

8. **Encryption format versioning** (`lib/encryption.ts`): The `"enc:v1:"` prefix is a meaningful improvement over the length-based heuristic for identifying encrypted data.

9. **SITE_URL production validation** (`env-validation.ts`, `twitter/callback/route.ts`, `twitter/connect/route.ts`): Requiring HTTPS for `NEXT_PUBLIC_SITE_URL` in production and removing devnet fallbacks prevents accidental use of insecure configurations.

10. **`Number.isFinite` and upper bound on bids** (`bids/route.ts`): Preventing `Infinity` and extremely large numbers from corrupting fee calculations.

---

## Summary of Action Items

| Priority | Finding | Action Required |
|----------|---------|-----------------|
| **HIGH** | H-1: CSP `unsafe-eval` regression | Remove `unsafe-eval` from production CSP |
| **HIGH** | H-2: `getServerSession` on financial endpoints | Migrate all financial endpoints to `getAuthToken` |
| **HIGH** | H-3: Missing CSRF on `purchases/route.ts` et al. | Add CSRF to all remaining POST/PUT/DELETE/PATCH endpoints |
| MEDIUM | M-1: `solToLamportsBigInt` crashes on NaN/Infinity | Add input validation |
| MEDIUM | M-2: Duplicate fee logic in two files | Consolidate into single module |
| MEDIUM | M-3: Wallet message validation bypass via newline | Remove `includes(\n...)` fallback |
| MEDIUM | M-4: `looksEncrypted` legacy fallback | Add migration tracking |
| MEDIUM | M-5: `as string` type assertions | Use explicit conversion |
| LOW | L-1: HSTS preload without submission | Verify and submit |
| LOW | L-2: Per-request Redis client in agent-auth | Use singleton |
| LOW | L-3: `require("crypto")` in ESM context | Use `import` |
| LOW | L-4: Non-null assertions on guarded values | Use proper narrowing |

---

*Report generated as part of security-focused differential review of fix commits on the current branch.*
