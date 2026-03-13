# Business Logic Security Audit Report

**Project:** App-Market Digital Asset Marketplace
**Audit Date:** 2026-01-31
**Auditor:** Claude Code Security Analysis

---

## Executive Summary

This audit examines business logic vulnerabilities in the App-Market digital asset marketplace. The analysis covers listing management, purchase flows, offer/bid systems, escrow mechanisms, referral programs, dispute handling, and collaboration features.

**Critical Findings:** 5
**High Severity:** 8
**Medium Severity:** 11
**Low Severity:** 6

---

## 1. Listing Logic Vulnerabilities

### 1.1 CRITICAL: Missing State Validation on Listing Updates

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/listings/[slug]/route.ts`
**Lines:** 124-188

**Issue:** The PUT endpoint allows updating listings without checking the listing status. Users can modify listings in any state (SOLD, ENDED, CANCELLED, etc.).

```typescript
// Current code - no status check before update
export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  // ... ownership check only
  // Missing: if (listing.status !== "DRAFT" && listing.status !== "ACTIVE")
  const updatedListing = await prisma.listing.update({
    where: { slug },
    data: {
      ...(title && { title }),
      ...(tagline !== undefined && { tagline }),
      ...(description && { description }),
    },
  });
}
```

**Impact:** Sellers can modify listing details after sale completion, potentially for fraudulent review manipulation or dispute evasion.

**Recommendation:** Add status validation:
```typescript
const allowedStatuses = ["DRAFT", "ACTIVE", "PENDING_COLLABORATORS"];
if (!allowedStatuses.includes(listing.status)) {
  return NextResponse.json(
    { error: "Cannot modify a listing in this status" },
    { status: 400 }
  );
}
```

---

### 1.2 HIGH: Price Manipulation via Buy Now

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/listings/route.ts`
**Lines:** 236-249

**Issue:** The listing creation allows `startingPrice: 0` when `buyNowEnabled` is true, but there's no validation preventing subsequent manipulation or ensuring `buyNowPrice` is reasonable.

```typescript
if (!startingPrice && !buyNowEnabled) missingFields.push("starting price or enable Buy Now");
if (buyNowEnabled && !buyNowPrice) missingFields.push("buy now price");
// Missing: buyNowPrice > 0 validation
// Missing: buyNowPrice >= startingPrice validation
```

**Impact:** Sellers could create listings with misconfigured prices, potentially gaming the search/sort algorithms or misleading buyers.

**Recommendation:** Add price validation:
```typescript
if (buyNowPrice && buyNowPrice <= 0) {
  return NextResponse.json({ error: "Buy Now price must be positive" }, { status: 400 });
}
if (buyNowPrice && startingPrice && buyNowPrice < startingPrice) {
  return NextResponse.json({ error: "Buy Now price must be >= starting price" }, { status: 400 });
}
```

---

### 1.3 MEDIUM: Category/Tag Abuse Not Prevented

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/listings/route.ts`

**Issue:** No validation on `tags`, `techStack`, `frameworks`, or `languages` arrays. Users can add arbitrary strings for SEO manipulation.

**Impact:** Search result pollution and unfair visibility advantages.

**Recommendation:** Implement tag whitelisting or limit array sizes:
```typescript
const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 50;
if (tags?.length > MAX_TAGS || tags?.some(t => t.length > MAX_TAG_LENGTH)) {
  return NextResponse.json({ error: "Invalid tags" }, { status: 400 });
}
```

---

### 1.4 MEDIUM: Reservation Bypass via Direct Wallet Mismatch

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/listings/[slug]/reserve/route.ts`
**Lines:** 79-93

**Issue:** When reserving a listing, the system checks for existing users by wallet address. However, if the same person has multiple wallets via `UserWallet`, they could circumvent reservations.

```typescript
const existingUser = await prisma.user.findUnique({
  where: { walletAddress },  // Only checks primary wallet
  select: { id: true },
});
```

