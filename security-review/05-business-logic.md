# Security Audit: Business Logic Vulnerabilities & Secrets/Configuration Management

**Audit Date:** 2026-02-10
**Scope:** Full codebase at `/home/user/App-Market`
**Auditor:** Automated Security Review (Claude Opus 4.6)

---

## Executive Summary

This audit identified **27 findings** across business logic and secrets/configuration management domains. The most critical issues involve (1) offers not being backed by on-chain escrow, allowing costless spam offers, (2) a private keypair being leaked in a token-launch API response, and (3) the database-only state tracking for financial operations that should be enforced on-chain. Several medium and low severity issues related to missing CSRF protection on some mutation endpoints, potential race conditions, and default credential patterns were also identified.

---

## Summary Table

| # | Severity | Category | Finding | File |
|---|----------|----------|---------|------|
| 1 | CRITICAL | Payment | Offers are database-only with no on-chain escrow backing | `app/api/offers/route.ts:89-91` |
| 2 | CRITICAL | Secrets | Mint keypair secret key leaked in API response | `app/api/token-launch/deploy/route.ts:176` |
| 3 | CRITICAL | Payment | Transaction creation does not verify on-chain payment | `app/api/transactions/route.ts:258-276` |
| 4 | HIGH | Escrow | Escrow auto-release updates DB without on-chain fund release | `app/api/cron/escrow-auto-release/route.ts:119-126` |
| 5 | HIGH | Escrow | Expired offers mark DB as expired but never refund on-chain escrow | `app/api/cron/expired-offers/route.ts:89-99` |
| 6 | HIGH | Payment | Transfer completion updates DB without calling smart contract | `app/api/transfers/[id]/complete/route.ts:109-127` |
| 7 | HIGH | Listing | No server-side price floor validation on listing creation | `app/api/listings/route.ts:363` |
| 8 | HIGH | Configuration | Default secrets in .env.example could be used in production | `.env.example:9,68,72` |
| 9 | MEDIUM | Dispute | Dispute resolution lacks atomicity - non-transactional DB updates | `app/api/disputes/[id]/route.ts:124-142` |
| 10 | MEDIUM | Bidding | Anti-snipe auction extension happens outside the serializable transaction | `app/api/bids/route.ts:231-266` |
| 11 | MEDIUM | CSRF | Offer accept endpoint missing CSRF validation | `app/api/offers/[offerId]/accept/route.ts` |
| 12 | MEDIUM | CSRF | Offer cancel endpoint missing CSRF validation | `app/api/offers/[offerId]/cancel/route.ts` |
| 13 | MEDIUM | CSRF | Dispute creation endpoint missing CSRF validation | `app/api/disputes/route.ts:69` |
| 14 | MEDIUM | CSRF | Transaction confirm endpoint missing CSRF validation | `app/api/transactions/[id]/confirm/route.ts` |
| 15 | MEDIUM | CSRF | Transfer complete endpoint missing CSRF validation | `app/api/transfers/[id]/complete/route.ts` |
| 16 | MEDIUM | CSRF | Listing reserve endpoint missing CSRF validation | `app/api/listings/[slug]/reserve/route.ts` |
| 17 | MEDIUM | Auth | In-memory nonce replay protection fails across serverless instances | `lib/validation.ts:8,31-37` |
| 18 | MEDIUM | Rate Limit | In-memory rate limiting in production allows bypass across instances | `lib/rate-limit.ts:126-133` |
| 19 | MEDIUM | Bidding | Self-bidding across multiple accounts not prevented | `app/api/bids/route.ts:132` |
| 20 | MEDIUM | Configuration | Health endpoint reveals infrastructure configuration status | `app/api/health/route.ts:86-93` |
| 21 | MEDIUM | Listing | Listing edit allows modification while in RESERVED state | `lib/validation.ts:68` |
| 22 | LOW | Auth | Debug mode enabled in development exposes verbose auth errors | `lib/auth.ts:433` |
| 23 | LOW | Withdrawal | Withdrawal claim only updates DB flag, no on-chain verification | `app/api/withdrawals/[withdrawalId]/claim/route.ts:63-69` |
| 24 | LOW | Listing | startingPrice parsed as 0 when omitted allows zero-price auctions | `app/api/listings/route.ts:363` |
| 25 | LOW | Configuration | CSRF secret falls back to NEXTAUTH_SECRET | `lib/csrf.ts:18` |
| 26 | LOW | Configuration | Anchor.toml references default local wallet path | `Anchor.toml:16` |
| 27 | LOW | Listing | Price filter parameters not validated for negative values | `app/api/listings/route.ts:128-133` |

