# Differential Security Review: origin/main...HEAD

**Date:** 2026-03-05
**Branch:** 25 commits ahead of `origin/main`
**Scope:** 175 files changed, ~49k insertions, ~900 deletions
**Reviewer focus:** Security regressions introduced by fix commits, accidental removal of security checks, new vulnerabilities, auth/crypto/validation changes, CI/CD workflow changes

---

## Executive Summary

The branch is primarily a security hardening effort comprising: (1) remediation of Semgrep/CodeQL/Trivy findings, (2) addition of CI security scanning workflows, (3) constant-time comparison fixes, (4) CSRF protection additions, (5) financial arithmetic precision fixes, and (6) auth trust-boundary corrections. The changes are largely beneficial, but this review identifies several issues introduced or left unresolved by the fixes.

---

## CRITICAL Severity

### C-1: CSP Regression -- `unsafe-eval` Added to `script-src`

**File:** `/home/user/App-Market/next.config.js` (line ~76)

The Content-Security-Policy was changed from:
```
script-src 'self' 'unsafe-inline'
```
to:
```
script-src 'self' 'unsafe-inline' 'unsafe-eval'
```

Adding `'unsafe-eval'` to production CSP allows `eval()`, `Function()`, `setTimeout("string")`, and similar constructs. This dramatically weakens XSS protection. If any injection vector exists (stored XSS in user profiles, listing descriptions, etc.), an attacker can execute arbitrary JavaScript via `eval()`.

The comment says "needed for Next.js dev" but this CSP applies to **all environments** via `next.config.js` headers. There is no conditional for `NODE_ENV`.

**Recommendation:** Remove `'unsafe-eval'` from the production CSP. If needed for development only, conditionally include it based on `process.env.NODE_ENV !== 'production'`. Consider adopting Next.js nonce-based CSP to eliminate `'unsafe-inline'` as well.

### C-2: Private Key Exposure Removed -- Verify Client Compatibility

**File:** `/home/user/App-Market/app/api/token-launch/deploy/route.ts` (lines ~175-176)

The fix correctly removes `mintKeypairBytes: Array.from(decryptedKeypair.secretKey)` from the API response, which was previously sending a private key to the client. This is a correct fix. However, the `createPoolTx` is now `partialSign`ed server-side.

**Risk:** If the client code still expects `mintKeypairBytes` and attempts to sign with it, the deployment flow will break silently or with a confusing error. No corresponding client-side changes were found in this diff to remove the `mintKeypairBytes` consumption. This needs verification that the client-side PATO launch modal handles the new flow.

---

## HIGH Severity

### H-1: `db-middleware.ts` Null Guard Removed

**File:** `/home/user/App-Market/lib/db-middleware.ts` (line ~36)

Changed from:
```typescript
if (typeof result === "object" && result !== null) {
```
to:
```typescript
if (typeof result === "object") {
```

In JavaScript, `typeof null === "object"`. Removing the `result !== null` check means `decryptAccountTokens(null)` will now be called when a Prisma query returns `null` (e.g., `findUnique` with no match). If `decryptAccountTokens` does not handle `null` input gracefully, this will throw a runtime error on every "not found" query for Account models, potentially causing 500 errors across auth flows.

**Recommendation:** Restore the `&& result !== null` guard, or verify that `decryptAccountTokens` safely handles `null` input by returning `null` passthrough.

### H-2: Encryption Format Change Without Migration Strategy

**File:** `/home/user/App-Market/lib/encryption.ts`

The `encrypt()` function now prepends `"enc:v1:"` to all ciphertext. The `decrypt()` function and `looksEncrypted()` function support both old and new formats. However:

1. **No migration path exists** for existing encrypted data in the database. Old data uses raw base64; new data uses `enc:v1:` prefix. If `looksEncrypted()` is used anywhere to decide whether to encrypt (i.e., "if not encrypted, encrypt it"), the heuristic for legacy data (`decoded.length > salt+iv+tag`) could produce false positives on long non-encrypted strings.

2. The `rotate-tokens.ts` and `rotate-tokens.js` scripts do **not** use the new `enc:v1:` prefix -- they still produce raw base64. This means rotated tokens will be in the old format, creating inconsistency.

**Recommendation:** Update `rotate-tokens.ts/.js` to also use the `enc:v1:` prefix. Plan a one-time migration to re-encrypt all existing data with the new prefix.

### H-3: Wallet Verification Message Prefix Bypass

**File:** `/home/user/App-Market/lib/wallet-verification.ts` (lines ~32-38)

The fix tightens message validation from `includes("App Market")` to checking strict prefixes. However, the check is:
```typescript
if (!validPrefixes.some(prefix => message.startsWith(prefix) || message.includes(`\n${prefix}`)))
```

The `message.includes(\`\n${prefix}\`)` branch still allows an attacker to craft a message like:
```
Malicious content that tricks the user
Sign this message to prove you own this wallet...
```

If the wallet UI truncates displayed messages, the user may not see the attacker-prepended content. While better than substring matching, the `\n` fallback weakens the strict-prefix intent.

