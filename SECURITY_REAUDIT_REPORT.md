# Security Re-Audit Report

**Date:** 2026-02-11
**Scope:** Full-stack re-audit of all security fixes + new bug hunt
**Auditors:** 4 parallel audit agents (API routes, financial logic, auth system, frontend/blockchain/cron)

---

## Executive Summary

4 independent audit agents reviewed the entire codebase. After deduplication, **38 unique bugs** were found:

| Severity | Count |
|----------|-------|
| CRITICAL | 7 |
| HIGH | 11 |
| MEDIUM | 14 |
| LOW | 6 |

The most severe finding is that **on-chain transaction verification does not validate amounts, recipients, or programs** -- an attacker can submit any valid Solana transaction hash (even a 0.000001 SOL self-transfer) and the backend will accept it as a full-price purchase.

---

## CRITICAL FINDINGS

### C1: On-Chain Transaction Amount/Recipient Not Verified (FUND THEFT)
- **Files:** `app/api/purchases/route.ts:89-117`, `app/api/transactions/route.ts:183-209`
- **Found by:** Financial audit, Frontend/blockchain audit
- **Description:** Both purchase endpoints verify only that an on-chain transaction (1) exists and (2) didn't fail (`txInfo.meta?.err`). They **never verify**: the actual SOL amount transferred, the destination address (escrow/treasury), or the sender's wallet. The `amount` from the request body is trusted blindly for `salePrice`, `platformFee`, and `sellerProceeds`. An attacker can send 0.000001 SOL to any random wallet, submit that tx hash with the listing's full price, and get a valid `IN_ESCROW` transaction record.
- **Impact:** Any listing can be "purchased" for zero cost. Complete theft.

### C2: Expired Offers Cron Never Executes On-Chain Refund (FUND LOCK)
- **File:** `app/api/cron/expired-offers/route.ts:89-108`
- **Found by:** Frontend/blockchain audit
- **Description:** The cron marks offers as `EXPIRED` in the database and tells users "any escrowed funds will be returned", but **never calls** the `expireOffer()` on-chain instruction from `lib/solana-contract.ts`. Funds remain permanently locked in the offer escrow PDA.
- **Impact:** Permanent loss of escrowed funds for expired offers.

### C3: Seller Transfer Deadline Cron -- DB Says "REFUNDED" But Funds Still Locked
- **File:** `app/api/cron/seller-transfer-deadline/route.ts:118-135`
- **Found by:** Frontend/blockchain audit
- **Description:** Line 118 has `// TODO: Execute on-chain refund transaction`. Cron sets transaction to `REFUNDED` and notifies buyer "Your payment has been refunded", but no on-chain refund is executed. Buyer's SOL remains trapped in escrow PDA.
- **Impact:** Permanent loss of escrowed buyer funds.

### C4: Partner Deposit Deadline Cron -- Same Pattern, Funds Locked
- **File:** `app/api/cron/partner-deposit-deadline/route.ts:132-145`
- **Found by:** Frontend/blockchain audit
- **Description:** Same TODO pattern. Partners are told "Your deposit has been refunded" but on-chain refund never executes.
- **Impact:** Permanent loss of deposited partner funds.

### C5: Partner Deposit Has NO On-Chain Verification (FAKE DEPOSIT)
- **File:** `app/api/transactions/[id]/partners/[partnerId]/deposit/route.ts:77-88`
- **Found by:** Financial audit, API audit, Frontend/blockchain audit
- **Description:** Line 77 has `// TODO: Verify the on-chain transaction`. Accepts any `txHash` (even "fake_hash_123") and marks partner as `DEPOSITED`. When all partners are "deposited", transaction advances to `PAID`. Partners can participate in group purchases without paying.
- **Impact:** Free acquisition of listings through co-purchase fraud.

### C6: Transfer Completion Without On-Chain Escrow Release
- **File:** `app/api/transfers/[id]/complete/route.ts:116-134`
- **Found by:** Frontend/blockchain audit
- **Description:** Marks transaction as `COMPLETED` and sets `releasedAt` without calling on-chain `confirm_receipt` or `finalize_transaction`. Line 116: `// TODO: Call smart contract to release escrow to seller`. Creates state inconsistency between database and blockchain.
- **Impact:** Funds remain locked in escrow despite database saying "completed".

