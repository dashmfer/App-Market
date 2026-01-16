# Property-Based Testing Recommendations: App Market Escrow (Main Branch)

**Analysis Date**: 2026-01-16
**Scope**: `programs/app-market/src/lib.rs`
**Framework**: Anchor 0.30.0 (Solana)
**Branch**: main
**Testing Framework**: Recommended - Trdelnik (Solana/Anchor fuzzer)

---

## Executive Summary

This document identifies high-value property-based testing opportunities for the App Market Escrow contract, focusing on invariants that should hold across all possible inputs.

| Category | Properties | Priority |
|----------|------------|----------|
| Financial Invariants | 8 | Critical |
| State Machine | 6 | High |
| Access Control | 5 | High |
| Timelock | 4 | High |
| DoS Protection | 4 | Medium |
| **Total** | **27** | - |

---

## Critical: Financial Invariants

### FI-01: Escrow Balance Consistency

**Property**: `escrow.amount + pending_withdrawals == actual_lamports - rent`

```rust
// Invariant: Tracked amount equals actual balance minus rent
forall transaction:
    escrow.to_account_info().lamports()
    >= escrow.amount + Rent::get().minimum_balance(escrow_size)
```

**Test Cases**:
- After `place_bid`: `escrow.amount == bid_amount`
- After `withdraw_funds`: `escrow.amount -= withdrawal_amount`
- After `finalize_transaction`: `escrow.amount == 0`

---

### FI-02: Fee Calculation Consistency

**Property**: `platform_fee + seller_proceeds == sale_price`

```rust
forall transaction:
    transaction.platform_fee + transaction.seller_proceeds == transaction.sale_price
```

**Test Cases**:
- `sale_price = 1` (minimum)
- `sale_price = u64::MAX / 10001` (near overflow threshold)
- Various `platform_fee_bps` values (0-1000)

---

### FI-03: Partial Refund Completeness

**Property**: `buyer_amount + seller_amount == sale_price`

```rust
forall partial_refund:
    buyer_amount + seller_amount == transaction.sale_price
```

**Test Cases**:
- `buyer_amount = 0, seller_amount = sale_price`
- `buyer_amount = sale_price, seller_amount = 0`
- Various splits (1/99, 50/50, 99/1)

---

### FI-04: No Fund Leakage

**Property**: Total funds in = Total funds out

```rust
forall transaction_lifecycle:
    initial_buyer_balance + initial_seller_balance + initial_treasury_balance
    == final_buyer_balance + final_seller_balance + final_treasury_balance
```

---

### FI-05: Withdrawal Amount Correctness

**Property**: Withdrawal amount equals previous bid

```rust
forall withdrawal:
    pending_withdrawal.amount == old_bid_amount_at_creation
```

---

### FI-06: Bid Increment Enforcement

**Property**: Each bid is at least MIN_BID_INCREMENT larger

```rust
forall bid where listing.current_bid > 0:
    new_bid >= listing.current_bid * 105 / 100  // 5%
    OR new_bid >= listing.current_bid + MIN_BID_INCREMENT_LAMPORTS
```

---

### FI-07: Reserve Price Enforcement

**Property**: Auction only settles above reserve

```rust
forall auction_settlement:
    listing.reserve_price.is_none()
    OR listing.current_bid >= listing.reserve_price.unwrap()
```

---

### FI-08: Fee Bounds

**Property**: Fees never exceed maximum

```rust
forall config:
    config.platform_fee_bps <= 1000  // 10%
    config.dispute_fee_bps <= 500    // 5%
```

---

## High: State Machine Invariants

### SM-01: Listing Status Transitions

**Property**: Status follows valid state machine

```
Valid transitions:
  Active -> Sold | Cancelled | Expired
  Sold -> (terminal)
  Cancelled -> (terminal)
  Expired -> (terminal)
```

```rust
forall listing_transition(old_status, new_status):
    (old_status == Active && new_status in {Sold, Cancelled, Expired})
    OR old_status == new_status
```

---

### SM-02: Transaction Status Transitions

**Property**: Transaction status follows valid state machine

```
Valid transitions:
  Pending -> InEscrow
  InEscrow -> Completed | Disputed | Refunded
  Disputed -> Resolved
  Resolved -> (terminal)
  Completed -> (terminal)
  Refunded -> (terminal)
```

---

### SM-03: Dispute Status Transitions

**Property**: Dispute status follows valid state machine

```
Valid transitions:
  Open -> UnderReview | Resolved
  UnderReview -> Open (if contested) | Resolved
  Resolved -> (terminal)
```

---

### SM-04: Offer Status Transitions

**Property**: Offer status follows valid state machine

```
Valid transitions:
  Active -> Accepted | Cancelled | Expired
```

---

### SM-05: Auction Start Monotonicity

**Property**: Auction cannot be "unstarted"

```rust
forall listing:
    once listing.auction_started == true:
        listing.auction_started remains true
```

---

### SM-06: Withdrawal Count Monotonicity

**Property**: Withdrawal counter only increases

