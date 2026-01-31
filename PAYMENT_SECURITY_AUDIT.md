# Payment and Financial Security Audit Report

**Date:** 2026-01-31
**Codebase:** App-Market
**Scope:** Payment processing, withdrawal systems, transaction handling, transfer logic, escrow security, and financial calculations

---

## Executive Summary

This audit analyzed the payment and financial security mechanisms in the App-Market codebase. The platform handles cryptocurrency transactions (SOL, APP token, USDC) and fiat payments (Stripe) for a marketplace selling applications. The analysis identified **13 critical/high severity** and **9 medium severity** security issues related to race conditions, insufficient verification, missing atomicity guarantees, and potential financial exploits.

---

## Table of Contents

1. [Stripe Integration Analysis](#1-stripe-integration-analysis)
2. [Withdrawal System Analysis](#2-withdrawal-system-analysis)
3. [Transaction Handling Analysis](#3-transaction-handling-analysis)
4. [Transfer Logic Analysis](#4-transfer-logic-analysis)
5. [Escrow Security Analysis](#5-escrow-security-analysis)
6. [Financial Calculations Analysis](#6-financial-calculations-analysis)
7. [Findings Summary](#7-findings-summary)
8. [Recommendations](#8-recommendations)

---

## 1. Stripe Integration Analysis

### Files Analyzed
- `/Users/dasherxd/Desktop/App-Market/app/api/payments/create-intent/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/webhooks/stripe/route.ts`

### 1.1 Webhook Signature Verification

**Status:** IMPLEMENTED CORRECTLY

The Stripe webhook handler properly verifies webhook signatures:

```typescript
// app/api/webhooks/stripe/route.ts:19-27
try {
  event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
} catch (err: any) {
  console.error("Webhook signature verification failed:", err.message);
  return NextResponse.json(
    { error: "Invalid signature" },
    { status: 400 }
  );
}
```

**Assessment:** Signature verification is correctly implemented using `stripe.webhooks.constructEvent()`.

### 1.2 CRITICAL: Missing Webhook Idempotency Protection

**Severity:** CRITICAL
**Location:** `app/api/webhooks/stripe/route.ts:57-172`

**Issue:** The webhook handler processes `payment_intent.succeeded` events without checking if the payment was already processed. This allows replay attacks or duplicate webhook deliveries to create multiple transactions for a single payment.

```typescript
// No check for existing transaction with this stripePaymentId before creation
await prisma.transaction.create({
  data: {
    // ...
    stripePaymentId: paymentIntent.id,
    // ...
  },
});
```

**Impact:**
- Double-crediting of sales
- Duplicate transaction records
- Inflated seller statistics
- Incorrect platform fee accounting

**Recommendation:** Add idempotency check before processing:
```typescript
const existingTransaction = await prisma.transaction.findUnique({
  where: { stripePaymentId: paymentIntent.id }
});
if (existingTransaction) {
  return NextResponse.json({ received: true }); // Already processed
}
```

### 1.3 HIGH: Non-Atomic Webhook Operations

**Severity:** HIGH
**Location:** `app/api/webhooks/stripe/route.ts:75-128`

**Issue:** The `handlePaymentSuccess` function performs multiple database operations sequentially without atomic transaction wrapping:

```typescript
// These operations should be atomic:
await prisma.transaction.create({ ... });      // Line 87
await prisma.listing.update({ ... });          // Line 104
await prisma.notification.create({ ... });      // Line 111
await prisma.notification.create({ ... });      // Line 120
await prisma.user.update({ ... });             // Line 158
await prisma.user.update({ ... });             // Line 166
```

**Impact:** Partial failure could leave the system in an inconsistent state (e.g., transaction created but listing not updated to SOLD).

### 1.4 HIGH: Hardcoded SOL Price

**Severity:** HIGH
**Location:** `app/api/payments/create-intent/route.ts:80`

**Issue:** SOL price is hardcoded:
```typescript
const solPriceUsd = 150; // Placeholder - fetch real price
```

**Impact:**
- Incorrect fiat/crypto conversion
- Users can exploit price discrepancy to arbitrage
- Platform may under/over charge

### 1.5 MEDIUM: Missing Listing Status Validation

**Severity:** MEDIUM
**Location:** `app/api/payments/create-intent/route.ts:27-44`

**Issue:** The payment intent creation does not verify the listing status is ACTIVE before creating a payment intent.

**Impact:** Users could potentially initiate payments on sold or cancelled listings.

---

## 2. Withdrawal System Analysis

### Files Analyzed
- `/Users/dasherxd/Desktop/App-Market/app/api/withdrawals/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/withdrawals/[withdrawalId]/claim/route.ts`

### 2.1 Double-Withdrawal Prevention

**Status:** PARTIALLY IMPLEMENTED

The claim endpoint checks if withdrawal is already claimed:

```typescript
// app/api/withdrawals/[withdrawalId]/claim/route.ts:53-59
if (withdrawal.claimed) {
  return NextResponse.json(
    { error: 'Withdrawal already claimed' },
    { status: 400 }
  );
}
```

### 2.2 CRITICAL: Race Condition in Withdrawal Claim

**Severity:** CRITICAL
**Location:** `app/api/withdrawals/[withdrawalId]/claim/route.ts:53-68`

**Issue:** The check for `withdrawal.claimed` and the update are not atomic. Two concurrent requests could both pass the check before either completes the update:

```typescript
// Non-atomic check-then-act pattern
if (withdrawal.claimed) {      // T1 reads: false, T2 reads: false
  return NextResponse.json(...);
}

const updatedWithdrawal = await prisma.pendingWithdrawal.update({
  where: { id: withdrawalId },
  data: {
    claimed: true,             // Both T1 and T2 reach here
    claimedAt: new Date(),
  },
});
```

**Impact:** Double-withdrawal of funds if two requests race.

**Recommendation:** Use database-level atomic operation with conditional update:
```typescript
const result = await prisma.pendingWithdrawal.updateMany({
  where: { id: withdrawalId, claimed: false },
  data: { claimed: true, claimedAt: new Date() },
});
if (result.count === 0) {
  return NextResponse.json({ error: 'Already claimed or not found' }, { status: 400 });
}
```

### 2.3 HIGH: Missing On-Chain Verification

**Severity:** HIGH
**Location:** `app/api/withdrawals/[withdrawalId]/claim/route.ts:70-72`

**Issue:** The endpoint only marks withdrawal as claimed in the database without verifying the on-chain transaction:

```typescript
// NOTE: The actual on-chain withdrawal should be handled by the smart contract
// This endpoint just marks it as claimed in the database
// The frontend should call the smart contract's withdraw_funds instruction
```

**Impact:**
- Database and on-chain state can become desynchronized
- User could mark as claimed without actually executing on-chain withdrawal
- Or conversely, on-chain withdrawal succeeds but database update fails

---

## 3. Transaction Handling Analysis

### Files Analyzed
- `/Users/dasherxd/Desktop/App-Market/app/api/transactions/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/transactions/[id]/confirm/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/transactions/[id]/partners/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/transactions/[id]/partners/[partnerId]/deposit/route.ts`

### 3.1 CRITICAL: Race Condition in Bid Placement

**Severity:** CRITICAL
**Location:** `app/api/bids/route.ts:122-188`

**Issue:** Bid placement suffers from a classic TOCTOU (Time-of-Check to Time-of-Use) race condition:

```typescript
// Check current high bid
const currentHighBid = listing.bids[0]?.amount || null;

if (amount <= currentHighBid) {   // T1 checks: 100 SOL, T2 checks: 100 SOL
  return NextResponse.json({ error: ... });
}

// Both T1 and T2 pass the check and proceed...
await prisma.bid.update({ where: { id: listing.bids[0].id }, ... }); // T1 marks old bid
await prisma.bid.create({ data: { amount, isWinning: true, ... } }); // T1 creates bid at 101
// T2 also marks old bid (now T1's bid) and creates its own winning bid at 102
```

**Impact:**
- Two bids could become "winning" simultaneously
- Bid history corruption
- Incorrect auction winner determination

### 3.2 CRITICAL: Partner Deposit Verification Missing

**Severity:** CRITICAL
**Location:** `app/api/transactions/[id]/partners/[partnerId]/deposit/route.ts:60-71`

**Issue:** Partner deposits are marked as complete without on-chain verification:

```typescript
// TODO: Verify the on-chain transaction
// In production, we would verify the tx hash and amount on-chain

// Update partner deposit status (without verification!)
await prisma.transactionPartner.update({
  where: { id: params.partnerId },
  data: {
    depositStatus: "DEPOSITED",
    depositedAt: new Date(),
    depositTxHash: txHash || null,
  },
});
```

**Impact:**
- Partners can claim deposits without actually sending funds
- Fraudulent participation in group purchases
- Financial loss to other partners

### 3.3 HIGH: Non-Atomic Transaction Creation

**Severity:** HIGH
**Location:** `app/api/transactions/route.ts:175-251`

**Issue:** Transaction creation involves multiple database operations without atomic wrapping:

```typescript
const transaction = await prisma.transaction.create({ ... });  // Line 175
await prisma.listing.update({ ... });                           // Line 196
await prisma.listing.update({ ... });                           // Line 204
await prisma.notification.create({ ... });                       // Line 210
await prisma.user.update({ ... });                              // Line 236
await prisma.user.update({ ... });                              // Line 245
```

**Impact:** Partial failures leave inconsistent state.

### 3.4 MEDIUM: State Transition Bypass

**Severity:** MEDIUM
**Location:** `app/api/transactions/[id]/confirm/route.ts:86-94`

**Issue:** Status is always updated to `TRANSFER_IN_PROGRESS` regardless of current state:

```typescript
await prisma.transaction.update({
  where: { id: transactionId },
  data: {
    transferChecklist: checklist,
    status: "TRANSFER_IN_PROGRESS",  // Always sets this, no state machine validation
    transferStartedAt: transaction.transferStartedAt || new Date(),
  },
});
```

**Impact:** Invalid state transitions could be made.

---

## 4. Transfer Logic Analysis

### Files Analyzed
- `/Users/dasherxd/Desktop/App-Market/app/api/transfers/[id]/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/transfers/[id]/complete/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/transfers/[id]/buyer-confirm/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/transfers/[id]/seller-confirm/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/transfers/[id]/fallback/route.ts`

### 4.1 CRITICAL: Missing On-Chain Escrow Release

**Severity:** CRITICAL
**Location:** `app/api/transfers/[id]/complete/route.ts:95-113`

**Issue:** Transfer completion only updates database, doesn't actually release on-chain escrow:

```typescript
// TODO: Call smart contract to release escrow to seller
// This would involve:
// 1. Getting the listing PDA
// 2. Calling the confirm_receipt instruction on the smart contract
// 3. The contract will automatically release funds to seller minus platform fee
//
// For now, we update the database to mark as completed
// In production, this should verify the on-chain transaction succeeded

// Update transaction status (DATABASE ONLY - NO ON-CHAIN EXECUTION)
await prisma.transaction.update({
  where: { id: params.id },
  data: {
    status: "COMPLETED",
    // ...
  },
});
```

**Impact:**
- Funds remain locked in escrow while database shows completed
- Seller never actually receives payment
- Critical disconnect between database and blockchain state

### 4.2 HIGH: Majority Vote Calculation Error

**Severity:** HIGH
**Location:** `app/api/transfers/[id]/buyer-confirm/route.ts:120-123`

**Issue:** Majority calculation uses total partners, not weighted by ownership percentage:

```typescript
const totalPartners = transaction.partners.length;
const confirmationsNeeded = Math.floor(totalPartners / 2) + 1;
const hasMajority = partnerConfirmations.length >= confirmationsNeeded;
```

**Impact:**
- A partner with 1% stake has same voting power as one with 49%
- Minority partners could force release against majority stake interests

### 4.3 MEDIUM: Fallback Transfer Authentication Gap

**Severity:** MEDIUM
**Location:** `app/api/transfers/[id]/fallback/route.ts:39-51`

**Issue:** Fallback transfer validation is weak:

```typescript
// Validate that we need fallback (deadline passed or no buyer info required)
const hasRequiredInfo = transaction.listing.requiredBuyerInfo !== null;
const deadlinePassed = transaction.buyerInfoStatus === "DEADLINE_PASSED";
const noInfoProvided = transaction.buyerInfoStatus === "PENDING";

// These variables are computed but NOT enforced as conditions
```

The validation variables are computed but not used to actually gate the fallback activation.

---

## 5. Escrow Security Analysis

### Files Analyzed
- `/Users/dasherxd/Desktop/App-Market/lib/solana.ts`
- `/Users/dasherxd/Desktop/App-Market/lib/solana-contract.ts`
- `/Users/dasherxd/Desktop/App-Market/lib/config.ts`

### 5.1 HIGH: Off-Chain/On-Chain State Desync

**Severity:** HIGH
**Multiple Locations**

**Issue:** Throughout the codebase, database operations are performed without corresponding on-chain operations, or vice versa. The smart contract functions exist in `lib/solana-contract.ts` but are not called from API routes.

**Examples:**
- `app/api/transfers/[id]/complete/route.ts` - Marks complete without calling `confirmReceipt()`
- `app/api/withdrawals/[withdrawalId]/claim/route.ts` - Marks claimed without calling `withdrawFunds()`
- `app/api/transactions/[id]/partners/[partnerId]/deposit/route.ts` - Marks deposited without verification

**Impact:** Critical state inconsistencies between database and blockchain.

### 5.2 Escrow Configuration

The platform has escrow settings in `lib/config.ts`:

```typescript
escrow: {
  transferDeadlineDays: 7,
  autoReleaseEnabled: true,
  maxExtensionDays: 7,
},
```

**Issue:** While auto-release is configured, no cron job or scheduled task implementation was found to actually execute auto-release.

### 5.3 Dispute Handling

**Status:** PARTIALLY IMPLEMENTED

Disputes can be opened and resolved (`app/api/disputes/route.ts`), but:

**Issues:**
1. No admin role verification (TODO comment present)
2. Dispute resolution doesn't call on-chain dispute resolution
3. Fund movement is calculated but not executed

---

## 6. Financial Calculations Analysis

### Files Analyzed
- `/Users/dasherxd/Desktop/App-Market/lib/solana.ts`
- `/Users/dasherxd/Desktop/App-Market/lib/config.ts`
- `/Users/dasherxd/Desktop/App-Market/lib/referral-earnings.ts`

### 6.1 Fee Calculations

**Status:** CORRECTLY IMPLEMENTED

Fee calculations use basis points (BPS) to avoid floating-point errors:

```typescript
// lib/solana.ts
export const PLATFORM_FEE_BPS = 500; // 5%
export const APP_FEE_BPS = 300;      // 3% - discounted rate
export const DISPUTE_FEE_BPS = 200;  // 2%

export const calculatePlatformFee = (amount: number, currency?: string): number => {
  const feeBps = getFeeRateBps(currency);
  return (amount * feeBps) / 10000;
};
```

**Assessment:** Using BPS (basis points) is the correct approach.

### 6.2 MEDIUM: Floating Point Precision in Collaborator Payments

**Severity:** MEDIUM
**Location:** `app/api/transfers/[id]/complete/route.ts:160-176`

**Issue:** Collaborator payment calculations use floating-point arithmetic:

```typescript
for (const collab of collaborators) {
  const collaboratorAmount = (sellerProceeds * collab.percentage) / 100;
  collaboratorTotalPercentage += collab.percentage;
  // ...
}
const sellerFinalAmount = (sellerProceeds * sellerPercentage) / 100;
```

**Impact:**
- Accumulated rounding errors in multi-collaborator scenarios
- Small amounts may be lost or created due to float precision
- Total distributed could exceed or fall short of sellerProceeds

**Recommendation:** Use integer arithmetic with BPS or smallest currency unit.

### 6.3 MEDIUM: Rounding in Payment Intent

**Severity:** MEDIUM
**Location:** `app/api/payments/create-intent/route.ts:82`

**Issue:**
```typescript
const amountCents = Math.round(amountUsd * 100);
```

Rounding at the cents level is correct for Stripe, but the SOL-to-USD conversion before this introduces floating-point issues.

### 6.4 Currency Handling

Multiple currencies are supported (SOL, APP, USDC) with different decimal places:

```typescript
// lib/solana.ts
export const TOKEN_DECIMALS = {
  SOL: 9,
  APP: 9,
  USDC: 6,
} as const;
```

**Assessment:** Decimal handling is properly defined, but not consistently enforced across all calculations.

---

## 7. Findings Summary

### Critical Severity (5)

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| C1 | Missing Webhook Idempotency | webhooks/stripe/route.ts | Duplicate transactions, double crediting |
| C2 | Withdrawal Race Condition | withdrawals/[id]/claim/route.ts | Double withdrawal of funds |
| C3 | Bid Placement Race Condition | bids/route.ts | Multiple winning bids, auction corruption |
| C4 | Missing Deposit Verification | partners/[id]/deposit/route.ts | Fraudulent partner deposits |
| C5 | Missing On-Chain Escrow Release | transfers/[id]/complete/route.ts | Funds locked, seller never paid |

### High Severity (8)

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| H1 | Non-Atomic Webhook Operations | webhooks/stripe/route.ts | Inconsistent state |
| H2 | Hardcoded SOL Price | payments/create-intent/route.ts | Arbitrage, incorrect pricing |
| H3 | Missing On-Chain Withdrawal Verification | withdrawals/[id]/claim/route.ts | State desync |
| H4 | Non-Atomic Transaction Creation | transactions/route.ts | Inconsistent state |
| H5 | Off-Chain/On-Chain State Desync | Multiple files | Critical state mismatch |
| H6 | Majority Vote Not Weighted | transfers/[id]/buyer-confirm/route.ts | Minority override |
| H7 | Offer Acceptance Race Condition | offers/[id]/accept/route.ts | Uses $transaction but listing check may race |
| H8 | Missing Auto-Release Implementation | N/A | Escrowed funds stuck indefinitely |

### Medium Severity (9)

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| M1 | Missing Listing Status Validation | payments/create-intent/route.ts | Payment on sold listings |
| M2 | State Transition Bypass | transactions/[id]/confirm/route.ts | Invalid state transitions |
| M3 | Fallback Transfer Gate Missing | transfers/[id]/fallback/route.ts | Premature fallback activation |
| M4 | Floating Point in Collaborator Payments | transfers/[id]/complete/route.ts | Rounding errors |
| M5 | SOL-USD Conversion Precision | payments/create-intent/route.ts | Accumulated errors |
| M6 | Missing Admin Role Verification | disputes/[id]/route.ts | Unauthorized dispute resolution |
| M7 | Bid Update Not Atomic | bids/route.ts | Previous bid notification issues |
| M8 | Transaction Partners Percentage Validation | partners/route.ts | Could theoretically exceed 100% in race |
| M9 | Missing Dispute On-Chain Execution | disputes/[id]/route.ts | Dispute resolution not enforced on-chain |

---

## 8. Recommendations

### Immediate (Critical)

1. **Implement Webhook Idempotency**
   - Add unique constraint on `stripePaymentId`
   - Check for existing transaction before processing

2. **Fix Withdrawal Race Condition**
   - Use atomic `updateMany` with condition
   - Or implement database-level locking

3. **Fix Bid Race Condition**
   - Use database transaction with serializable isolation
   - Or implement optimistic locking with version field

4. **Implement Deposit Verification**
   - Add Solana RPC call to verify transaction
   - Verify amount matches expected deposit

5. **Implement On-Chain Escrow Release**
   - Call `confirmReceipt()` from smart contract
   - Only update database after on-chain success

### Short-Term (High)

6. **Add Database Transactions**
   - Wrap related operations in `prisma.$transaction()`
   - Implement proper rollback handling

7. **Implement Dynamic SOL Pricing**
   - Integrate price oracle (Pyth, Switchboard, CoinGecko)
   - Add price staleness checks

8. **Fix State Synchronization**
   - Ensure all state changes happen on-chain first
   - Database is source of cache, not truth

9. **Implement Auto-Release Cron**
   - Add scheduled job for escrow auto-release
   - Implement with idempotency

10. **Weight Partner Votes**
    - Calculate vote power based on ownership percentage
    - Require >50% of stake to confirm, not >50% of partners

### Medium-Term (Medium)

11. **Use Integer Arithmetic**
    - Convert all financial calculations to use smallest unit
    - Avoid floating-point for money

12. **Add State Machine**
    - Define explicit state transitions
    - Validate transitions before allowing

13. **Implement Admin Roles**
    - Add proper role-based access control
    - Protect dispute resolution endpoint

14. **Add Comprehensive Logging**
    - Log all financial operations
    - Include transaction IDs for audit trail

---

## Appendix: Positive Security Findings

The following security measures were properly implemented:

1. **Stripe Webhook Signature Verification** - Correctly implemented
2. **Session Authentication** - Consistently checked across endpoints
3. **Authorization Checks** - Buyer/seller role verification present
4. **Fee Calculation with BPS** - Avoids floating-point in fee percentages
5. **Input Validation with Zod** - Used in offers API
6. **Seller Self-Bid Prevention** - Cannot bid on own listings
7. **Deadline Enforcement** - Checked before accepting offers
8. **One Transaction Per $transaction()** - Used in offer acceptance (H7 notes it exists)

---

*Report generated by security audit analysis*