**Recommendation:** Only allow `message.startsWith(prefix)`. If multi-line messages are needed for collaboration acceptance, validate the exact expected message format rather than searching for a prefix after any newline.

### H-4: Operator Precedence Bug in Offer Accept Authorization

**File:** `/home/user/App-Market/app/api/offers/[offerId]/accept/route.ts` (line ~79)

```typescript
if (offer.listing.sellerId !== token.id as string) {
```

The `as string` type assertion has lower precedence than `!==`, so this evaluates as:
```typescript
if ((offer.listing.sellerId !== token.id) as string) {
```

This casts the boolean result to a string, which is always truthy (both `"true"` and `"false"` are truthy strings). **This means the seller authorization check always passes**, allowing any authenticated user to accept any offer.

The same pattern appears in `/home/user/App-Market/app/api/offers/route.ts` (line ~82):
```typescript
if (listing.sellerId === token.id as string) {
```
This self-offer check is also broken -- it casts the boolean to string, always truthy, so users **cannot** make offers on any listing (the guard always triggers).

**Recommendation:** Fix to `if (offer.listing.sellerId !== (token.id as string))` with explicit parentheses around the type assertion.

---

## MEDIUM Severity

### M-1: `PUBLIC_API_ROUTES` Array Removed from Middleware

**File:** `/home/user/App-Market/middleware.ts`

The `PUBLIC_API_ROUTES` array was removed. While it was not directly used in the auth logic (which uses `PROTECTED_API_ROUTES` and an allowlist approach), removing it eliminates documentation of which routes are intentionally public. This is a minor maintainability concern rather than a direct vulnerability, since the actual enforcement logic (`isPublicRead` checks) remains.

No functional security regression, but future maintainers may not realize which routes are intentionally unauthenticated.

### M-2: Dispute Resolution Removes Financial Calculations

**File:** `/home/user/App-Market/app/api/disputes/[id]/route.ts`

The `buyerRefund` and `sellerPayout` variables were removed entirely from the dispute resolution handler. While the dispute resolution was wrapped in a Prisma transaction (good), the actual refund/payout amounts are no longer calculated or logged. This means:

1. There is no audit trail of the financial impact of dispute resolutions.
2. The `feeCharged` boolean is set but the actual fee amount is computed (`disputeFeeAmount`) and then unused -- it is unclear whether on-chain fund movements are handled elsewhere.

**Recommendation:** Verify that fund disbursement for dispute resolutions is handled by a separate mechanism (e.g., on-chain escrow release). If not, this removal may mean dispute resolutions no longer trigger actual refunds/payouts.

### M-3: Nonce Validation Inconsistency Between `validation.ts` and `agent-auth.ts`

**File:** `/home/user/App-Market/lib/validation.ts` (line ~44) vs `/home/user/App-Market/lib/agent-auth.ts` (line ~218)

In `validation.ts`, when Redis is unavailable in production, `checkAndSetNonce` returns `true` (meaning "nonce already used" = fail closed). This is correct.

In `agent-auth.ts`, when Redis is unavailable in production, the code returns a 503 error. This is also fail-closed but with a different behavior (error vs silent rejection).

The inconsistency is minor but could cause confusion. More importantly, in `agent-auth.ts`, a new Redis client is instantiated **on every request** rather than reusing a singleton. This adds latency and connection overhead.

**Recommendation:** Extract Redis nonce checking into a shared utility. Use a singleton Redis client.

### M-4: GIF Support Added to Image Upload Without SVG-like Risk Assessment

**Files:** `/home/user/App-Market/app/api/profile/upload-picture/route.ts`, `/home/user/App-Market/app/api/user/profile/image/route.ts`

GIF was added to allowed upload types with magic byte validation. GIF files can contain embedded JavaScript in some contexts (e.g., polyglot files) and historically have been vectors for image-parsing vulnerabilities. The magic byte check is sufficient to confirm it is a real GIF, but ensure the serving infrastructure sets `Content-Type: image/gif` and `Content-Disposition: inline` correctly, and that no downstream processing (resizing, etc.) is vulnerable to GIF-specific exploits (e.g., decompression bombs via large frame counts).

### M-5: `_withRetry` Function Renamed but Never Called

**File:** `/home/user/App-Market/app/api/cron/buyer-info-deadline/route.ts`

The `withRetry` function was renamed to `_withRetry` (prefixed with underscore, indicating unused). If this function was previously used to retry database operations in the cron handler, removing its usage could make the cron job less resilient to transient database failures.

### M-6: Unused Variables Prefixed with Underscore Instead of Removed

**Files:** Multiple (e.g., `app/api/transfers/[id]/fallback/route.ts`, `app/api/listings/route.ts`, `app/api/cron/super-badge-qualification/route.ts`)

Variables like `_hasRequiredInfo`, `_deadlinePassed`, `_noInfoProvided`, `_SUPER_BUYER_MIN_ACCOUNT_AGE_DAYS` are prefixed with underscore but their logic (checking deadline status, validating info requirements) appears to be skipped. This suggests validation logic was disabled to fix build errors rather than properly reworking it.

In the fallback route, the deadline/info checks that these variables fed into may no longer gate the fallback action, potentially allowing premature fallback activation.

---