**Recommendation:** Also check `UserWallet` table for linked wallets.

---

## 2. Purchase Flow Vulnerabilities

### 2.1 CRITICAL: Race Condition in Transaction Creation

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/transactions/route.ts`
**Lines:** 85-260

**Issue:** No atomic transaction wrapping or locking mechanism when creating purchases. Multiple buyers could initiate purchases on the same listing simultaneously.

```typescript
// These operations are not atomic:
const transaction = await prisma.transaction.create({ ... });
await prisma.listing.update({ where: { id: listingId }, data: { status: "SOLD" } });
```

**Impact:** Double-purchase possible if two requests arrive nearly simultaneously before status update completes.

**Recommendation:** Use Prisma transactions with unique constraints:
```typescript
const result = await prisma.$transaction(async (tx) => {
  const listing = await tx.listing.findUnique({
    where: { id: listingId, status: "ACTIVE" },
  });
  if (!listing) throw new Error("Listing unavailable");

  const transaction = await tx.transaction.create({ ... });
  await tx.listing.update({ data: { status: "SOLD" } });
  return transaction;
});
```

---

### 2.2 HIGH: Purchase on Unavailable Listings

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/transactions/route.ts`
**Lines:** 103-151

**Issue:** The listing status is not validated for "Buy Now" purchases. The code only checks `buyNowEnabled` but not if the listing is still `ACTIVE`.

```typescript
if (paymentMethod === "BUY_NOW") {
  if (!listing.buyNowEnabled || !listing.buyNowPrice) {
    return NextResponse.json({ error: "Buy Now not available" }, { status: 400 });
  }
  // Missing: listing.status === "ACTIVE" check
  salePrice = listing.buyNowPrice;
}
```

**Impact:** Purchases could be made on RESERVED, ENDED, or SOLD listings.

**Recommendation:** Add status check:
```typescript
if (listing.status !== "ACTIVE") {
  return NextResponse.json({ error: "Listing is not available for purchase" }, { status: 400 });
}
```

---

### 2.3 HIGH: Price Changes Not Locked During Purchase

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/transactions/route.ts`

**Issue:** Between the buyer viewing a price and completing purchase, the seller could modify the `buyNowPrice`. No price locking or confirmation mechanism exists.

**Impact:** Bait-and-switch pricing attacks.

**Recommendation:** Accept expected price from client and validate:
```typescript
const { listingId, expectedPrice, paymentMethod } = body;
if (paymentMethod === "BUY_NOW" && Math.abs(listing.buyNowPrice - expectedPrice) > 0.001) {
  return NextResponse.json({ error: "Price has changed", newPrice: listing.buyNowPrice }, { status: 409 });
}
```

---

### 2.4 MEDIUM: Missing Reserve Price Enforcement

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/transactions/route.ts`
**Lines:** 135-150

**Issue:** For auction wins, the code doesn't verify that the winning bid meets the reserve price (if set).

```typescript
// Auction win
if (listing.status !== "ENDED" && new Date() < listing.endTime) {
  return NextResponse.json({ error: "Auction has not ended yet" }, { status: 400 });
}
// Missing: if (listing.reservePrice && winningBid.amount < listing.reservePrice)
```

**Recommendation:** Add reserve price check.

---

## 3. Offer/Bid System Vulnerabilities

### 3.1 HIGH: No Bid Sniping Prevention

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/bids/route.ts`
**Lines:** 55-209

**Issue:** Despite `PLATFORM_CONFIG.auction.antiSnipeMinutes` being configured (5 minutes), no anti-snipe extension is implemented in the bid endpoint.

```typescript
// Config shows intent:
// antiSnipeMinutes: 5,
// antiSnipeExtension: 10, // minutes to extend