### C7: Timing-Unsafe Cron Secret in `check-graduations`
- **File:** `app/api/cron/check-graduations/route.ts:14`
- **Found by:** API audit, Frontend/blockchain audit
- **Description:** Uses plain `!==` string comparison for cron secret instead of `crypto.timingSafeEqual` via `verifyCronSecret()`. Only cron route that doesn't use the timing-safe helper.
- **Impact:** Cron secret can be leaked byte-by-byte via timing analysis.

---

## HIGH FINDINGS

### H1: `POST /api/transactions` Has No Serializable Transaction -- Double Purchase Race
- **File:** `app/api/transactions/route.ts:310-341`
- **Found by:** Financial audit
- **Description:** Unlike `POST /api/purchases` which uses `prisma.$transaction` with `Serializable`, this endpoint does separate non-atomic reads, creates, and updates. The `listingId @unique` constraint on Transaction prevents full double-create, but combined with C1 (no tx amount verification), creates a fully exploitable flow.
- **Impact:** Race condition on listing status check + transaction creation.

### H2: `onChainTx` Has No Unique Constraint -- Replay Attacks
- **File:** `prisma/schema.prisma:510`
- **Found by:** Financial audit
- **Description:** `Transaction.onChainTx` is `String?` with no `@unique`. The `/api/purchases` route has application-level dedup, but `/api/transactions` has none. Same tx hash can be reused. Even the app-level check is racy under concurrency.
- **Impact:** Single on-chain payment used to claim multiple listings.

### H3: Offer Acceptance Has No Serializable Isolation -- Race Condition
- **File:** `app/api/offers/[offerId]/accept/route.ts:115`
- **Found by:** Financial audit
- **Description:** `prisma.$transaction()` call doesn't specify `isolationLevel: 'Serializable'`. PostgreSQL defaults to `READ COMMITTED`. Two concurrent accepts can both read listing as `ACTIVE` and proceed. Initial offer read at line 34 is outside the transaction (TOCTOU).
- **Impact:** Double-accept of offers, inconsistent state.

### H4: Withdrawal Claim Has No Atomic Check-and-Update -- Double Claim
- **File:** `app/api/withdrawals/[withdrawalId]/claim/route.ts:34-75`
- **Found by:** Financial audit
- **Description:** Read withdrawal → check `claimed: false` → update to `claimed: true` as separate non-atomic operations. Two concurrent requests can both pass the check, both get success responses, triggering two on-chain withdrawals.
- **Impact:** Double withdrawal of funds.

### H5: Non-Transactional Multi-Step DB Writes in Transfer Complete
- **File:** `app/api/transfers/[id]/complete/route.ts:126-157`
- **Found by:** API audit
- **Description:** 4 separate sequential DB writes (tx status, listing status, seller stats, buyer stats) outside a transaction. Crash between steps leaves inconsistent state.
- **Impact:** Database inconsistency on partial failure.

### H6: Non-Transactional Multi-Step DB Writes in Transaction Confirm
- **File:** `app/api/transactions/[id]/confirm/route.ts:220-247`
- **Found by:** API audit, Financial audit
- **Description:** Confirmation flow performs 4 separate writes without transaction. Two concurrent confirmations can both see `allConfirmed = true` and double-increment user stats.
- **Impact:** Inflated seller/buyer statistics.

### H7: Race Condition in Partner Deposit (Stale "All Deposited" Check)
- **File:** `app/api/transactions/[id]/partners/[partnerId]/deposit/route.ts:80-121`
- **Found by:** API audit, Financial audit
- **Description:** `allDeposited` check uses data fetched before the current partner was updated. Not wrapped in transaction. Two partners depositing simultaneously can both advance to PAID or both miss the transition.
- **Impact:** Transaction stuck or prematurely advanced.

