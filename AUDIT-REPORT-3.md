# Full-Stack Security & Code Quality Audit Report #3

**Date:** 2026-02-12
**Scope:** End-to-end audit of all API routes, Prisma schema, auth, financial logic, crypto/blockchain, cron jobs, middleware, and client-facing code
**Methodology:** Manual source-code review of every file in the codebase, cross-referencing data flow across layers
**Standard:** OWASP Top 10, smart contract security best practices, financial application controls

---

## Executive Summary

This third full-stack audit discovered **32 new findings** across the codebase. The most severe cluster is a **dual-path transaction completion bug** where the `confirm` and `complete` endpoints both independently mark transactions as COMPLETED and increment user stats — but with different logic, missing safeguards, and the potential for double-counting. Additional critical findings include partner purchases leaving listings purchasable by others (stranding on-chain funds), offers lacking on-chain escrow backing, and several cascade-delete violations that would destroy financial records.

| Severity | Count |
|----------|-------|
| CRITICAL | 5 |
| HIGH | 8 |
| MEDIUM | 12 |
| LOW | 7 |
| **Total** | **32** |

---

## CRITICAL Findings

### C1: Dual-path completion — `confirm` and `complete` both mark COMPLETED and increment stats

**Files:**
- `app/api/transactions/[id]/confirm/route.ts` lines 199-229
- `app/api/transfers/[id]/complete/route.ts` lines 177-211

**Issue:** Two completely independent endpoints can both set a transaction to COMPLETED and atomically increment `totalSales`, `totalPurchases`, and `totalVolume`:

- **`confirm`** (line 199): When the last checklist item is confirmed, auto-sets status to COMPLETED and increments seller/buyer stats inside its Serializable transaction.
- **`complete`** (line 177): The buyer explicitly calls this to complete the transfer; it also sets COMPLETED and increments seller/buyer stats inside its own Serializable transaction.

The `complete` endpoint checks `transaction.status === "COMPLETED"` at line 94 and re-reads at line 131 — but both checks are **outside** the Serializable transaction block (which starts at line 177). Race window:

1. Buyer confirms last checklist item → `confirm` Serializable tx starts
2. Buyer simultaneously calls `complete` → reads status as non-COMPLETED (confirm tx hasn't committed)
3. `confirm` tx commits → status = COMPLETED, stats incremented
4. `complete` Serializable tx starts at line 177 → does NOT re-read status inside the tx → increments stats again

**Impact:** User stats (totalSales, totalPurchases, totalVolume) are **doubled**. Leaderboard rankings, seller levels, and super-badge qualification are corrupted.

**Severity:** CRITICAL

---

### C2: `confirm` auto-completes without fee reconciliation, on-chain release, referral processing, or collaborator payments

**Files:**
- `app/api/transactions/[id]/confirm/route.ts` lines 199-229
- `app/api/transfers/[id]/complete/route.ts` lines 157-340

**Issue:** When `confirm` auto-completes a transaction (all checklist items confirmed), it skips 5 critical steps that the `complete` endpoint performs:

| Step | `complete` does it | `confirm` does it |
|------|-------------------|-------------------|
| Fee reconciliation (H4 check) | Yes (line 157-173) | **NO** |
| On-chain escrow release warning (C3) | Yes (line 116-122) | **NO** |
| Referral earnings processing | Yes (line 214-226) | **NO** |
| Collaborator payment calculation & storage | Yes (line 228-290) | **NO** |
| Collaborator notification & stat updates | Yes (line 312-340) | **NO** |

**Impact:**
- Transactions can complete with corrupt fee data (fee + proceeds != salePrice)
- Referral earnings are silently lost (referrers never get paid)
- Collaborators never receive payment distribution data or notifications
- No collaborator volume stats are updated

**Severity:** CRITICAL

---

### C3: Partner purchases don't lock listing — other buyers can strand on-chain funds

**File:** `app/api/purchases/route.ts` lines 312-316

**Issue:** When a purchase includes partners (`withPartners = true`), the listing status is NOT updated:
```javascript
if (!withPartners) {
  await tx.listing.update({ where: { id: listingId }, data: { status: "SOLD" } });
}
```

The listing remains ACTIVE while waiting for partner deposits. Another buyer can:
1. See the listing as ACTIVE
2. Pay on-chain (SOL transferred to treasury)
3. Attempt the DB transaction → rejected by `listingId` unique constraint on Transaction
4. Their SOL is now stuck in the treasury with no Transaction record and no refund path

**Impact:** Permanent loss of buyer funds. The on-chain payment succeeds but the off-chain record is never created.

**Severity:** CRITICAL

---

### C4: Offers have no on-chain escrow — accepted offers can't guarantee payment

**File:** `app/api/offers/route.ts` lines 118-120

**Issue:** The TODO at line 118 explicitly states:
```javascript
// TODO: Call Solana contract place_offer instruction to create on-chain escrow.
// Without on-chain escrow, offers are not backed by locked funds.
```

Offers are purely database records with no locked funds. When a seller accepts an offer, there is zero guarantee the buyer has the SOL. The seller reserves/modifies their listing based on an unbacked promise.

**Impact:** Sellers can be griefed by fake offers. Accepting an offer may take the listing off-market for a buyer who can't or won't pay.

**Severity:** CRITICAL

---

### C5: `confirm` gives buyer `totalVolume` credit but `complete` does not — inconsistent stats

**Files:**
- `app/api/transactions/[id]/confirm/route.ts` line 226-227: `totalVolume: { increment: Number(transaction.salePrice) }` for buyer
- `app/api/transfers/[id]/complete/route.ts` line 207-209: Only `totalPurchases: { increment: 1 }` for buyer, **no totalVolume**

**Issue:** Depending on which path completes the transaction, the buyer's `totalVolume` either gets incremented or not. This is a data integrity issue affecting:
- Leaderboard rankings (buyers ranked by totalVolume would be inconsistent)
- Super-buyer badge qualification
- Any analytics depending on buyer volume

**Severity:** CRITICAL (data integrity)

---

## HIGH Findings

### H1: Escrow auto-release cron doesn't update listing status

**File:** `app/api/cron/escrow-auto-release/route.ts` lines 132-137

**Issue:** When the transfer deadline passes, the cron sets the transaction to `PENDING_RELEASE` but never updates the listing status. The listing remains in whatever state it was in (likely `SOLD` from the purchase), but if completed via the `confirm` path which also doesn't update listing status, the listing could remain as `ACTIVE` or `TRANSFER_IN_PROGRESS` — an inconsistent state.

**Severity:** HIGH

---

### H2: Listing GET exposes full wallet addresses of all bidders

**File:** `app/api/listings/[slug]/route.ts` line 53

**Issue:** The bidder `select` includes `walletAddress: true`, exposing every bidder's full Solana wallet address to any public viewer of the listing. This leaks financial identity information.

**Severity:** HIGH

---

### H3: Bid currency mismatch — cross-currency bid comparison

**File:** `app/api/bids/route.ts` line 194

**Issue:** `currency: currency || listing.currency` — a bidder can submit a bid with a different currency than the listing's. The amount comparison (lines 155-163) compares raw numbers without currency conversion. A bid of "100 USDC" would appear higher than "50 SOL" even if 50 SOL is worth more.

**Severity:** HIGH

---

### H4: Review comment stored without XSS sanitization

**File:** `app/api/reviews/route.ts`

**Issue:** Review comments are stored as raw user input with no HTML encoding or sanitization. Unlike messages (which are HTML-encoded), review comments go directly into the database. If rendered without escaping on the frontend, this is stored XSS.

**Severity:** HIGH

---

### H5: Notification message preview uses unsanitized content

**File:** `app/api/messages/[conversationId]/route.ts`

**Issue:** While the main message `content` and `lastMessagePreview` are both HTML-encoded, the notification's `data` field contains:
```javascript
messagePreview: content.substring(0, 50)  // original unsanitized content
```
If the notification data's `messagePreview` is rendered as HTML anywhere (mobile push, email digest, etc.), it's an XSS vector.

**Severity:** HIGH

---

### H6: Partner percentage sum not validated in purchases

**File:** `app/api/purchases/route.ts` lines 72-93, 296-308

**Issue:** The endpoint validates `leadBuyerPercentage` individually (line 73) but never validates that all partner percentages + lead buyer percentage sum to exactly 100%. Partners could be created with percentages that don't add up, causing incorrect deposit calculations.

**Severity:** HIGH

---

### H7: Token launch deploy doesn't verify on-chain submission

**File:** `app/api/token-launch/deploy/route.ts` lines 140-146

**Issue:** After building the pool creation transaction, the status is updated to `LAUNCHING` and a pool watcher is registered — but there's no verification the client actually submitted the transaction to Solana. The client could:
1. Get the serialized transactions
2. Never submit them
3. Token launch stays in `LAUNCHING` forever with no cleanup mechanism

There's no cron or timeout that resets `LAUNCHING` back to `PENDING`.

**Severity:** HIGH

---

### H8: Token launch PATCH accepts `onChainTx` without on-chain verification

**File:** `app/api/token-launch/[id]/route.ts`

**Issue:** The PATCH endpoint accepts `onChainTx` in the request body and stores it directly without verifying it on-chain. Unlike the purchases endpoint (which does full on-chain verification including amount, recipient, and sender), the token launch just trusts client-provided transaction signatures.

**Severity:** HIGH

---

## MEDIUM Findings

### M1: Listing duration config says max 30 but route allows 90

**Files:**
- `lib/config.ts`: `maxDuration: 30` (30 days)
- `app/api/listings/route.ts` line 460: `Math.min(Math.max(parseInt(duration) || 7, 1), 90)`

**Issue:** The route hardcodes a 90-day max that contradicts the config's 30-day max. The config value is never consulted.

**Severity:** MEDIUM

---

### M2: Stats endpoint exposes financial metrics without auth and doesn't filter deleted users

**File:** `app/api/stats/route.ts`

**Issue:**
1. No authentication — anyone can see total platform volume, total sales, active sellers count
2. Counts include transactions involving deleted users
3. `activeSellers` count doesn't filter `deletedAt: null`

**Severity:** MEDIUM

---

### M3: Check-graduations cron has no batch limit

**File:** `app/api/cron/check-graduations/route.ts` line 26

**Issue:** `findMany` without `take` — if thousands of token launches are active, this returns unbounded results and then makes sequential RPC calls for each, likely timing out the serverless function.

**Severity:** MEDIUM

---

### M4: Expired offers cron permanently deletes records

**File:** `app/api/cron/expired-offers/route.ts` lines 255-276

**Issue:** Expired and cancelled offers are permanently deleted after 24 hours. This destroys:
- Audit trail of offer history
- Records of offers with on-chain escrow that may not have been refunded
- Data needed for dispute resolution

Should use soft-delete or archive pattern.

**Severity:** MEDIUM

---

### M5: Slug generation race condition

**File:** `app/api/listings/route.ts`

**Issue:** Slug is generated from the title + random suffix, then existence is checked, then the listing is created. This sequence is NOT inside a transaction. Two concurrent requests with the same title could generate the same slug (millisecond collision on `Date.now().toString(36)`), both pass the check, and one fails on the unique constraint.

**Severity:** MEDIUM

---

### M6: Review creation not transactional — duplicate messaging reviews possible

**File:** `app/api/reviews/route.ts`

**Issue:** The duplicate check for messaging reviews (checking existing review by conversationId + authorId) and the review creation are not wrapped in a transaction. Two concurrent requests could both pass the check and create duplicates. Transaction reviews are protected by the `@@unique([transactionId, authorId])` constraint, but messaging reviews rely only on `@@unique([conversationId, authorId])` which Prisma would catch — but the user would get a 500 error instead of a clean 400.

**Severity:** MEDIUM

---

### M7: Review rating update not atomic with review creation

**File:** `app/api/reviews/route.ts`

**Issue:** After creating a review, the user's aggregate rating is recalculated via a separate query outside any transaction. If the aggregate update fails, the review exists but the subject's `rating` and `ratingCount` fields are stale until the next review triggers recalculation.

**Severity:** MEDIUM

---

### M8: `confirm` doesn't update listing status to SOLD

**File:** `app/api/transactions/[id]/confirm/route.ts` lines 199-229

**Issue:** When the `confirm` path auto-completes a transaction, it updates the transaction status to COMPLETED but never updates the listing status. The `complete` endpoint explicitly sets listing status to SOLD (line 190-193). This means listings completed via the `confirm` path may never show as SOLD.

**Severity:** MEDIUM

---

### M9: TokenLaunch cascade delete on listing

**File:** `prisma/schema.prisma` line 912

**Issue:** `listing Listing @relation(..., onDelete: Cascade)` — deleting a listing cascades deletion of all associated token launch records, destroying fee tracking data, token metadata, and pool addresses.

**Severity:** MEDIUM

---

### M10: Bid cascade delete on listing

**File:** `prisma/schema.prisma` line 400

**Issue:** `listing Listing @relation(..., onDelete: Cascade)` — deleting a listing destroys all bid records, including financial data and on-chain transaction references.

**Severity:** MEDIUM

---

### M11: Offer cascade delete on listing

**File:** `prisma/schema.prisma` line 433

**Issue:** `listing Listing @relation(..., onDelete: Cascade)` — deleting a listing cascades deletion of all offers, including those with on-chain escrow references that may still hold funds.

**Severity:** MEDIUM

---

### M12: ListingCollaborator cascade delete on listing

**File:** `prisma/schema.prisma` line 234

**Issue:** `listing Listing @relation(..., onDelete: Cascade)` — deleting a listing silently destroys all collaborator records, including accepted collaborators with payment percentage agreements.

**Severity:** MEDIUM

---

## LOW Findings

### L1: Config buybackPercentage unbounded

**File:** `lib/config.ts`

**Issue:** `parseInt(process.env.BUYBACK_PERCENTAGE || "20")` has no bounds check. A misconfigured env var (e.g., `BUYBACK_PERCENTAGE=200`) would attempt to use 200% of revenue for buyback.

**Severity:** LOW

---

### L2: Missing rate limit on listing search (GET)

**File:** `app/api/listings/route.ts` GET handler

**Issue:** The listing search endpoint has no rate limiting. The `contains` + `mode: "insensitive"` pattern (used for search) is expensive for PostgreSQL. An attacker can spam complex search queries to degrade database performance.

**Severity:** LOW

---

### L3: Dispute fields appear redundant

**File:** `prisma/schema.prisma` (User model) + `app/api/disputes/route.ts`

**Issue:** The User model has both `totalDisputes` and `disputeCount` fields that appear to track the same thing. The disputes route increments both, doubling the inflation of dispute statistics.

**Severity:** LOW

---

### L4: Deploy pool watcher fire-and-forget

**File:** `app/api/token-launch/deploy/route.ts` line 149

**Issue:** `watchPoolForGraduation().catch(...)` — if the pool watcher registration fails, it's silently swallowed. The pool will only be detected by the hourly cron fallback, not real-time.

**Severity:** LOW

---

### L5: Referral earnings outside atomic transaction

**File:** `app/api/transfers/[id]/complete/route.ts` lines 213-226

**Issue:** `processReferralEarnings` runs AFTER the Serializable transaction commits. If it fails (and the error is caught and swallowed at line 223), the transaction is marked COMPLETED but referral earnings are silently lost with only a console.error.

**Severity:** LOW (but financial impact for referrers)

---

### L6: Collaborator stats updates outside atomic transaction

**File:** `app/api/transfers/[id]/complete/route.ts` lines 332-338

**Issue:** Collaborator `totalVolume` increments and notification creates happen outside the atomic transaction. If the server crashes mid-loop, some collaborators get credited and notified while others don't.

**Severity:** LOW

---

### L7: Payment distribution stored outside atomic transaction

**File:** `app/api/transfers/[id]/complete/route.ts` lines 282-290

**Issue:** The `paymentDistribution` data is stored in a separate `prisma.transaction.update()` call AFTER the Serializable transaction that marks the transaction as COMPLETED. If this second update fails, the transaction is COMPLETED but has no payment distribution record.

**Severity:** LOW

---

## Summary of Findings by Category

| Category | Findings |
|----------|----------|
| Transaction completion logic | C1, C2, C5, M8 |
| Financial integrity | C3, C4, H6, L1, L5, L6, L7 |
| Data integrity / Schema | M9, M10, M11, M12, L3 |
| Input validation | H3, H8, M1, M5 |
| XSS / Output encoding | H4, H5 |
| Information disclosure | H2, M2 |
| Missing verification | H7, H8 |
| Cron / Background jobs | H1, M3, M4 |
| Race conditions | M5, M6, M7 |
| Operational | L2, L4 |

---

## Recommendations

### Immediate (P0 — before any production launch)

1. **Unify transaction completion into a single path.** Either remove auto-completion from `confirm` and require explicit `complete` calls, or make `confirm` delegate to the same completion logic as `complete`. The current dual-path is the source of 4 of the 5 critical findings.

2. **Lock listing on partner purchases.** Set listing status to `RESERVED` when a partner purchase is initiated, preventing other buyers from paying on-chain for an already-sold listing.

3. **Implement on-chain escrow for offers** or clearly communicate to sellers that offers are non-binding and not backed by funds.

### Short-term (P1 — within 1 sprint)

4. Sanitize review comments (HTML-encode like messages)
5. Validate partner percentage totals sum to 100%
6. Mask bidder wallet addresses in public listing responses
7. Add cleanup cron for stuck `LAUNCHING` token launches
8. Add batch limits to graduation check cron
9. Soft-delete expired offers instead of hard-deleting

### Medium-term (P2)

10. Change cascade deletes on Listing → TokenLaunch, Bid, Offer, Collaborator to `Restrict`
11. Add rate limiting to listing search GET
12. Move referral earnings and collaborator payments inside the completion transaction
13. Add on-chain tx verification for token launch status updates
14. Deduplicate `totalDisputes` and `disputeCount` fields
15. Use config values for listing duration cap instead of hardcoded 90