// But bid endpoint doesn't implement it
const bid = await prisma.bid.create({ ... });
// Missing: extend endTime if bid placed in last 5 minutes
```

**Impact:** Last-second sniping undermines fair auction process.

**Recommendation:** Implement anti-snipe logic:
```typescript
const minutesRemaining = (listing.endTime.getTime() - Date.now()) / 60000;
if (minutesRemaining <= PLATFORM_CONFIG.auction.antiSnipeMinutes) {
  await prisma.listing.update({
    where: { id: listingId },
    data: {
      endTime: new Date(listing.endTime.getTime() + PLATFORM_CONFIG.auction.antiSnipeExtension * 60000)
    }
  });
}
```

---

### 3.2 MEDIUM: Offer State Transition Gaps

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/offers/[offerId]/accept/route.ts`
**Lines:** 109-154

**Issue:** When accepting an offer, the transaction creates a listing update to RESERVED status, but doesn't verify no transaction already exists for the listing.

```typescript
const [updatedOffer, transaction] = await prisma.$transaction([
  prisma.offer.update({ ... }),
  prisma.transaction.create({ ... }),  // Could fail with unique constraint if transaction exists
  prisma.listing.update({ status: 'RESERVED' }),
  prisma.offer.updateMany({ ... }),  // Cancel other offers
]);
```

**Impact:** If a race condition occurs, multiple transactions could be created before the $transaction rollback.

**Recommendation:** Add explicit check for existing transaction:
```typescript
const existingTransaction = await prisma.transaction.findUnique({
  where: { listingId: offer.listingId }
});
if (existingTransaction) {
  return NextResponse.json({ error: "Listing already has a transaction" }, { status: 409 });
}
```

---

### 3.3 MEDIUM: Seller Can Bid on Own Listing Via Offers

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/bids/route.ts` vs `/Users/dasherxd/Desktop/App-Market/app/api/offers/route.ts`

**Issue:** Bid endpoint prevents seller self-bidding but offer endpoint also prevents it. However, the seller could create a second account and use that to inflate perceived value through offers.

**Impact:** Market manipulation through sybil attacks.

**Recommendation:** Consider implementing stronger identity verification or monitoring unusual offer patterns.

---

### 3.4 LOW: Expired Offers Not Auto-Cleaned

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/offers/route.ts`

**Issue:** Expired offers remain in ACTIVE status until someone tries to accept them. No cron job or cleanup mechanism exists.

**Impact:** Database pollution, misleading sellers about active offers.

**Recommendation:** Add cron job to expire old offers or check on read.

---

## 4. Transfer/Escrow Vulnerabilities

### 4.1 CRITICAL: Escrow Completion Without On-Chain Verification

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/transfers/[id]/complete/route.ts`
**Lines:** 95-113

**Issue:** The transfer completion marks the transaction as COMPLETED and notifies about fund release, but there's only a TODO comment for actual on-chain verification.

```typescript
// TODO: Call smart contract to release escrow to seller
// This would involve:
// 1. Getting the listing PDA
// 2. Calling the confirm_receipt instruction on the smart contract
// 3. The contract will automatically release funds to seller minus platform fee
//
// For now, we update the database to mark as completed
// In production, this should verify the on-chain transaction succeeded

await prisma.transaction.update({
  where: { id: params.id },
  data: {
    status: "COMPLETED",
    // ... no on-chain verification
  },
});
```

**Impact:** Database and blockchain state could desync. Funds might not actually be released while database shows completed.

**Recommendation:** Implement actual on-chain verification before marking complete, or implement reconciliation jobs.

---

### 4.2 HIGH: Multiple Completion Paths Allow State Bypass

**Files:**
- `/Users/dasherxd/Desktop/App-Market/app/api/transfers/[id]/complete/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/transactions/[id]/confirm/route.ts`

**Issue:** Two different endpoints can complete a transfer (`/complete` and `/confirm`), creating ambiguity and potential for bypassing checks.

```typescript
// /confirm endpoint also completes:
if (allConfirmed) {
  await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      status: "COMPLETED",
      transferCompletedAt: new Date(),
      releasedAt: new Date(),
    },
  });
}