---

## Detailed Findings

---

### Finding 1: Offers Are Database-Only With No On-Chain Escrow Backing

**Severity:** CRITICAL
**Category:** Payment / Business Logic
**File:** `/home/user/App-Market/app/api/offers/route.ts`, lines 89-91

**Description:**
The offer creation endpoint contains a TODO comment acknowledging that Solana contract `place_offer` is never called. Offers are recorded only in the database with no funds locked in escrow. This means:
- A buyer can place unlimited offers with zero financial commitment.
- A seller who accepts an offer via `/api/offers/[offerId]/accept` creates a transaction record and marks the listing as RESERVED, but there are no actual funds in escrow.
- A malicious buyer can spam offers on all listings, get them accepted, lock listings into RESERVED state, and never pay.
- This effectively enables a denial-of-service attack on sellers by reserving their listings with phantom offers.

**Code Evidence:**
```typescript
// TODO: Call Solana contract place_offer instruction to create on-chain escrow.
// Without this, offers are database-only and not backed by locked funds.
// Requires: Complete IDL, offer escrow PDA creation, buyer signature.
```

**Recommended Fix:**
- Require an on-chain escrow deposit before recording the offer in the database.
- Only create the DB offer record after confirming the on-chain transaction succeeded.
- Alternatively, implement a deposit requirement (even a small percentage) to make spam offers costly.

---

### Finding 2: Mint Keypair Secret Key Leaked in API Response

**Severity:** CRITICAL
**Category:** Secrets
**File:** `/home/user/App-Market/app/api/token-launch/deploy/route.ts`, line 176

**Description:**
The token launch deploy endpoint returns the full secret key bytes of the vanity mint keypair directly in the API response body. While the keypair is meant for the client to co-sign the pool creation transaction, sending the raw secret key over the wire in a JSON response is extremely dangerous:
- The secret key is logged in browser developer tools, network inspection, and potentially in server logs.
- If the HTTP response is intercepted (MITM, CDN cache leak, logging middleware), the keypair is fully compromised.
- The keypair could be used to mint additional tokens or manipulate the pool.

**Code Evidence:**
```typescript
return NextResponse.json({
  // ...
  // Include the vanity keypair bytes for the client to co-sign
  // (the mint keypair must sign the pool creation tx)
  mintKeypairBytes: Array.from(decryptedKeypair.secretKey),
});
```

**Recommended Fix:**
- Never send private keys in API responses.
- Sign the transaction server-side using the mint keypair, then return only the partially-signed serialized transaction for the client to add their signature.
- If client-side signing is absolutely required, use a one-time ephemeral keypair exchange mechanism.

---

### Finding 3: Transaction Creation Does Not Verify On-Chain Payment

**Severity:** CRITICAL
**Category:** Payment
**File:** `/home/user/App-Market/app/api/transactions/route.ts`, lines 258-276

**Description:**
The POST endpoint for creating transactions (for auction wins and buy-now purchases) creates a database transaction record and updates the listing to "SOLD" status without verifying that an on-chain payment actually occurred. The `onChainTx` field is optional, and when provided, the payment amount is not verified against the on-chain transaction data. A malicious user could:
- Submit a request with a fabricated or unrelated `onChainTx` hash.
- Submit a request with no `onChainTx` at all (the field is optional).
- Claim to have won an auction and create a transaction record without paying.

