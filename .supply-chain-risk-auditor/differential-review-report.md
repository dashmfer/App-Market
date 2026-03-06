# Differential Security Review Report

**Branch:** `claude/security-scan-all-plugins-5oEGh`
**Base:** `origin/main`
**Date:** 2026-03-06
**Commits reviewed:** 38 commits (f52bf72..34b1bf5)
**Files changed:** ~140 source files (excluding scan reports/artifacts)

---

## 1. Summary of Changes Reviewed

This branch is a comprehensive security hardening effort across the entire App-Market codebase. The changes span API routes, authentication, encryption, financial calculations, client-side UI, and CI/CD configuration. The primary categories of change are:

1. **Timing-safe comparison fixes** (constant-time padding pattern)
2. **Encryption hardening** (AAD binding, GCM auth tag enforcement, format prefix)
3. **CSRF protection expansion** (added to 10+ state-changing endpoints)
4. **Input validation improvements** (ReDoS prevention, integer radix, finite checks, upper bounds)
5. **Open redirect prevention** (Twitter OAuth callback)
6. **Private key leak prevention** (PATO deploy route)
7. **Financial precision** (floating-point to BigInt lamport arithmetic)
8. **Authentication hardening** (Privy claims verification, nonce replay protection)
9. **Client-side cleanup** (debug log removal, `alert()` to `toast`, `confirm()` to dialog component)
10. **Security headers** (X-Content-Type-Options, CSP tightening, HSTS preload, X-Frame-Options DENY)

---

## 2. Security Findings

### 2.1 POSITIVE: Critical Fixes (No Regressions Found)

#### 2.1.1 Private Key Leak Plugged (CRITICAL)
- **File:** `app/api/token-launch/deploy/route.ts`
- **Change:** Removed `mintKeypairBytes: Array.from(decryptedKeypair.secretKey)` from the API response. The mint keypair is now used to `partialSign()` server-side, and the secret key never leaves the server.
- **Assessment:** This is the highest-impact fix in the branch. Sending raw secret key bytes to the client was a critical vulnerability.

#### 2.1.2 Privy Auth: Trust Server-Verified Claims Only (CRITICAL)
- **File:** `lib/auth.ts`
- **Change:** The Privy credentials provider now extracts `walletAddress`, `email`, and `twitterUsername` from Privy's server-side `getUser()` response instead of trusting client-supplied `credentials.*` values.
- **Assessment:** Prevents account takeover attacks where an attacker could claim any wallet/email via the Privy flow.

#### 2.1.3 Agreement Signing Now Requires Wallet Signature (HIGH)
- **File:** `app/api/transactions/[id]/agreements/route.ts`
- **Change:** Wallet signature was previously optional for signing agreements; it is now mandatory. Additionally, the signing wallet is verified against the user's registered wallet address.
- **Assessment:** Closes an authorization bypass where agreements could be signed without cryptographic proof of wallet ownership.

#### 2.1.4 On-Chain Escrow Release: Fail-Closed (HIGH)
- **File:** `app/api/transfers/[id]/complete/route.ts`
- **Change:** Previously, if on-chain escrow release failed, the transaction was still marked `COMPLETED`. Now, failure returns HTTP 502 and blocks completion.
- **Assessment:** Prevents silent fund loss where a seller never receives payment but the platform marks the deal as done.

#### 2.1.5 Nonce Replay Protection with Redis (HIGH)
- **File:** `lib/agent-auth.ts`
- **Change:** Agent wallet-signature auth now requires a nonce (mandatory), checked via Redis `SET NX EX 600`. In production without Redis, it fails closed (503).
- **Assessment:** Prevents replay attacks against the agent API. The fail-closed behavior in production is correct.

#### 2.1.6 Wallet Verification: Secure-by-Default Message Validation (HIGH)
- **File:** `lib/wallet-verification.ts`
- **Change:** `verifyWalletSignature()` now internally calls `validateWalletSignatureMessage()` instead of relying on callers to do so. Callers in `auth/wallet/verify/route.ts` and `lib/auth.ts` were de-duplicated accordingly.
- **Assessment:** Good defense-in-depth. Reduces risk of a future caller forgetting to validate the message.

### 2.2 POSITIVE: Important Hardening