```rust
forall listing:
    new_withdrawal_count >= old_withdrawal_count
```

---

## High: Access Control Invariants

### AC-01: Admin-Only Functions

**Property**: Admin functions reject non-admin callers

```rust
forall admin_function in {propose_treasury_change, execute_treasury_change,
                          propose_admin_change, execute_admin_change,
                          set_paused, propose_dispute_resolution}:
    caller != config.admin => Err(NotAdmin)
```

---

### AC-02: Seller-Only Functions

**Property**: Seller functions reject non-sellers

```rust
forall seller_function in {cancel_listing, cancel_auction,
                           seller_confirm_transfer, finalize_transaction,
                           accept_offer}:
    caller != listing.seller => Err(NotSeller)
```

---

### AC-03: Buyer-Only Functions

**Property**: Buyer functions reject non-buyers

```rust
forall buyer_function in {confirm_receipt, emergency_refund,
                          emergency_auto_verify, cancel_offer, expire_offer}:
    caller != expected_buyer => Err(NotBuyer | NotOfferOwner)
```

---

### AC-04: Initialization Access Control

**Property**: Only expected admin can initialize

```rust
forall initialize_attempt:
    caller != EXPECTED_ADMIN => Err(NotExpectedAdmin)
```

---

### AC-05: Backend Authority Functions

**Property**: Verification requires backend authority

```rust
forall verify_uploads_attempt:
    caller != config.backend_authority => Err(NotBackendAuthority)
```

---

## High: Timelock Invariants

### TL-01: Treasury Change Timelock

**Property**: Treasury change requires 48-hour wait

```rust
forall execute_treasury_change:
    Clock::get().unix_timestamp >= config.pending_treasury_at + ADMIN_TIMELOCK_SECONDS
```

---

### TL-02: Admin Change Timelock

**Property**: Admin change requires 48-hour wait

```rust
forall execute_admin_change:
    Clock::get().unix_timestamp >= config.pending_admin_at + ADMIN_TIMELOCK_SECONDS
```

---

### TL-03: Dispute Resolution Timelock

**Property**: Dispute resolution requires 48-hour wait after proposal

```rust
forall execute_dispute_resolution:
    Clock::get().unix_timestamp >= dispute.pending_resolution_at + DISPUTE_RESOLUTION_TIMELOCK_SECONDS
```

---

### TL-04: Backend Timeout Fallback

**Property**: Emergency verification requires 30-day wait

```rust
forall emergency_auto_verify OR admin_emergency_verify:
    Clock::get().unix_timestamp >= transaction.seller_confirmed_at + BACKEND_TIMEOUT_SECONDS
```

---

## Medium: DoS Protection Invariants

### DOS-01: Bid Count Limit

**Property**: Bids per listing capped at 1000

```rust
forall listing:
    listing.withdrawal_count <= MAX_BIDS_PER_LISTING
```

---

### DOS-02: Offer Count Limit

**Property**: Offers per listing capped at 100

```rust
forall listing:
    listing.offer_count <= MAX_OFFERS_PER_LISTING
```

---

### DOS-03: Consecutive Bid Limit

**Property**: Same bidder capped at 10 consecutive bids

```rust
forall listing:
    listing.consecutive_bid_count <= MAX_CONSECUTIVE_BIDS
```

---

### DOS-04: Consecutive Offer Limit

**Property**: Same buyer capped at 10 consecutive offers

```rust
forall listing:
    listing.consecutive_offer_count <= MAX_CONSECUTIVE_OFFERS
```

---

## Test Implementation Recommendations

### Trdelnik Setup

```rust
// fuzz_instructions.rs
pub enum FuzzInstruction {
    PlaceBid { amount: u64 },
    BuyNow,
    MakeOffer { amount: u64, deadline: i64, offer_seed: u64 },
    CancelOffer,
    AcceptOffer,
    // ... etc
}

#[invariant]
fn escrow_balance_consistency(state: &State) -> bool {
    state.escrow_account.lamports() >= state.escrow.amount + RENT
}

#[invariant]
fn fee_calculation_consistency(state: &State) -> bool {
    state.transaction.platform_fee + state.transaction.seller_proceeds
        == state.transaction.sale_price
}
```

### Recommended Test Scenarios

| Scenario | Property | Priority |
|----------|----------|----------|
| Rapid bid succession | FI-01, DOS-01, DOS-03 | High |
| Concurrent offers | FI-01, DOS-02, DOS-04 | High |
| Timelock boundary | TL-01, TL-02, TL-03 | High |
| Dispute lifecycle | SM-03, FI-03 | High |
| Admin key rotation | AC-01, TL-02 | Medium |
| Backend failure | TL-04 | Medium |

---

## Conclusion

Property-based testing should focus on:

1. **Financial invariants** - Ensure no fund leakage
2. **State machine correctness** - Valid status transitions
3. **Access control** - Role enforcement
4. **Timelock enforcement** - No premature execution
5. **DoS protection** - Limits enforced

All 27 properties should be verified through comprehensive fuzz testing before mainnet deployment.