Note: The `/api/purchases/route.ts` does verify on-chain transactions but gracefully fails with a catch-and-continue pattern (line 87-90), and also does not verify that the on-chain amount matches the claimed purchase price.

**Code Evidence:**
```typescript
// Create transaction
const transaction = await prisma.transaction.create({
  data: {
    salePrice,
    platformFee,
    sellerProceeds,
    // ...
    onChainTx,
    status: onChainTx ? "IN_ESCROW" : "PENDING",
    // ...
  },
});
// Update listing status
await prisma.listing.update({
  where: { id: listingId },
  data: { status: "SOLD" },
});
```

**Recommended Fix:**
- Require `onChainTx` to be present and verified before creating a transaction.
- Verify the on-chain transaction matches the expected amount, sender, and recipient.
- Do not mark listings as SOLD until on-chain payment is confirmed.
- Make on-chain verification mandatory (not optional) before state transitions.

---

### Finding 4: Escrow Auto-Release Updates DB Without On-Chain Fund Release

**Severity:** HIGH
**Category:** Escrow
**File:** `/home/user/App-Market/app/api/cron/escrow-auto-release/route.ts`, lines 119-126

**Description:**
The escrow auto-release cron job marks transactions as "COMPLETED" in the database and notifies sellers that funds have been released, but it never executes the actual on-chain release of escrowed funds. The code contains a TODO acknowledging this gap. This means:
- The seller sees "Funds Auto-Released" notifications but cannot actually withdraw funds.
- The database state diverges from the on-chain state, making reconciliation difficult.
- If the system later implements on-chain verification, these completed transactions will be inconsistent.

**Code Evidence:**
```typescript
// TODO: Execute on-chain refund transaction before updating database status.
// Currently funds remain locked in escrow. Requires:
// 1. Backend authority keypair to sign refund transactions
// 2. Complete IDL for refund_escrow instruction
// 3. Error handling for failed on-chain refunds
```

**Recommended Fix:**
- Implement on-chain fund release before updating DB status.
- Only mark as COMPLETED after on-chain confirmation.
- Add a reconciliation mechanism to detect and resolve state divergences.

---

### Finding 5: Expired Offers Mark DB as Expired but Never Refund On-Chain Escrow

**Severity:** HIGH
**Category:** Escrow
**File:** `/home/user/App-Market/app/api/cron/expired-offers/route.ts`, lines 89-99

**Description:**
The expired offers cron job marks offers as "EXPIRED" in the database and sends notifications saying "Any escrowed funds will be returned," but the on-chain refund is never executed. The code contains a critical TODO warning. If offers ever do get on-chain escrow backing (as intended), expired offers would have their funds permanently locked.

**Code Evidence:**
```typescript
// CRITICAL TODO: Execute on-chain refund transaction before updating database status.
// Currently funds remain locked in escrow. This MUST be implemented before mainnet.
// WARNING: Without this, expired offers have funds locked in escrow forever.
// Users are notified "funds will be returned" but currently they are NOT.
```

**Recommended Fix:**
- Implement on-chain refund execution before marking offers as expired.
- Only update DB status after on-chain refund succeeds.
- If on-chain refund fails, keep the offer in a "PENDING_REFUND" state and retry.

---

### Finding 6: Transfer Completion Updates DB Without Calling Smart Contract

**Severity:** HIGH
**Category:** Payment
**File:** `/home/user/App-Market/app/api/transfers/[id]/complete/route.ts`, lines 109-127

**Description:**
The transfer completion endpoint marks transactions as "COMPLETED" and calculates payment distributions for sellers and collaborators, but never calls the smart contract to actually release escrowed funds. The code contains a TODO noting this gap. This creates a discrepancy where:
- The database shows the transaction as completed.
- On-chain funds remain locked in escrow.
- Sellers and collaborators are notified of payments they cannot actually receive.

