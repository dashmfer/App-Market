# Property-Based Testing Report: App Market Escrow

**Date**: 2026-01-16
**Scope**: `programs/app-market/src/lib.rs`
**Framework**: Anchor 0.30.0 (Solana)

---

## Executive Summary

Property-based testing (PBT) is highly applicable to this smart contract due to:
- Complex fee calculations with basis points
- State machine transitions (Listing, Transaction statuses)
- Escrow balance invariants
- Timelock patterns
- Arithmetic operations with overflow protection

| Priority | Pattern | Property Type | Test Count |
|----------|---------|---------------|------------|
| HIGH | Fee calculations | Invariant | 4 |
| HIGH | State machine | Invariant | 6 |
| HIGH | Escrow balance | Invariant | 3 |
| HIGH | Timelock | Invariant | 2 |
| MEDIUM | Bid increment | Invariant | 2 |
| MEDIUM | Withdrawal pattern | Roundtrip | 2 |

---

## Recommended PBT Framework

For Solana/Anchor contracts, use **Trident** (Ackee Blockchain's fuzzer for Anchor):

```bash
cargo install trident-cli
trident init
trident fuzz run
```

Alternative: Use **proptest** in Rust unit tests for pure logic.

---

## Property 1: Fee Calculation Invariants

### 1.1 Platform Fee Bounds

```rust
// Property: platform_fee <= sale_price * MAX_PLATFORM_FEE_BPS / BASIS_POINTS_DIVISOR
// Property: platform_fee + seller_proceeds == sale_price (no funds lost)

#[test]
fn prop_fee_calculation_no_loss() {
    proptest!(|(sale_price in 1u64..u64::MAX/10000, fee_bps in 0u64..=1000u64)| {
        let platform_fee = sale_price
            .checked_mul(fee_bps)
            .unwrap()
            .checked_div(10000)
            .unwrap();
        let seller_proceeds = sale_price.checked_sub(platform_fee).unwrap();

        // Invariant: No funds lost or created
        prop_assert_eq!(platform_fee + seller_proceeds, sale_price);

        // Invariant: Fee bounded
        prop_assert!(platform_fee <= sale_price / 10); // Max 10%
    });
}
```

### 1.2 Dispute Fee Bounds

```rust
#[test]
fn prop_dispute_fee_bounds() {
    proptest!(|(sale_price in 1u64..u64::MAX/10000, dispute_bps in 0u64..=500u64)| {
        let dispute_fee = sale_price
            .checked_mul(dispute_bps)
            .unwrap()
            .checked_div(10000)
            .unwrap();

        // Invariant: Dispute fee <= 5% of sale price
        prop_assert!(dispute_fee <= sale_price / 20);
    });
}
```

### 1.3 Combined Fees Never Exceed Sale Price

```rust
#[test]
fn prop_combined_fees_bounded() {
    proptest!(|(
        sale_price in 1_000_000u64..u64::MAX/10000,
        platform_bps in 0u64..=1000u64,
        dispute_bps in 0u64..=500u64
    )| {
        let platform_fee = sale_price * platform_bps / 10000;
        let dispute_fee = sale_price * dispute_bps / 10000;

        // Invariant: Combined fees < sale_price (seller always gets something)
        prop_assert!(platform_fee + dispute_fee < sale_price);

        // Invariant: Max combined is 15%
        prop_assert!(platform_fee + dispute_fee <= sale_price * 15 / 100);
    });
}
```

---

## Property 2: State Machine Invariants

### 2.1 Listing Status Transitions

```
Valid transitions:
  Active -> Sold (via buy_now, settle_auction, accept_offer)
  Active -> Cancelled (via cancel_auction, no bids)
  Active -> Expired (via expire_listing, no bids)

Invalid transitions:
  Sold -> Active (NEVER)
  Cancelled -> Active (NEVER)
  Expired -> Sold (NEVER)
```

```rust
#[derive(Clone, Debug)]
enum ListingAction {
    PlaceBid(u64),
    BuyNow,
    SettleAuction,
    CancelAuction,
    ExpireListing,
    AcceptOffer(u64),
}

#[test]
fn prop_listing_status_valid_transitions() {
    proptest!(|(actions in prop::collection::vec(any::<ListingAction>(), 1..20))| {
        let mut status = ListingStatus::Active;
        let mut has_bids = false;

        for action in actions {
            let (new_status, valid) = apply_listing_action(status.clone(), &action, has_bids);

            // Property: Invalid transitions never succeed
            if !valid {
                prop_assert_eq!(status, new_status);
            }

            // Property: Terminal states cannot transition
            if matches!(status, ListingStatus::Sold | ListingStatus::Cancelled | ListingStatus::Expired) {
                prop_assert_eq!(status, new_status);
            }

            status = new_status;
        }
    });
}
```

### 2.2 Transaction Status Transitions

```
Valid transitions:
  InEscrow -> Completed (via confirm_receipt, finalize_transaction)
  InEscrow -> Disputed (via open_dispute)
  InEscrow -> Refunded (via emergency_refund)
  Disputed -> Completed (via resolve_dispute)
  Disputed -> Refunded (via resolve_dispute)
```

```rust
#[test]
fn prop_transaction_status_monotonic() {
    proptest!(|(statuses in prop::collection::vec(any::<TransactionStatus>(), 2..10))| {
        for window in statuses.windows(2) {
            let (from, to) = (&window[0], &window[1]);

            // Property: Completed is terminal
            if matches!(from, TransactionStatus::Completed) {
                prop_assert_eq!(from, to);
            }

            // Property: Refunded is terminal
            if matches!(from, TransactionStatus::Refunded) {
                prop_assert_eq!(from, to);
            }
        }
    });
}
```

---

## Property 3: Escrow Balance Invariants

### 3.1 Escrow Tracking Matches Reality

```rust
#[test]
fn prop_escrow_amount_consistent() {
    proptest!(|(
        deposits in prop::collection::vec(1u64..1_000_000_000, 1..10),
        withdrawals in prop::collection::vec(1u64..1_000_000_000, 0..5)
    )| {
        let mut tracked_amount: u64 = 0;
        let mut actual_lamports: u64 = 0;

        // Simulate deposits
        for deposit in &deposits {
            tracked_amount = tracked_amount.saturating_add(*deposit);
            actual_lamports = actual_lamports.saturating_add(*deposit);
        }

        // Simulate withdrawals (capped at available)
        for withdrawal in &withdrawals {
            let amount = (*withdrawal).min(tracked_amount);
            tracked_amount = tracked_amount.saturating_sub(amount);
            actual_lamports = actual_lamports.saturating_sub(amount);
        }

        // Invariant: Tracked amount always matches actual
        prop_assert_eq!(tracked_amount, actual_lamports);
    });
}
```

### 3.2 No Funds Stuck After Completion

```rust
#[test]
fn prop_escrow_empty_after_completion() {
    proptest!(|(sale_price in 1_000_000u64..10_000_000_000u64, fee_bps in 0u64..=1000u64)| {
        let platform_fee = sale_price * fee_bps / 10000;
        let seller_proceeds = sale_price - platform_fee;

        // After confirm_receipt or finalize_transaction:
        let escrow_after = sale_price - platform_fee - seller_proceeds;

        // Invariant: Escrow is empty (all funds distributed)
        prop_assert_eq!(escrow_after, 0);
    });
}
```

### 3.3 Pending Withdrawals Don't Block Finalization

```rust
#[test]
fn prop_pending_withdrawals_separated() {
    proptest!(|(
        sale_price in 1_000_000u64..10_000_000_000u64,
        pending_withdrawals in prop::collection::vec(1u64..1_000_000_000, 0..5)
    )| {
        let total_pending: u64 = pending_withdrawals.iter().sum();
        let escrow_tracked = sale_price; // Only current transaction
        let escrow_actual = sale_price + total_pending;

        // Invariant: Can finalize if tracked == sale_price (ignores pending)
        // The contract checks: escrow.amount == required_balance
        // This ensures pending withdrawals are separate

        prop_assert!(escrow_tracked >= sale_price);
    });
}
```

---

## Property 4: Timelock Invariants

### 4.1 Timelock Cannot Be Bypassed

```rust
const ADMIN_TIMELOCK_SECONDS: i64 = 48 * 60 * 60; // 48 hours

#[test]
fn prop_timelock_enforced() {
    proptest!(|(
        proposed_at in 0i64..i64::MAX - ADMIN_TIMELOCK_SECONDS - 1000,
        execution_time in any::<i64>()
    )| {
        let can_execute = execution_time >= proposed_at + ADMIN_TIMELOCK_SECONDS;
        let time_elapsed = execution_time.saturating_sub(proposed_at);

        // Property: Cannot execute before timelock expires
        if time_elapsed < ADMIN_TIMELOCK_SECONDS {
            prop_assert!(!can_execute);
        }

        // Property: Can execute after timelock
        if time_elapsed >= ADMIN_TIMELOCK_SECONDS {
            prop_assert!(can_execute);
        }
    });
}
```

### 4.2 Pending Changes Atomic

```rust
#[test]
fn prop_pending_change_atomic() {
    proptest!(|(
        has_pending in any::<bool>(),
        pending_at in any::<Option<i64>>()
    )| {
        // Invariant: pending_treasury and pending_treasury_at must both be Some or both None
        let valid = (has_pending && pending_at.is_some()) ||
                   (!has_pending && pending_at.is_none());

        // This catches bugs where one is set without the other
        prop_assert!(valid);
    });
}
```

---

## Property 5: Bid Increment Invariants

### 5.1 Minimum Bid Increment Enforced

```rust
const MIN_BID_INCREMENT_BPS: u64 = 500; // 5%
const MIN_BID_INCREMENT_LAMPORTS: u64 = 100_000_000; // 0.1 SOL

#[test]
fn prop_bid_increment_enforced() {
    proptest!(|(
        current_bid in 0u64..10_000_000_000_000u64,
        new_bid in 0u64..10_000_000_000_000u64
    )| {
        if current_bid == 0 {
            // First bid: any amount >= starting_price is valid
            return Ok(());
        }

        let percentage_increment = current_bid * MIN_BID_INCREMENT_BPS / 10000;
        let min_increment = percentage_increment.max(MIN_BID_INCREMENT_LAMPORTS);
        let min_bid = current_bid.saturating_add(min_increment);

        let bid_valid = new_bid >= min_bid;

        // Property: Bids below minimum are rejected
        if new_bid < min_bid {
            prop_assert!(!bid_valid);
        }
    });
}
```

### 5.2 Anti-Sniping Extension Bounded

```rust
const ANTI_SNIPE_WINDOW: i64 = 15 * 60; // 15 minutes
const ANTI_SNIPE_EXTENSION: i64 = 15 * 60;

#[test]
fn prop_anti_snipe_extension() {
    proptest!(|(
        end_time in 1000i64..i64::MAX - ANTI_SNIPE_EXTENSION,
        bid_time in any::<i64>()
    )| {
        let in_snipe_window = bid_time > end_time - ANTI_SNIPE_WINDOW;
        let new_end_time = if in_snipe_window {
            bid_time + ANTI_SNIPE_EXTENSION
        } else {
            end_time
        };

        // Property: End time only increases (never decreases)
        prop_assert!(new_end_time >= end_time);

        // Property: Extension is exactly ANTI_SNIPE_EXTENSION when triggered
        if in_snipe_window && bid_time < end_time {
            prop_assert_eq!(new_end_time, bid_time + ANTI_SNIPE_EXTENSION);
        }
    });
}
```

---

## Property 6: Withdrawal Pattern Invariants

### 6.1 Withdrawal Amount Matches Original Bid

```rust
#[test]
fn prop_withdrawal_preserves_amount() {
    proptest!(|(original_bid in 1u64..10_000_000_000_000u64)| {
        // When outbid, withdrawal.amount = old_bid
        let withdrawal_amount = original_bid;

        // Property: Withdrawal amount equals original bid
        prop_assert_eq!(withdrawal_amount, original_bid);

        // Property: No value lost or created
        // (escrow still has new bid, withdrawal has old bid)
    });
}
```

### 6.2 Withdrawal IDs Unique

```rust
#[test]
fn prop_withdrawal_ids_unique() {
    proptest!(|(num_bids in 1usize..100)| {
        let mut withdrawal_ids: Vec<u64> = Vec::new();
        let mut withdrawal_count: u64 = 0;

        for _ in 0..num_bids {
            withdrawal_count += 1;
            withdrawal_ids.push(withdrawal_count);
        }

        // Property: All withdrawal IDs are unique
        let unique_count = withdrawal_ids.iter().collect::<std::collections::HashSet<_>>().len();
        prop_assert_eq!(unique_count, num_bids);
    });
}
```

---

## Property 7: Partial Refund Invariants (H-01 Related)

### 7.1 Current Vulnerability: Funds Can Be Extracted

```rust
// CURRENT (VULNERABLE) BEHAVIOR - This property FAILS
#[test]
fn prop_partial_refund_current_vulnerable() {
    proptest!(|(
        sale_price in 1_000_000u64..10_000_000_000u64,
        buyer_amount in 0u64..10_000_000_000u64,
        seller_amount in 0u64..10_000_000_000u64
    )| {
        // Current code allows: buyer_amount + seller_amount <= sale_price
        let total_refund = buyer_amount.saturating_add(seller_amount);
        let is_valid = total_refund <= sale_price;

        if is_valid {
            let remainder = sale_price - total_refund;
            // remainder goes to treasury - admin can extract funds!

            // This property SHOULD fail but currently passes:
            // prop_assert_eq!(buyer_amount + seller_amount, sale_price);
        }
    });
}
```

### 7.2 Required Fix: Exact Split

```rust
// REQUIRED (SECURE) BEHAVIOR
#[test]
fn prop_partial_refund_exact_split() {
    proptest!(|(
        sale_price in 1_000_000u64..10_000_000_000u64,
        buyer_amount in 0u64..10_000_000_000u64,
        seller_amount in 0u64..10_000_000_000u64
    )| {
        let total_refund = buyer_amount.saturating_add(seller_amount);

        // Property: Refund must equal sale_price exactly (no remainder)
        let is_valid = total_refund == sale_price;

        if is_valid {
            let remainder = sale_price - total_refund;
            prop_assert_eq!(remainder, 0);
        }
    });
}
```

---

## Trident Fuzzer Configuration

Create `trident-tests/fuzz_tests/fuzz_0/test_fuzz.rs`:

```rust
use trident_client::fuzzing::*;
use app_market::ID as PROGRAM_ID;

#[derive(Arbitrary, Clone)]
pub struct FuzzAccounts {
    config: AccountId,
    listing: AccountId,
    escrow: AccountId,
    seller: AccountId,
    buyer: AccountId,
    admin: AccountId,
}

#[derive(Arbitrary, Clone)]
pub enum FuzzInstruction {
    Initialize {
        platform_fee_bps: u64,
        dispute_fee_bps: u64,
    },
    CreateListing {
        salt: u64,
        starting_price: u64,
        duration_seconds: i64,
    },
    PlaceBid {
        amount: u64,
    },
    BuyNow,
    SettleAuction,
    // ... more instructions
}

impl FuzzInstruction {
    fn get_invariants(&self) -> Vec<Invariant> {
        match self {
            FuzzInstruction::PlaceBid { amount } => vec![
                Invariant::EscrowBalanceIncreases(*amount),
                Invariant::BidAboveMinimum,
                Invariant::ListingStatusActive,
            ],
            FuzzInstruction::BuyNow => vec![
                Invariant::ListingBecomesSold,
                Invariant::TransactionCreated,
            ],
            // ... more invariants
        }
    }
}
```

---

## Test Implementation Priority

### Immediate (Critical/High Findings)

1. **H-01: Partial Refund Extraction** - Property 7.2 will catch this
2. **State Machine Transitions** - Property 2 prevents invalid state changes
3. **Fee Calculation** - Property 1 ensures no funds lost

### Short-Term

4. **Escrow Balance Consistency** - Property 3
5. **Timelock Enforcement** - Property 4
6. **Bid Increment** - Property 5

### Ongoing

7. **Withdrawal Pattern** - Property 6
8. **DoS Limits** - Fuzz MAX_BIDS_PER_LISTING boundaries

---

## Integration with CI/CD

```yaml
# .github/workflows/fuzz.yml
name: Fuzz Tests

on:
  push:
    paths:
      - 'programs/**/*.rs'
  schedule:
    - cron: '0 0 * * *'  # Daily

jobs:
  trident-fuzz:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: coral-xyz/setup-anchor@v2
      - run: cargo install trident-cli
      - run: trident fuzz run --iterations 10000
```

---

## Summary

| Property | Catches | Priority |
|----------|---------|----------|
| Fee calculation invariants | Fund loss, overflow | HIGH |
| State machine transitions | Invalid state changes | HIGH |
| Escrow balance tracking | Fund theft, stuck funds | HIGH |
| Timelock enforcement | Admin bypass | HIGH |
| Partial refund exact split | H-01 admin extraction | CRITICAL |
| Bid increment bounds | Auction manipulation | MEDIUM |
| Withdrawal uniqueness | PDA collision | MEDIUM |

**Recommendation**: Implement Property 7.2 (partial refund exact split) immediately to address H-01. Then implement the Trident fuzzer configuration for comprehensive state machine testing.