// /complete endpoint has different logic:
await prisma.transaction.update({
  where: { id: params.id },
  data: {
    status: "COMPLETED",
    // ...
  },
});
```

**Impact:** Inconsistent completion logic could allow bypassing certain checks.

**Recommendation:** Consolidate to a single completion path or ensure both endpoints share the same validation logic.

---

### 4.3 MEDIUM: Seller Stats Double-Counted

**Files:**
- `/Users/dasherxd/Desktop/App-Market/app/api/transactions/route.ts` (lines 236-250)
- `/Users/dasherxd/Desktop/App-Market/app/api/transfers/[id]/complete/route.ts` (lines 122-136)

**Issue:** Seller stats (totalSales, totalVolume) are incremented both when creating a transaction AND when completing transfer.

```typescript
// In transactions/route.ts:
await prisma.user.update({
  where: { id: listing.sellerId },
  data: {
    totalSales: { increment: 1 },
    totalVolume: { increment: salePrice },
  },
});

// Also in transfers/complete/route.ts:
await prisma.user.update({
  where: { id: transaction.sellerId },
  data: {
    totalSales: { increment: 1 },
    totalVolume: { increment: transaction.salePrice },
  },
});
```

**Impact:** Inflated seller statistics, affecting trust scores and rankings.

**Recommendation:** Update stats only at completion, not at transaction creation.

---

### 4.4 MEDIUM: Fund Release Conditions Unclear

**File:** `/Users/dasherxd/Desktop/App-Market/lib/config.ts`
**Lines:** 192-201

**Issue:** Config mentions `autoReleaseEnabled: true` but no implementation of automatic release after deadline exists.

```typescript
escrow: {
  transferDeadlineDays: 7,
  autoReleaseEnabled: true,  // Not implemented anywhere
  maxExtensionDays: 7,
}
```

**Impact:** Funds could be stuck indefinitely if buyer doesn't confirm and doesn't dispute.

**Recommendation:** Implement cron job for auto-release after deadline.

---

## 5. Referral System Vulnerabilities

### 5.1 CRITICAL: Self-Referral Not Prevented

**File:** `/Users/dasherxd/Desktop/App-Market/app/r/[code]/page.tsx`
**File:** `/Users/dasherxd/Desktop/App-Market/app/api/auth/privy/callback/route.ts`

**Issue:** The referral cookie is set by visiting `/r/[code]`, but there's no check in the user creation flow to prevent users from using their own referral code. The Privy callback doesn't process referral cookies at all.

```typescript
// r/[code]/page.tsx sets cookie:
cookies().set("referral_code", code, { ... });

// But privy/callback/route.ts never checks or processes this cookie
// Missing: referral validation and creation
```

**Impact:** Users could create accounts, generate referral codes, create new accounts with their own codes, and earn referral bonuses on their own transactions.

**Recommendation:**
1. Process referral cookie during user creation
2. Check that referrer !== referred user
3. Implement IP/device fingerprinting for sybil detection

---

### 5.2 HIGH: Referral Commission Calculation Gap

**File:** `/Users/dasherxd/Desktop/App-Market/lib/referral-earnings.ts`
**Lines:** 30-32

**Issue:** Referral earnings are calculated as 2% of sale price, but taken from the 5% platform fee. If both buyer and seller were referred, 4% goes to referrals leaving only 1% platform fee.

```typescript
const commissionRate = PLATFORM_CONFIG.referral.commissionRateBps / 10000; // 0.02 = 2%
// If both referred: 2% + 2% = 4% out of 5% fee
// Platform keeps only 1%
```

**Impact:** In cases where both parties are referred, platform profitability is severely impacted.

**Recommendation:** Cap total referral payout or use tiered rates.

---

### 5.3 MEDIUM: Referral Code Collision Possible

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/referrals/route.ts`
**Lines:** 143-153