### H8: Race Condition in Partner Addition (Percentage Bypass)
- **File:** `app/api/transactions/[id]/partners/route.ts:79-178`
- **Found by:** API audit
- **Description:** Reads existing partners, checks percentage total, creates new partner -- not in a transaction. Two concurrent POSTs can both pass the 100% check.
- **Impact:** Partner percentages exceeding 100%.

### H9: Frontend POST/PUT/DELETE Calls Missing CSRF Headers
- **Files:** `app/listing/[slug]/page.tsx:328,353,375,485,574`, `app/listing/[slug]/edit/page.tsx:109,144,170,210`
- **Found by:** Frontend audit
- **Description:** Multiple frontend `fetch()` calls for state-changing operations don't include the `x-csrf-token` header. The `useCsrf()` hook exists but isn't used in these pages. These requests will fail with 403 when CSRF enforcement is active.
- **Impact:** Legitimate user actions blocked, or if CSRF bypassed for these routes, CSRF vulnerability.

### H10: Wallet Verify Endpoint -- Message Validation Conditionally Skipped
- **File:** `app/api/auth/wallet/verify/route.ts:25`
- **Found by:** Auth audit
- **Description:** Message validation (replay protection, timestamp, nonce) is conditional on `if (publicKey && message)`. If either is an empty string, the validation block is skipped entirely. The CredentialsProvider at `lib/auth.ts:197` makes the same call unconditionally.
- **Impact:** Nonce/replay check and timestamp validation can be bypassed.

### H11: Expire-Withdrawals Cron Marks DB "Claimed" Even When On-Chain Fails
- **File:** `app/api/cron/expire-withdrawals/route.ts:159-175`
- **Found by:** Frontend/blockchain audit
- **Description:** When on-chain `expire_withdrawal` fails, code still marks withdrawal as `claimed: true` in DB (comment: "so we don't retry forever"). Funds remain locked on-chain permanently.
- **Impact:** Permanent fund loss with no retry mechanism.

---

## MEDIUM FINDINGS

### M1: Fee Calculations Use Floating-Point Arithmetic
- **File:** `lib/solana.ts:141-160`
- **Found by:** Financial audit, Frontend/blockchain audit
- **Description:** All fee calculations use JavaScript `number` (IEEE 754). Example: `(0.3 * 500) / 10000 = 0.014999999999999999`. `toTokenUnits` at line 259 compounds errors with `Math.floor(amount * Math.pow(10, decimals))`.
- **Impact:** Systematic rounding errors favoring one party. Exploitable by choosing amounts that maximize rounding.

### M2: Offer Creation Has No Transaction -- TOCTOU on Status and Limits
- **File:** `app/api/offers/route.ts:48-151`
- **Found by:** Financial audit
- **Description:** Reads listing status, counts active offers, creates offer -- all separate DB calls. Listing could become SOLD between check and create. Two concurrent requests bypass the 3-offer limit.
- **Impact:** Offers on non-active listings; offer limit bypass.

### M3: Referral Earnings Not Atomic -- Double Referral Payout
- **File:** `lib/referral-earnings.ts:38-97`
- **Found by:** Financial audit
- **Description:** `firstTransactionPaid` check and update are non-atomic. Two concurrent calls both create `ReferralEarning` records.
- **Impact:** Referrer earns double (4% instead of 2%).

### M4: Nonce Replay Check Is Non-Atomic (TOCTOU)
- **File:** `lib/validation.ts:271-276`
- **Found by:** Auth audit
- **Description:** `hasNonceBeenUsed` + `markNonceUsed` are separate operations. Should use Redis `SET NX` (set-if-not-exists) for atomic check-and-mark. Current code uses unconditional `redis.set`.
- **Impact:** Same wallet signature replayed via concurrent requests.

### M5: Middleware Cannot Check Session Revocation (Edge Runtime)
- **File:** `middleware.ts:135-143`
- **Found by:** Auth audit
- **Description:** Middleware uses `getToken()` instead of `getAuthToken()` because Prisma is unavailable in Edge Runtime. Revoked sessions can access protected page routes for up to 7 days until JWT expires.
- **Impact:** Revoked sessions still access pages (not APIs -- those check properly).