**Code Evidence:**
```typescript
// TODO: Call smart contract to release escrow to seller
// This would involve:
// 1. Getting the listing PDA
// 2. Calling the confirm_receipt instruction on the smart contract
// 3. The contract will automatically release funds to seller minus platform fee
//
// For now, we update the database to mark as completed
// In production, this should verify the on-chain transaction succeeded
```

**Recommended Fix:**
- Integrate the `confirmReceipt` smart contract call (already implemented in `lib/solana-contract.ts`).
- Only update DB status after on-chain confirmation.
- Implement fallback/retry logic for failed on-chain transactions.

---

### Finding 7: No Server-Side Price Floor Validation on Listing Creation

**Severity:** HIGH
**Category:** Listing
**File:** `/home/user/App-Market/app/api/listings/route.ts`, line 363

**Description:**
When creating a listing, the starting price is parsed with `parseFloat(startingPrice)` with a fallback to 0. There is no minimum price validation enforced server-side. The platform config defines `minStartingPrice: 0.1` but this is never checked in the listing creation endpoint. A seller could create an auction listing with a `startingPrice` of 0 or a very small fraction, potentially enabling:
- Listings used for testing or spam at no cost.
- Auctions starting at effectively zero, enabling wash trading to inflate platform statistics.

**Code Evidence:**
```typescript
const parsedStartingPrice = startingPrice ? parseFloat(startingPrice) : 0;
// No validation against PLATFORM_CONFIG.auction.minStartingPrice
```

**Recommended Fix:**
- Validate `startingPrice >= PLATFORM_CONFIG.auction.minStartingPrice` when the listing type is auction.
- Return a 400 error if the price is below the minimum.

---

### Finding 8: Default Secrets in .env.example Could Be Used in Production

**Severity:** HIGH
**Category:** Configuration
**File:** `/home/user/App-Market/.env.example`, lines 9, 68, 72

**Description:**
The `.env.example` file contains human-readable default values for critical secrets:
- `NEXTAUTH_SECRET="your-super-secret-key-change-in-production"`
- `ADMIN_SECRET="your-admin-secret-change-in-production"`
- `CRON_SECRET="your-cron-secret-change-in-production"`

While `.env` and `.env.local` are properly listed in `.gitignore`, if a developer copies `.env.example` to `.env` without changing these values, the application will run with known default secrets. The NEXTAUTH_SECRET check (line 42 of `lib/auth.ts`) only checks for presence, not for the default value.

**Recommended Fix:**
- Add startup validation that checks if secrets match known defaults and refuses to start in production mode.
- Use placeholder values like `CHANGE_ME_GENERATE_WITH_openssl_rand_hex_32` that cannot function as valid secrets.
- Add a startup check: `if (secret === "your-super-secret-key-change-in-production") throw new Error(...)`.

---

### Finding 9: Dispute Resolution Lacks Atomicity

**Severity:** MEDIUM
**Category:** Dispute
**File:** `/home/user/App-Market/app/api/disputes/[id]/route.ts`, lines 124-142

**Description:**
The dispute resolution POST handler updates the dispute record and the transaction record in separate, non-transactional database calls. If the server crashes between updating the dispute (line 124) and updating the transaction (line 135), the system will be in an inconsistent state where the dispute is "RESOLVED" but the transaction status has not been updated. This could result in:
- Funds remaining in escrow indefinitely.
- Inability to re-resolve the dispute (since it is already marked RESOLVED).

**Code Evidence:**
```typescript
// Update dispute
await prisma.dispute.update({
  where: { id: disputeId },
  data: { status: "RESOLVED", ... },
});
// Update transaction (separate call, not in a transaction)
await prisma.transaction.update({
  where: { id: transaction.id },
  data: { status: newTransactionStatus, ... },
});
```

**Recommended Fix:**
- Wrap both updates in a `prisma.$transaction()` to ensure atomicity.
- Consider using serializable isolation level for financial operations.

---

### Finding 10: Anti-Snipe Auction Extension Happens Outside Serializable Transaction

**Severity:** MEDIUM
**Category:** Bidding
**File:** `/home/user/App-Market/app/api/bids/route.ts`, lines 231-266