#### 2.2.1 Timing-Safe Comparison (Padded Buffer Pattern)
- **Files:** `middleware.ts`, `lib/cron-auth.ts`, `lib/agent-auth.ts`, `app/api/admin/reset-listings/route.ts`, `app/api/webhooks/pool-graduation/route.ts`, `app/api/auth/twitter/callback/route.ts`
- **Change:** Replaced the pattern `if (a.length !== b.length) return false; timingSafeEqual(...)` with a padded-buffer approach: `Buffer.alloc(maxLen)` + `copy` + `timingSafeEqual` + `&& a.length === b.length`.
- **Assessment:** The length pre-check leaked secret length via timing. The new approach is correct. The final `&& length` check is done after the constant-time comparison, so it does not leak timing info.

#### 2.2.2 Encryption: AAD Binding
- **Files:** `lib/encryption.ts`, `lib/account-token-encryption.ts`, `lib/db-middleware.ts`, `lib/webhooks.ts`, `app/api/agent/webhooks/route.ts`, `app/api/auth/twitter/connect/route.ts`, `app/api/auth/twitter/callback/route.ts`, `app/api/token-launch/route.ts`, `app/api/token-launch/deploy/route.ts`
- **Change:** `encrypt()` and `decrypt()` now accept an optional AAD parameter. Usage sites bind ciphertexts to their logical owner (user ID, token mint, providerAccountId). Legacy fallback (decrypt without AAD) is provided for backward compatibility.
- **Assessment:** Prevents cross-record swap attacks. The fallback path is acceptable for migration but should be removed once all data is re-encrypted.

#### 2.2.3 Encryption: Deterministic Prefix & GCM Auth Tag Length
- **File:** `lib/encryption.ts`
- **Change:** Encrypted data now uses `enc:v1:` prefix for reliable identification. `looksEncrypted()` was hardened to reject JWTs and URLs. `authTagLength: AUTH_TAG_LENGTH` is now explicitly passed to `createCipheriv`/`createDecipheriv`.
- **Assessment:** Fixing `authTagLength` is important -- without it, Node.js defaults to 16 bytes but the explicit enforcement is a defense against future configuration errors. The prefix-based detection eliminates false-positive decryption of non-encrypted data.

#### 2.2.4 CSRF Protection Expansion
- **Endpoints gaining CSRF:** `disputes/route.ts (POST)`, `messages/route.ts (POST)`, `profile/route.ts (PUT)`, `profile/upload-picture/route.ts (POST, DELETE)`, `reviews/route.ts (POST)`, `token-launch/route.ts (POST)`, `transfers/[id]/complete/route.ts (POST)`, `transfers/[id]/seller-confirm/route.ts (POST)`, `watchlist/route.ts (POST, DELETE)`, `withdrawals/[withdrawalId]/claim/route.ts (POST)`
- **Assessment:** Good coverage expansion. All state-changing endpoints that were missing CSRF now have it.

#### 2.2.5 Financial Precision: BigInt Arithmetic
- **Files:** `lib/config.ts`, `lib/solana.ts`
- **Change:** Fee calculations (`calculatePlatformFee`, `calculateDisputeFee`, `calculateSellerProceeds`, `toTokenUnits`) converted from floating-point multiplication to integer lamport arithmetic using BigInt.
- **Assessment:** Eliminates IEEE 754 precision loss in financial calculations. The `solToLamportsBigInt()` string-parsing approach correctly avoids `Number * BigInt` issues.

#### 2.2.6 Open Redirect Prevention
- **File:** `app/api/auth/twitter/callback/route.ts`
- **Change:** All redirects now go through `getSafeRedirectUrl()` which validates same-origin only. Previously, `SITE_URL` was concatenated directly with attacker-controllable paths.
- **Assessment:** Properly mitigates open redirect via the Twitter OAuth callback.

#### 2.2.7 GitHub API SSRF Mitigation
- **File:** `app/api/github/verify/route.ts`
- **Change:** Added strict regex validation for owner/repo names plus `encodeURIComponent()` in the URL.
- **Assessment:** Prevents path traversal / SSRF through malicious GitHub owner/repo values.

#### 2.2.8 Bid Amount Upper Bound
- **File:** `app/api/bids/route.ts`
- **Change:** Added `Number.isFinite()` check and 1M SOL cap, matching the offers route.
- **Assessment:** Prevents Infinity/NaN from corrupting fee calculations.