### M6: Middleware Dot-in-Path Bypass
- **File:** `middleware.ts:91`
- **Found by:** Auth audit
- **Description:** `pathname.includes(".")` skips all auth checks for any path containing a dot. Attacker could craft `/api/admin/foo.bar` to bypass middleware auth.
- **Impact:** Potential middleware auth bypass.

### M7: `revokeAllUserSessions()` Queries Empty Session Table
- **File:** `lib/auth.ts:93-127`
- **Found by:** Auth audit
- **Description:** Queries `prisma.session.findMany({ where: { userId } })` but since auth uses `strategy: "jwt"` and PrismaAdapter is disabled, the Session table is empty. Function always returns 0.
- **Impact:** "Revoke all sessions" feature doesn't work.

### M8: In-Memory Nonce Fallback Doesn't Fail Closed in Production
- **File:** `lib/validation.ts:36-37`
- **Found by:** Auth audit, Frontend/blockchain audit
- **Description:** When Redis is unavailable, nonce check falls back to in-memory `Map`. In serverless, each invocation has separate memory. Rate-limit code fails closed in production; nonce check doesn't.
- **Impact:** Full replay attack possible if Redis is down.

### M9: CSRF Secret Falls Back to NEXTAUTH_SECRET
- **File:** `lib/csrf.ts:18-26`
- **Found by:** Frontend/blockchain audit
- **Description:** Missing `CSRF_SECRET` silently falls back to `NEXTAUTH_SECRET`. If either is compromised, both systems are compromised.
- **Impact:** Secret reuse weakens isolation between auth and CSRF.

### M10: No Distributed Lock on Cron Jobs
- **File:** All `app/api/cron/` routes
- **Found by:** Frontend/blockchain audit
- **Description:** No distributed locking. Overlapping cron runs can process the same records, causing duplicate notifications and inconsistent updates. `partner-deposit-deadline` (2-min interval) is most vulnerable.
- **Impact:** Duplicate processing and notifications.

### M11: CSP Allows `'unsafe-inline'` for Scripts
- **File:** `next.config.js:77`
- **Found by:** Frontend/blockchain audit
- **Description:** `script-src 'self' 'unsafe-inline'` defeats most XSS protections from CSP. Modern Next.js supports nonce-based CSP.
- **Impact:** XSS injection can execute arbitrary JavaScript.

### M12: Missing Pagination on Multiple GET Endpoints
- **Files:** `app/api/offers/route.ts:221-253`, `app/api/disputes/route.ts:20-56`, `app/api/transactions/route.ts:49-79`, `app/api/bids/route.ts:11-56`
- **Found by:** API audit
- **Description:** Multiple GET endpoints fetch all records with no `take` limit.
- **Impact:** Unbounded queries; potential DoS.

### M13: Collaborator GET Lacks Authorization Check
- **File:** `app/api/collaborators/[id]/respond/route.ts:224-278`
- **Found by:** API audit
- **Description:** GET returns collaborator invite details to any authenticated user, not just the actual collaborator.
- **Impact:** Information disclosure of invite details.

### M14: Currency Mismatch in Offer Fee Calculations
- **File:** `app/api/offers/[offerId]/accept/route.ts:105`
- **Found by:** Financial audit
- **Description:** Uses `offer.listing.currency` for fee calculation, but offer has its own `currency` field. If listing is `APP` (3% fee) but offer is `SOL` (5% fee), wrong rate is applied.
- **Impact:** Platform under/over-collects fees.

---

## LOW FINDINGS

### L1: Dead Code in Register Route (Landmine)
- **File:** `app/api/auth/register/route.ts:17-110`
- **Found by:** API audit
- **Description:** POST returns 403 at line 11, making all subsequent code unreachable. If guard is ever removed, the dead code has no CSRF protection.
- **Impact:** Future security regression risk.

### L2: Audit Log Uses Spoofable Leftmost IP
- **File:** `lib/audit.ts:56-57`
- **Found by:** Auth audit
- **Description:** Uses leftmost IP from `x-forwarded-for` (most spoofable). Rate-limit code correctly uses rightmost IP.
- **Impact:** Audit logs contain attacker-controlled IPs.