**Description:**
The bid placement uses a serializable transaction for the critical bid logic (checking listing status, comparing amounts, creating the bid). However, the anti-snipe auction extension logic runs *outside* this transaction. This creates a race condition where:
- Two bids placed simultaneously in the anti-snipe window could both extend the auction.
- The `endTime` update could overwrite a concurrent update.
- The listing's `endTime` read at line 232 could be stale if another bid has already extended it.

**Code Evidence:**
```typescript
// Inside serializable transaction: bid creation logic
}, { isolationLevel: 'Serializable' });

// OUTSIDE transaction: anti-snipe extension
const timeUntilEndMs = listing.endTime.getTime() - now.getTime();
if (timeUntilEndMs > 0 && timeUntilEndMs <= antiSnipeWindowMs) {
  await prisma.listing.update({ ... });
}
```

**Recommended Fix:**
- Move the anti-snipe extension logic inside the serializable transaction.
- Use the freshly queried listing data from inside the transaction for the endTime check.

---

### Findings 11-16: Missing CSRF Validation on State-Changing Endpoints

**Severity:** MEDIUM
**Category:** CSRF
**Files:**
- `app/api/offers/[offerId]/accept/route.ts` (Finding 11)
- `app/api/offers/[offerId]/cancel/route.ts` (Finding 12)
- `app/api/disputes/route.ts` POST handler (Finding 13)
- `app/api/transactions/[id]/confirm/route.ts` (Finding 14)
- `app/api/transfers/[id]/complete/route.ts` (Finding 15)
- `app/api/listings/[slug]/reserve/route.ts` (Finding 16)

**Description:**
Several state-changing POST endpoints do not validate CSRF tokens. While the main listing creation, bid placement, offer creation, and purchase endpoints properly call `validateCsrfRequest()`, the above endpoints skip CSRF validation. Although SameSite=Lax cookies and JSON content-type requirements provide some protection, explicit CSRF validation should be applied consistently to all mutation endpoints as defense-in-depth.

**Recommended Fix:**
- Add `validateCsrfRequest(request)` checks at the beginning of each POST/PUT/DELETE handler.
- Consider using the `withCsrfProtection` higher-order function defined in `lib/csrf.ts` for consistent application.

---

### Finding 17: In-Memory Nonce Replay Protection Fails Across Serverless Instances

**Severity:** MEDIUM
**Category:** Authentication
**File:** `/home/user/App-Market/lib/validation.ts`, lines 8, 31-37

**Description:**
The wallet signature nonce replay protection uses an in-memory `Map` as a fallback when Redis (Upstash) is not configured. In a serverless environment like Vercel, each function invocation may run in a different instance with its own memory space. This means:
- A signature nonce used in one instance will not be detected as "already used" in another instance.
- Replay attacks become possible by sending the same signed message to different serverless instances.
- The code correctly uses Redis when configured, but the fallback is insecure for production serverless deployments.

**Code Evidence:**
```typescript
const usedSignatureNonces = new Map<string, number>();
// ...
async function hasNonceBeenUsed(nonceKey: string): Promise<boolean> {
  const redis = await getNonceRedis();
  if (redis) {
    const exists = await redis.get(`nonce:${nonceKey}`);
    return !!exists;
  }
  return usedSignatureNonces.has(nonceKey); // Unreliable in serverless
}
```

**Recommended Fix:**
- Make Redis (Upstash) a required dependency for production deployments.
- Add a startup check that refuses to start in production without Redis configured.
- Alternatively, use the database for nonce tracking as a reliable fallback.

---

### Finding 18: In-Memory Rate Limiting in Production Allows Bypass Across Instances

**Severity:** MEDIUM
**Category:** Rate Limiting
**File:** `/home/user/App-Market/lib/rate-limit.ts`, lines 126-133