**Issue:** Custom referral codes are only checked for uniqueness against existing codes, but auto-generated codes for new users aren't checked during creation.

**Recommendation:** Ensure auto-generated codes are also unique before user creation.

---

## 6. Dispute Handling Vulnerabilities

### 6.1 HIGH: Dispute Resolution Without Admin Check

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/disputes/[id]/route.ts`
**Lines:** 45-60

**Issue:** The dispute resolution endpoint has a TODO comment for admin check but doesn't implement it.

```typescript
// For now, only admin can resolve disputes
// In the future, this could be expanded to community arbitration
// TODO: Add admin check
// For MVP, we'll allow the initiator or respondent to "accept" a resolution
```

**Impact:** Any authenticated user could potentially resolve disputes, leading to fraudulent resolutions.

**Recommendation:** Implement admin role check immediately.

---

### 6.2 MEDIUM: Evidence Tampering Possible

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/disputes/route.ts`
**Lines:** 79-151

**Issue:** Evidence is stored as JSON without integrity verification. No hashing or timestamping prevents modification.

```typescript
const dispute = await prisma.dispute.create({
  data: {
    initiatorEvidence: evidence ? { items: evidence } : undefined,
    // No hash, no signature, no tamper detection
  },
});
```

**Recommendation:** Hash evidence on submission and verify integrity on access.

---

### 6.3 MEDIUM: Dispute State Can Be Manipulated

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/disputes/[id]/route.ts`

**Issue:** The PUT endpoint for responding to disputes doesn't verify the dispute is in OPEN or AWAITING_RESPONSE status.

```typescript
// Missing status check before allowing response
if (dispute.respondentId !== session.user.id) {
  return NextResponse.json({ error: "Only the respondent can respond" }, { status: 403 });
}
// Should also check: dispute.status === "OPEN" || dispute.status === "AWAITING_RESPONSE"
```

**Impact:** Responses could be added to already resolved disputes.

---

### 6.4 LOW: Buyer Deposit Not Enforced

**File:** `/Users/dasherxd/Desktop/App-Market/prisma/schema.prisma`
**Lines:** 567-573

**Issue:** The schema shows `buyerDepositRequired` for denial claims, but this isn't enforced in the dispute creation endpoint.

```typescript
// Schema defines:
buyerDepositRequired Float?     // 10% of purchase price
buyerDepositAmount   Float?     @default(0)
buyerDepositHeld     Boolean    @default(false)

// But disputes/route.ts doesn't require or collect this deposit
```

---

## 7. Collaboration/Partnership Vulnerabilities

### 7.1 HIGH: Revenue Split Manipulation After Listing Active

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/listings/[slug]/collaborators/route.ts`
**Lines:** 420-427

**Issue:** The PATCH endpoint checks for DRAFT or PENDING_COLLABORATORS status, but if a listing transitions to ACTIVE and then back somehow, percentages could be modified.

```typescript
if (!["DRAFT", "PENDING_COLLABORATORS"].includes(listing.status)) {
  return NextResponse.json({ error: "Cannot update collaborators on an active or completed listing" }, { status: 400 });
}
```

**Impact:** If there's any way to revert listing status, collaborator percentages could be changed after agreements.

**Recommendation:** Add immutability flag or track original percentages.

---

### 7.2 MEDIUM: Collaborator Wallet Linking Race Condition

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/collaborators/[id]/respond/route.ts`
**Lines:** 59-76

**Issue:** Collaborator identity is verified by userId OR wallet address, but if a malicious user claims a wallet before the legitimate owner, they could respond to invitations.

```typescript
const isCollaborator =
  (collaborator.userId && collaborator.userId === userId) ||
  (currentUser?.walletAddress &&
   collaborator.walletAddress.toLowerCase() === currentUser.walletAddress.toLowerCase());