### L3: CSRF Cookie Comparison Not Timing-Safe
- **File:** `lib/csrf.ts:102`
- **Found by:** Auth audit
- **Description:** Cookie-vs-header comparison uses plain `!==` before the HMAC verification (which IS timing-safe). Low practical risk since HMAC check follows.
- **Impact:** Minor timing information leakage.

### L4: `__Host-` Cookie Prefix Breaks in Development
- **File:** `lib/csrf.ts:10,118-124`
- **Found by:** Auth audit
- **Description:** `__Host-` prefix requires `Secure` flag. In development (`secure: false`), browsers reject the cookie entirely.
- **Impact:** CSRF untestable in development without workarounds.

### L5: Non-Compete "Signature" Is Not Cryptographic
- **File:** `app/api/transfers/[id]/sign-non-compete/route.ts:65`
- **Found by:** API audit
- **Description:** "Signature" is a formatted string, not a wallet signature. Unlike NDA signing which uses `nacl.sign.detached.verify`.
- **Impact:** Cannot cryptographically prove seller agreed to terms.

### L6: Duplicate Fee Functions in `lib/solana.ts` and `lib/config.ts`
- **Files:** `lib/solana.ts:136-160`, `lib/config.ts:282-312`
- **Found by:** Financial audit
- **Description:** Both export identically-named fee functions. A fee change applied to one but not the other would cause inconsistent fees across endpoints.
- **Impact:** Maintenance hazard; potential fee inconsistency.

---

## ITEMS VERIFIED AS SECURE

- **Wallet signature verification:** `nacl.sign.detached.verify()` in `lib/wallet-verification.ts` -- correct Ed25519 verification
- **XSS:** No `dangerouslySetInnerHTML` in application code. Listing descriptions rendered via safe JSX
- **Security headers:** HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy all correct
- **Regex DoS:** All validation regexes are bounded and non-backtracking
- **Cron auth:** 8/9 cron routes use timing-safe `verifyCronSecret()` (except `check-graduations`)
- **Session management:** JWT with database-backed revocation, 7-day max age, known-default detection
- **Encryption:** AES-256-GCM with proper salt, IV, and auth tag
- **Auth on all state-changing routes:** Every POST/PUT/PATCH/DELETE calls `getAuthToken()` and rejects if null
- **CSRF on all state-changing routes:** 50 routes correctly use `validateCsrfRequest()`
- **Bidding:** Serializable isolation level prevents concurrent bid races
- **Admin routes:** Triple-check (admin secret + session + DB isAdmin flag)

---

## PRIORITY FIX ORDER

### Must Fix Before Mainnet (CRITICAL):
1. **C1** -- Verify on-chain tx amount, recipient, and sender in purchases
2. **C2/C3/C4** -- Implement on-chain refund execution in cron jobs
3. **C5** -- Verify partner deposits on-chain
4. **C6** -- Call smart contract for escrow release on transfer complete
5. **C7** -- Use `verifyCronSecret()` in check-graduations

### Should Fix Before Mainnet (HIGH):
6. **H1** -- Wrap `/api/transactions` POST in serializable transaction
7. **H2** -- Add `@unique` constraint on `onChainTx`
8. **H3** -- Add `Serializable` isolation to offer acceptance
9. **H4** -- Atomic withdrawal claim (WHERE claimed = false in UPDATE)
10. **H5/H6** -- Wrap completion flows in transactions
11. **H7/H8** -- Wrap partner operations in transactions
12. **H9** -- Add CSRF headers to frontend fetch calls
13. **H10** -- Make wallet verify message validation unconditional
14. **H11** -- Don't mark withdrawal as claimed when on-chain fails

### Should Fix Soon (MEDIUM):
15. **M1** -- Use integer math (lamports/basis points) for all fee calculations
16. **M2** -- Wrap offer creation in transaction
17. **M3** -- Atomic referral earnings check
18. **M4** -- Use Redis SET NX for nonce check
19. **M5-M14** -- Various middleware, config, pagination fixes