#### 2.2.9 Domain Registrar Pattern Anchoring
- **Files:** `lib/domain-transfer.ts`, `app/dashboard/transfers/[id]/page.tsx`
- **Change:** Regex patterns changed from `/godaddy\.com/i` to `/(^|\.)godaddy\.com$/i` and URL matching now operates on parsed hostnames, not raw URLs.
- **Assessment:** Prevents pattern matching against attacker-controlled subdomains (e.g., `godaddy.com.evil.com`).

#### 2.2.10 Security Headers
- **Files:** `middleware.ts`, `next.config.js`
- **Change:** Added `X-Content-Type-Options: nosniff` to middleware responses. `X-Frame-Options` changed from `SAMEORIGIN` to `DENY`. `HSTS` gains `preload`. CSP `unsafe-eval` restricted to non-production. Source pattern changed from `/:path*` to `/(.*)`.
- **Assessment:** All improvements are correct and follow best practices.

#### 2.2.11 Devnet Fallback Removed
- **Files:** `app/api/purchases/route.ts`, `app/dashboard/page.tsx`, `lib/pool-watcher.ts`
- **Change:** Removed `|| "https://api.devnet.solana.com"` fallbacks. Production now requires `NEXT_PUBLIC_SOLANA_RPC_URL` to be set.
- **Assessment:** Prevents accidental use of devnet in production, which could lead to accepting invalid transactions.

#### 2.2.12 Production-Safe SITE_URL
- **Files:** `app/api/auth/twitter/callback/route.ts`, `app/api/auth/twitter/connect/route.ts`, `lib/env-validation.ts`
- **Change:** `http://localhost:3000` fallback is only used in development. Production requires `NEXT_PUBLIC_SITE_URL` (validated as HTTPS).
- **Assessment:** Prevents HTTP downgrade in production OAuth flows.

### 2.3 MINOR OBSERVATIONS (Not Regressions)

#### 2.3.1 `getServerSession` to `getAuthToken` Migration
- **Files:** `app/api/offers/route.ts`, `app/api/offers/[offerId]/accept/route.ts`, `app/api/withdrawals/route.ts`
- **Change:** Switched from `getServerSession(authOptions)` to `getAuthToken(req)`.
- **Assessment:** Stated goal is "consistent revocation checks." This is a positive change if `getAuthToken` performs token validation that `getServerSession` does not (e.g., checking revocation lists). No regression detected.

#### 2.3.2 Profile XSS Sanitization Loop
- **File:** `app/api/user/profile/route.ts`
- **Change:** HTML tag stripping now uses a `while` loop to handle nested/incomplete tags (e.g., `<scr<script>ipt>`).
- **Assessment:** Good improvement. Input is also truncated before regex to prevent ReDoS.

#### 2.3.3 Token Image URL Validation
- **File:** `components/pato/PATOLaunchModal.tsx`
- **Change:** Added `&& /^https?:\/\//i.test(tokenImage)` before rendering `<img src>`.
- **Assessment:** Prevents `javascript:` or `data:` URI injection in the token image preview.

### 2.4 POTENTIAL CONCERNS

#### 2.4.1 AAD Fallback in Decryption (Migration Risk)
- **Multiple files** use a try/catch pattern: attempt `decrypt(data, aad)`, on failure fall back to `decrypt(data)`.
- **Risk:** If an attacker can trigger re-encryption of a record without AAD (by exploiting the fallback path), they could bypass the cross-record swap protection. The fallback should be time-bounded or removed after a migration window.
- **Severity:** Low (requires database-level access or an additional bug).

#### 2.4.2 In-Memory Nonce Store in `lib/validation.ts`
- **Change:** In production without Redis, the nonce check now fails closed (`return true` = treat as already used).
- **Risk:** This is correct fail-closed behavior, but the `agent-auth.ts` nonce check has a different pattern (returns 503). The inconsistency could confuse operators. Consider aligning error responses.
- **Severity:** Informational.

#### 2.4.3 Dispute Resolution Removes Financial Audit Variables
- **File:** `app/api/disputes/[id]/route.ts`
- **Change:** Removed `buyerRefund` and `sellerPayout` local variables. The dispute resolution now only sets status flags without computing refund amounts.
- **Risk:** If these variables were previously used downstream (e.g., for on-chain refund execution or logging), their removal could mean refunds are no longer tracked. The existing code only uses `feeCharged` and `newTransactionStatus`, so this appears intentional. Verify that actual fund movement is handled elsewhere.
- **Severity:** Low (functional, not directly a security regression).