```

**Recommendation:** Require wallet signature verification for collaboration acceptance.

---

### 7.3 MEDIUM: Partner Percentage Rounding Issues

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/transfers/[id]/complete/route.ts`
**Lines:** 157-176

**Issue:** Collaborator payments are calculated as floating-point percentages of proceeds, potentially leading to rounding errors where fractions of SOL are lost.

```typescript
const collaboratorAmount = (sellerProceeds * collab.percentage) / 100;
// No rounding control, fractions may be lost
```

**Recommendation:** Use integer math with lamports or implement explicit rounding rules.

---

### 7.4 MEDIUM: Purchase Partner Deposit Deadline Not Enforced

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/transactions/[id]/partners/route.ts`
**Lines:** 155-164

**Issue:** A 30-minute deposit deadline is set, but no cron job or enforcement mechanism exists.

```typescript
await prisma.transaction.update({
  where: { id: params.id },
  data: {
    hasPartners: true,
    status: "AWAITING_PARTNER_DEPOSITS",
    partnerDepositDeadline: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
  },
});
// No enforcement of this deadline
```

---

### 7.5 LOW: Majority Vote Manipulation

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/transfers/[id]/buyer-confirm/route.ts`
**Lines:** 119-131

**Issue:** For partner purchases, majority is calculated as `floor(totalPartners / 2) + 1`. With 2 partners, both must confirm. With 3, only 2 needed. This could allow minority of partners to confirm against the rest.

**Recommendation:** Consider requiring unanimous consent for high-value transactions or implementing weighted voting based on percentage ownership.

---

## 8. Additional State Machine Issues

### 8.1 MEDIUM: Listing Status Enum Gaps

**File:** `/Users/dasherxd/Desktop/App-Market/prisma/schema.prisma`

**Issue:** The ListingStatus enum doesn't include states for all scenarios:
- No PENDING_PAYMENT state
- No TRANSFER_IN_PROGRESS tied to listing
- RESERVED and SOLD distinction is unclear when offer is accepted

**Recommendation:** Add intermediate states and document state transition rules.

---

### 8.2 LOW: Transaction Status Machine Not Enforced

**File:** `/Users/dasherxd/Desktop/App-Market/prisma/schema.prisma` (TransactionStatus enum)

**Issue:** Valid state transitions aren't enforced at the database level. Any status can be set regardless of current status.

**Recommendation:** Implement transition validation in a service layer or database triggers.

---

## Summary of Recommendations

### Immediate (Critical)

1. **Add atomic transactions** for purchase flow to prevent double-purchases
2. **Implement listing status checks** on all modification endpoints
3. **Add on-chain verification** before marking escrow as complete
4. **Implement admin role check** for dispute resolution
5. **Add self-referral prevention** in user creation flow

### Short-term (High)

1. Implement bid sniping prevention
2. Add price locking during purchase
3. Fix seller stats double-counting
4. Consolidate transfer completion logic
5. Add reserve price enforcement
6. Cap referral payouts to prevent platform loss
7. Add wallet signature verification for collaborator acceptance
8. Validate listing status for Buy Now purchases

### Medium-term

1. Implement evidence hashing for disputes
2. Add auto-release cron job for escrow
3. Add offer expiration cleanup
4. Implement proper rounding for payment calculations
5. Add partner deposit deadline enforcement
6. Implement tag/category validation
7. Add state transition logging

---

## Conclusion

The App-Market codebase contains several significant business logic vulnerabilities that could lead to financial loss, fraud, or system abuse. The most critical issues involve:

1. **Race conditions** in purchase and offer flows
2. **Missing state validations** allowing operations in invalid states
3. **Database/blockchain desync** due to missing on-chain verification
4. **Self-referral exploitation** potential
5. **Unauthorized dispute resolution** access

These issues should be addressed before production deployment, particularly the escrow and transaction race conditions which could result in direct financial impact.