**Description:**
Similar to Finding 17, the rate limiting falls back to an in-memory store when Upstash Redis is not configured. The code logs a "CRITICAL" warning but does not block requests. In a serverless environment, this means:
- Rate limits are per-instance, not global.
- An attacker can effectively multiply their rate limit by the number of active serverless instances.

**Code Evidence:**
```typescript
if (process.env.NODE_ENV === "production") {
  console.error(
    "CRITICAL: Rate limiting falling back to in-memory in production! ..."
  );
}
// Continues with in-memory rate limiting instead of blocking
```

**Recommended Fix:**
- Reject requests or significantly reduce limits when Redis is unavailable in production.
- Add a startup or health check that flags this as an operational error.

---

### Finding 19: Self-Bidding Across Multiple Accounts Not Prevented

**Severity:** MEDIUM
**Category:** Bidding / Auction
**File:** `/home/user/App-Market/app/api/bids/route.ts`, line 132

**Description:**
The bidding logic prevents a seller from bidding on their own listing (`listing.sellerId === userId`) but does not prevent shill bidding through alternate accounts. A seller could:
1. Create a second wallet and account.
2. Bid on their own listing to artificially inflate the price.
3. If they become the winning bidder, they only pay platform fees to themselves.

This is a fundamental limitation of pseudonymous blockchain marketplaces, but the platform could implement heuristic detection.

**Recommended Fix:**
- Implement shill bidding detection heuristics (same IP, similar timing patterns, wallet funding chains).
- Require a minimum account age or verification level to bid.
- Consider requiring a bid deposit that is forfeited if the winner does not complete the purchase.
- The existing `consecutiveOfferCount` mechanism on-chain provides some protection for offers, but not for auction bids.

---

### Finding 20: Health Endpoint Reveals Infrastructure Configuration Status

**Severity:** MEDIUM
**Category:** Configuration / Information Disclosure
**File:** `/home/user/App-Market/app/api/health/route.ts`, lines 86-93

**Description:**
The public health check endpoint reveals whether specific environment variables are configured (NEXTAUTH_SECRET, ENCRYPTION_SECRET, CRON_SECRET, DATABASE_URL). While it does not expose the values, knowing which variables are or are not configured provides an attacker with information about the infrastructure and potential attack vectors. It also reveals Redis and Solana RPC availability and latency.

**Code Evidence:**
```typescript
checks.config = {
  status: [
    "NEXTAUTH_SECRET",
    "ENCRYPTION_SECRET",
    "CRON_SECRET",
    "DATABASE_URL",
  ].every(v => !!process.env[v]) ? "ok" : "missing_vars",
};
```

**Recommended Fix:**
- Restrict the detailed health check to authenticated/admin requests.
- Return only a simple "ok" or "error" for the public endpoint.
- Move infrastructure details behind an admin-authenticated health endpoint.

---

### Finding 21: Listing Edit Allowed While in RESERVED State

**Severity:** MEDIUM
**Category:** Listing
**File:** `/home/user/App-Market/lib/validation.ts`, line 68

**Description:**
The `EDITABLE_LISTING_STATES` array includes "RESERVED", which means a seller can edit listing details (title, tagline, description, URLs) even after a buyer has reserved the listing. This could be exploited to:
- Change the listing description after a buyer has committed based on the original terms.
- Modify demo URLs or video links to point to different content.
- Although the edit endpoint prevents modification when bids exist, reserved listings (from offers) do not necessarily have bids.

**Code Evidence:**
```typescript
export const EDITABLE_LISTING_STATES = ['ACTIVE', 'RESERVED', 'PENDING_COLLABORATORS', 'DRAFT'];
```

**Recommended Fix:**
- Remove "RESERVED" from `EDITABLE_LISTING_STATES` or restrict editable fields to non-material changes.
- Alternatively, notify the reserved buyer when any edit is made.

---

### Finding 22: Debug Mode Enabled in Development Exposes Verbose Auth Errors

**Severity:** LOW
**Category:** Authentication / Configuration
**File:** `/home/user/App-Market/lib/auth.ts`, line 433