#### 2.4.4 `console.log` to `console.info` Changes Are Cosmetic
- **Multiple files:** Changed `console.log` to `console.info` throughout cron routes and library code.
- **Assessment:** This is a Semgrep finding remediation. No security impact, but it improves log level hygiene.

---

## 3. Test Coverage Gaps

### 3.1 No New Tests Added
The branch modifies only 3 test files (`tests/app-market.ts`, `tests/integration.ts`, `tests/run-tests.ts`), and all changes are cleanup of unused imports/variables. **No new test cases were added for any of the security changes.**

### 3.2 Untested Security-Critical Changes

| Change | Risk if Untested |
|--------|-----------------|
| BigInt fee calculation (`lib/config.ts`, `lib/solana.ts`) | Rounding errors could cause financial discrepancies |
| `looksEncrypted()` refactored heuristic | False negatives could cause double-encryption; false positives could attempt decryption of plaintext |
| AAD encrypt/decrypt with fallback | Incorrect AAD could permanently lock encrypted data |
| `getSafeRedirectUrl()` in Twitter callback | Edge cases in URL parsing could still allow open redirect |
| Padded `timingSafeEqual` pattern | Incorrect padding logic could accept invalid secrets |
| Nonce replay via Redis `SET NX` | Redis failures could lock out legitimate users |
| Wallet address verification in agreement signing | Could reject valid requests if wallet address format differs |
| `solToLamportsBigInt()` string parsing | Negative numbers, scientific notation, or very large decimals could produce unexpected results |

### 3.3 Recommendations for Test Coverage

1. **Unit tests for `lib/encryption.ts`:** Test `encrypt`/`decrypt` round-trip with and without AAD. Test that AAD mismatch fails. Test `looksEncrypted()` against JWTs, URLs, legacy encrypted data, and new `enc:v1:` prefixed data.
2. **Unit tests for `lib/config.ts` fee calculations:** Test edge cases: 0 amount, very small amounts (dust), maximum amounts, amounts with many decimal places.
3. **Unit tests for `solToLamportsBigInt()`:** Test with integers, decimals with < 9 digits, decimals with > 9 digits, zero, negative numbers.
4. **Integration test for Twitter OAuth callback:** Verify `getSafeRedirectUrl()` rejects cross-origin URLs and `javascript:` URIs.
5. **Integration test for agreement signing:** Verify that missing signature returns 400, mismatched wallet returns 400, valid signature succeeds.

---

## 4. Recommendations

### High Priority
1. **Add unit tests** for the encryption module, fee calculation, and lamport conversion functions. These are the most logic-dense changes and have the highest risk of edge-case bugs.
2. **Set a migration deadline** for the AAD decryption fallback. After re-encrypting all existing data with AAD, remove the try/catch fallback to harden the cross-record swap protection.
3. **Verify dispute fund movement** is handled by a separate system (e.g., on-chain escrow logic), since `buyerRefund`/`sellerPayout` variables were removed from the dispute resolution handler.

### Medium Priority
4. **Align nonce-check failure modes** between `lib/validation.ts` (returns `true` = used) and `lib/agent-auth.ts` (returns 503 response). Both should use the same pattern for production Redis failures.
5. **Remove the unused `PUBLIC_API_ROUTES` array** that was deleted from `middleware.ts` -- verify that all public routes still function correctly without the explicit allowlist (they should, since the middleware logic doesn't reference it).
6. **Consider rate limiting** on the Twitter OAuth callback to prevent state-exhaustion attacks.

### Low Priority
7. **Remove debug `nosemgrep` comments** once the underlying issues are resolved or confirmed as false positives.
8. **Add `image/gif` to `ProfilePictureUpload.tsx`** client-side validation to match the server-side change that now accepts GIF.
9. **Audit the `rotate-tokens.ts` script** to ensure it uses the new `enc:v1:` prefix and AAD when re-encrypting tokens.

---

## 5. Overall Assessment

**This branch represents a substantial security improvement.** The most critical fixes -- private key leak, Privy trust boundary, escrow fail-closed, and nonce replay protection -- address real exploitable vulnerabilities. The hardening changes (timing-safe comparisons, AAD binding, CSRF expansion, financial precision) follow industry best practices.

**The primary risk is the lack of test coverage.** The changes modify security-critical code paths (encryption, financial math, authentication) without corresponding test additions. While the code review did not identify regressions, the absence of automated tests means future changes could silently break these protections.

**Verdict:** Approve with the condition that unit tests for encryption, fee calculations, and key authentication flows are added before or shortly after merge.