## LOW Severity

### L-1: Timing-Safe Comparison Padding Pattern

**Files:** `/home/user/App-Market/middleware.ts`, `/home/user/App-Market/lib/cron-auth.ts`, `/home/user/App-Market/app/api/admin/reset-listings/route.ts`, `/home/user/App-Market/app/api/webhooks/pool-graduation/route.ts`, `/home/user/App-Market/app/api/auth/twitter/callback/route.ts`

The new pattern:
```typescript
const maxLen = Math.max(a.length, b.length);
const paddedA = Buffer.alloc(maxLen);
const paddedB = Buffer.alloc(maxLen);
Buffer.from(a).copy(paddedA);
Buffer.from(b).copy(paddedB);
return timingSafeEqual(paddedA, paddedB) && a.length === b.length;
```

This is correct and fixes the original length-leaking issue. However, the `a.length === b.length` check at the end is a non-constant-time comparison. An attacker who can observe timing could potentially determine whether the lengths match after the `timingSafeEqual` returns. In practice, this is negligible because the non-constant-time check happens only in the epilogue and the secret length is a single integer comparison, but for completeness, consider using HMAC-based comparison instead (compute HMAC of both values with a random key and compare HMACs).

### L-2: `console.log` to `console.info` is Cosmetic, Not Security

Many changes convert `console.log` to `console.info`. While this improves log-level hygiene and removes some sensitive debug output, a few structured logging changes include `error` objects directly (e.g., `{ field, error }`). If `error` objects contain stack traces with file paths, these may be logged in production. This is standard practice but worth noting for log-scrubbing policies.

### L-3: `parseInt` Radix Parameter Added Consistently

Multiple files now include the explicit radix `10` in `parseInt()` calls. This is a correctness improvement -- without the radix, strings starting with `0` could be parsed as octal in older engines. No security regression here; this is purely positive.

### L-4: Domain Registrar Regex Patterns Tightened

**File:** `/home/user/App-Market/lib/domain-transfer.ts`

Patterns like `/godaddy\.com/i` were changed to `/(^|\.)godaddy\.com$/i` and transfer URL patterns now anchor with `^`. This prevents subdomain spoofing (e.g., `godaddy.com.evil.com`) and is a positive security change. The `validateDomainTransferLink` function now parses the URL and matches against `hostname` rather than the full URL string.

---

## CI/CD Workflow Changes

### New Workflows (All Positive)

Three new GitHub Actions workflows were added:

1. **`.github/workflows/codeql.yml`** -- CodeQL security analysis with `security-extended` queries. Uses pinned `@v3`/`@v4` action versions. Permissions are correctly scoped to `actions: read`, `contents: read`, `security-events: write`. No write access to code. **No issues found.**

2. **`.github/workflows/snyk.yml`** -- Snyk dependency and SAST scanning. Uses `continue-on-error: true` (scan failures won't block PRs, which is acceptable for initial rollout). Requires `SNYK_TOKEN` secret. **No issues found.**

3. **`.github/workflows/trivy.yml`** -- Trivy filesystem vulnerability scanner. Standard configuration with SARIF upload. **No issues found.**

All three workflows use `@master` or `@v3`/`@v4` tags. For supply-chain safety, consider pinning to specific commit SHAs rather than mutable tags.

### `package.json` Overrides

```json
"serialize-javascript": "^7.0.4",
"axios": "^1.7.8",
"hono": "^4.12.0"
```

These force minimum versions for transitive dependencies with known CVEs. This is a positive security change. Verify that the overridden versions are compatible with the packages that depend on them.

---

## Summary of Positive Security Changes

The branch introduces many beneficial security improvements:

- **Auth trust boundary:** Privy auth now uses server-verified wallet/email claims instead of client-supplied values (prevents account takeover)
- **Nonce replay protection:** Agent auth now enforces nonces via Redis with fail-closed behavior in production
- **CSRF protection:** Added to 10+ state-changing endpoints (disputes, messages, reviews, watchlist, token-launch, transfers, withdrawals, profile updates)
- **Financial precision:** Fee calculations moved from floating-point to BigInt/lamports arithmetic
- **Constant-time comparisons:** Fixed length-leaking pattern across all secret comparisons
- **Open redirect prevention:** Twitter OAuth callback now validates redirect URLs are same-origin
- **SSRF prevention:** GitHub verification now validates owner/repo names and uses `encodeURIComponent`
- **Input validation:** Bid amounts capped, email validation improved, ReDoS-safe HTML stripping
- **Debug log removal:** Extensive removal of `console.log` calls that leaked wallet addresses and auth flow details
- **Secret key protection:** Mint keypair bytes no longer sent to client in token launch deploy
- **Agreement signatures mandatory:** Wallet signature now required (was optional) for transaction agreements
- **Atomic operations:** Dispute resolution wrapped in Prisma `$transaction`

---

## Findings Count

| Severity | Count |
|----------|-------|
| Critical | 2     |
| High     | 4     |
| Medium   | 6     |
| Low      | 4     |

**Priority fixes:** C-1 (remove `unsafe-eval`), H-1 (restore null guard), H-4 (fix operator precedence in offers auth).