**Description:**
NextAuth debug mode is enabled when `NODE_ENV === 'development'`. While this is standard practice and only affects development environments, if `NODE_ENV` is accidentally left as "development" in a production deployment, verbose authentication errors and internal state would be logged, potentially exposing sensitive information.

**Code Evidence:**
```typescript
debug: process.env.NODE_ENV === 'development',
```

**Recommended Fix:**
- This is acceptable for development. Ensure deployment pipelines always set `NODE_ENV=production`.
- Consider adding a startup check that warns if debug-related settings are active in production.

---

### Finding 23: Withdrawal Claim Only Updates DB Flag

**Severity:** LOW
**Category:** Withdrawal
**File:** `/home/user/App-Market/app/api/withdrawals/[withdrawalId]/claim/route.ts`, lines 63-69

**Description:**
The withdrawal claim endpoint only sets `claimed: true` in the database. The actual on-chain withdrawal is expected to be handled by the frontend calling the smart contract. However, if the frontend call fails after the DB is updated, the withdrawal will be marked as claimed but funds won't have moved. The system has no reconciliation for this state.

**Recommended Fix:**
- Track the on-chain withdrawal transaction hash in the database.
- Add a reconciliation process that verifies claimed withdrawals against on-chain state.
- Consider implementing a "CLAIMING" intermediate status.

---

### Finding 24: startingPrice Parsed as 0 Allows Zero-Price Auctions

**Severity:** LOW
**Category:** Listing
**File:** `/home/user/App-Market/app/api/listings/route.ts`, line 363

**Description:**
When `startingPrice` is not provided (or is an empty string), it defaults to 0: `startingPrice ? parseFloat(startingPrice) : 0`. Combined with the `buyNowEnabled` check (line 345), a listing can be created as "Buy Now only" with `startingPrice = 0`. This is by design for Buy Now listings, but the 0 starting price is stored in the database and could lead to unexpected behavior if the listing type is later changed or if auction functionality is accidentally enabled.

**Recommended Fix:**
- Validate that if a listing is an auction type, `startingPrice` must be >= `PLATFORM_CONFIG.auction.minStartingPrice`.
- For Buy Now only listings, explicitly set the starting price to null instead of 0.

---

### Finding 25: CSRF Secret Falls Back to NEXTAUTH_SECRET

**Severity:** LOW
**Category:** Configuration
**File:** `/home/user/App-Market/lib/csrf.ts`, line 18

**Description:**
The CSRF token generation uses `CSRF_SECRET` if available, falling back to `NEXTAUTH_SECRET`. While this is a reasonable fallback for development, sharing the secret between CSRF and session management slightly reduces the security isolation. If `NEXTAUTH_SECRET` is compromised, CSRF protection is also defeated.

**Code Evidence:**
```typescript
function getCsrfSecret(): string {
  const secret = process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET;
  // ...
}
```

**Recommended Fix:**
- Set a dedicated `CSRF_SECRET` in production environments.
- Add a startup warning when falling back to `NEXTAUTH_SECRET` for CSRF.

---

### Finding 26: Anchor.toml References Default Local Wallet Path

**Severity:** LOW
**Category:** Configuration
**File:** `/home/user/App-Market/Anchor.toml`, line 16

**Description:**
The Anchor configuration references `~/.config/solana/id.json` as the wallet path. This is the default Solana CLI keypair location. If this configuration is used in CI/CD or deployment environments, it may accidentally use a developer's personal keypair for contract deployment.

**Code Evidence:**
```toml
[provider]
cluster = "devnet"
wallet = "~/.config/solana/id.json"
```

**Recommended Fix:**
- Use environment-specific Anchor configuration.
- Never reference default keypair paths in committed configuration.

---

### Finding 27: Price Filter Parameters Not Validated for Negative Values

**Severity:** LOW
**Category:** Listing / Search
**File:** `/home/user/App-Market/app/api/listings/route.ts`, lines 128-133

**Description:**
The `minPrice` and `maxPrice` query parameters are parsed with `parseFloat()` but not validated for negative values. While negative prices would simply return no results (no listings have negative prices), the lack of validation means the database receives potentially nonsensical query parameters.

**Code Evidence:**
```typescript
if (minPrice) {
  where.startingPrice = { gte: parseFloat(minPrice) };
}
if (maxPrice) {
  where.startingPrice = { ...where.startingPrice, lte: parseFloat(maxPrice) };
}
```

**Recommended Fix:**
- Validate that price filters are non-negative numbers.
- Return a 400 error for invalid price ranges (e.g., minPrice > maxPrice).

---

## Positive Security Observations

The following security measures are well-implemented and deserve recognition:

1. **Serializable transactions for critical operations:** The bid placement (`/api/bids`) and purchase (`/api/purchases`) endpoints use `isolationLevel: 'Serializable'` to prevent race conditions and double-purchases. The offer acceptance endpoint uses `prisma.$transaction()` with re-checking of listing status.

2. **Constant-time comparison:** Admin secret validation (`/api/admin/reset-listings`), cron secret validation (`lib/cron-auth.ts`), CSRF token verification (`lib/csrf.ts`), and webhook signature verification all use `timingSafeEqual` to prevent timing attacks.

3. **Session revocation system:** The database-backed session revocation system (`lib/auth.ts`) properly handles revocation across serverless instances using the database as the source of truth.

4. **Admin role enforcement:** Admin endpoints check `isAdmin` from the database (not just the JWT token), and the JWT callback refreshes admin status on every token refresh to prevent stale privileges.

5. **Seller cannot bid on own listing:** Server-side validation prevents a seller from bidding on or purchasing their own listing.

6. **Listing edit prevention after bids:** The listing update endpoint correctly prevents editing listings that have received bids, preventing price manipulation after bidding starts.

7. **Anti-snipe auction extension:** The 15-minute anti-snipe window and extension mechanism prevents last-second bid sniping.

8. **Comprehensive security headers:** The Next.js config includes HSTS, CSP, X-Frame-Options, X-Content-Type-Options, and Permissions-Policy headers.

9. **Encryption at rest:** OAuth tokens are encrypted using AES-256-GCM with per-record salts and a dedicated ENCRYPTION_SECRET separate from NEXTAUTH_SECRET.

10. **Wallet signature replay protection:** The nonce-based replay protection with Redis-backed storage (when configured) prevents signature reuse within the 5-minute validity window.

11. **URL and input validation:** URL fields are validated for safe protocols (http/https only), wallet addresses are validated against Base58 format, and pagination is bounded with `MAX_PAGINATION_LIMIT`.

12. **API key security:** Agent API keys use bcrypt hashing (12 rounds) for storage and base58-encoded random bytes for generation.

13. **.gitignore coverage:** Both `.env` and `.env.local` are properly listed in `.gitignore`, preventing accidental secret commits.

---

## Recommendations Priority Matrix

### Immediate (Before Production Launch)
1. **Finding 1:** Implement on-chain escrow for offers, or add a deposit requirement.
2. **Finding 2:** Remove mint keypair secret key from API response; sign server-side.
3. **Finding 3:** Require and verify on-chain payment before creating transaction records.
4. **Finding 4-6:** Implement on-chain operations for all financial state transitions.
5. **Finding 8:** Add startup validation rejecting known default secrets.

### Short-Term (Within 2 Weeks)
6. **Findings 11-16:** Add CSRF validation to all state-changing endpoints.
7. **Finding 9:** Wrap dispute resolution in a database transaction.
8. **Finding 10:** Move anti-snipe logic inside the serializable transaction.
9. **Finding 17-18:** Require Redis for production deployments.

### Medium-Term (Within 1 Month)
10. **Finding 19:** Implement shill bidding detection heuristics.
11. **Finding 20:** Restrict health check details to authenticated requests.
12. **Finding 21:** Remove RESERVED from editable states.

### Low Priority
13. **Findings 22-27:** Address as part of regular maintenance cycles.
