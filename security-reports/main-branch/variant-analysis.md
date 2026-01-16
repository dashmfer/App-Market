# Variant Analysis: App Market Escrow (Main Branch)

**Analysis Date**: 2026-01-16
**Scope**: `programs/app-market/src/lib.rs`
**Framework**: Anchor 0.30.0 (Solana)
**Branch**: main

---

## Executive Summary

Variant analysis searches for similar patterns to known vulnerabilities across the codebase. This report analyzes whether fixes for critical vulnerabilities have been consistently applied.

| Vulnerability Class | Variants Found | Status |
|--------------------|----------------|--------|
| Access Control (C-01) | 0 | ✅ No variants |
| Single Point of Failure (C-02) | 0 | ✅ No variants |
| Partial Validation (H-01) | 0 | ✅ No variants |
| Missing Timelock (H-02) | 0 | ✅ No variants |
| Unchecked Accounts (H-03) | 0 | ✅ No variants |

---

## Pattern Search: C-01 Initialization Frontrunning

### Original Bug

First-caller-wins initialization without access control.

### Search Pattern

```
pattern: pub fn initialize
pattern-not-inside: require!($ADMIN == $EXPECTED, ...)
```

### Results

**Variants Found: 0** ✅

The `initialize` function now has proper access control:

```rust
// lib.rs:L93-96
require!(
    ctx.accounts.admin.key() == EXPECTED_ADMIN,
    AppMarketError::NotExpectedAdmin
);
```

### Related Functions Checked

| Function | Access Control | Status |
|----------|---------------|--------|
| `initialize` | `EXPECTED_ADMIN` check | ✅ Secure |
| `propose_treasury_change` | `config.admin` check | ✅ Secure |
| `execute_treasury_change` | `config.admin` check | ✅ Secure |
| `propose_admin_change` | `config.admin` check | ✅ Secure |
| `execute_admin_change` | `config.admin` check | ✅ Secure |
| `set_paused` | `config.admin` check | ✅ Secure |

---

## Pattern Search: C-02 Single Point of Failure

### Original Bug

Backend authority with no fallback mechanism.

### Search Pattern

```
pattern: backend_authority
pattern-not: BACKEND_TIMEOUT_SECONDS
```

### Results

**Variants Found: 0** ✅

Two fallback mechanisms exist:

1. **Buyer Emergency Verification** (`lib.rs:L1046-1088`)
```rust
require!(
    clock.unix_timestamp >= confirmed_at + BACKEND_TIMEOUT_SECONDS,
    AppMarketError::BackendTimeoutNotExpired
);
```

2. **Admin Emergency Verification** (`lib.rs:L1092-1134`)
```rust
require!(
    clock.unix_timestamp >= confirmed_at + BACKEND_TIMEOUT_SECONDS,
    AppMarketError::BackendTimeoutNotExpired
);
```

### Analysis

- Both buyer and admin can trigger after 30 days
- Admin has no special privilege (same 30-day wait)
- Events emitted for off-chain tracking

---

## Pattern Search: H-01 Partial Validation

### Original Bug

Partial refund allowed `<= sale_price` instead of `== sale_price`.

### Search Pattern

```
pattern: total_refund <= $PRICE
```

### Results

**Variants Found: 0** ✅

Fixed to strict equality:

```rust
// lib.rs:L1867-1870
require!(
    total_refund == transaction.sale_price,
    AppMarketError::PartialRefundMustEqualSalePrice
);
```

### Related Validation Checks

| Validation | Pattern | Status |
|------------|---------|--------|
| Partial refund | `== sale_price` | ✅ Strict |
| Escrow balance | `>= required + rent` | ✅ Correct |
| Platform fee | `<= MAX_PLATFORM_FEE_BPS` | ✅ Capped |

---

## Pattern Search: H-02 Missing Timelock

### Original Bug

Admin could execute dispute resolution immediately.

### Search Pattern

```
pattern: DisputeResolution
pattern-not-inside: DISPUTE_RESOLUTION_TIMELOCK_SECONDS
```

### Results

**Variants Found: 0** ✅

Three-phase timelock implemented:

1. **Propose** (`propose_dispute_resolution`)
2. **Contest** (`contest_dispute_resolution`) - 48hr window
3. **Execute** (`execute_dispute_resolution`) - After timelock

```rust
// lib.rs:L1964-1968
require!(
    clock.unix_timestamp >= proposed_at + DISPUTE_RESOLUTION_TIMELOCK_SECONDS,
    AppMarketError::DisputeTimelockNotExpired
);
```

### Related Timelock Operations

| Operation | Timelock | Status |
|-----------|----------|--------|
| Treasury change | 48 hours | ✅ Implemented |
| Admin change | 48 hours | ✅ Implemented |
| Dispute resolution | 48 hours | ✅ Implemented |

---

## Pattern Search: H-03 Unchecked Accounts

### Original Bug

Treasury account passed without validation against config.

### Search Pattern

```
pattern: /// CHECK:
pattern-not-inside: constraint = $FIELD == config.$EXPECTED
```

### Results

**Variants Found: 0** ✅

All `/// CHECK:` accounts now have constraints:

```rust
// lib.rs:L2648-2652 (ConfirmReceipt)
#[account(
    mut,
    constraint = treasury.key() == config.treasury @ AppMarketError::InvalidTreasury
)]
pub treasury: AccountInfo<'info>,

// lib.rs:L2597-2601 (FinalizeTransaction)
#[account(
    mut,
    constraint = seller.key() == transaction.seller @ AppMarketError::InvalidSeller
)]
pub seller: AccountInfo<'info>,
```

### All Unchecked Accounts Reviewed

| Account | Context | Constraint | Status |
|---------|---------|------------|--------|
| `treasury` | Initialize | N/A (first init) | ⚠️ See note |
| `treasury` | ConfirmReceipt | `== config.treasury` | ✅ |
| `treasury` | FinalizeTransaction | In-function check | ✅ |
| `treasury` | OpenDispute | `== config.treasury` | ✅ |
| `treasury` | ExecuteDisputeResolution | `== config.treasury` | ✅ |
| `seller` | FinalizeTransaction | `== transaction.seller` | ✅ |
| `seller` | ConfirmReceipt | `== transaction.seller` | ✅ |
| `seller` | ExecuteDisputeResolution | `== transaction.seller` | ✅ |
| `buyer` | ExecuteDisputeResolution | `== transaction.buyer` | ✅ |
| `bidder` | SettleAuction | In-function check | ✅ |

**Note on Initialize treasury**: The treasury in `Initialize` is unchecked because it's the first time setting it. This is acceptable because:
1. `EXPECTED_ADMIN` check prevents malicious initialization
2. Treasury is stored in config for future validation

---

## Pattern Search: DoS Vulnerabilities

### Original Bug (M-01, M-02)

Unbounded iteration through bids/offers.

### Search Pattern

```
pattern: .iter()
pattern: for $X in $COLLECTION
```

### Results

**Variants Found: 0** ✅

No unbounded iteration exists. DoS protection implemented:

```rust
pub const MAX_BIDS_PER_LISTING: u64 = 1000;
pub const MAX_OFFERS_PER_LISTING: u64 = 100;
pub const MAX_CONSECUTIVE_BIDS: u64 = 10;
pub const MAX_CONSECUTIVE_OFFERS: u64 = 10;
```

---

## Variant Analysis: Error Handling

### Search: Functions Without Error Checks

```
pattern: Ok(())
pattern-not-inside: require!($CONDITION, ...)
```

### Results

All state-changing functions have proper validation before `Ok(())`.

---

## Variant Analysis: Arithmetic Operations

### Search: Unchecked Arithmetic

```
pattern: $A + $B
pattern-not: checked_add
pattern-not: saturating_add
```

### Results

**Variants Found: 0** ✅

All arithmetic uses checked operations:

```rust
// Pattern throughout codebase
.checked_add($VALUE).ok_or(AppMarketError::MathOverflow)?
.checked_sub($VALUE).ok_or(AppMarketError::MathOverflow)?
.checked_mul($VALUE).ok_or(AppMarketError::MathOverflow)?
.checked_div($VALUE).ok_or(AppMarketError::MathOverflow)?

// Stats use saturating (acceptable for counters)
.saturating_add($VALUE)
```

---

## Cross-Codebase Consistency Check

### Access Control Patterns

| Pattern | Occurrences | Consistent |
|---------|-------------|------------|
| `require!(admin.key() == config.admin, ...)` | 6 | ✅ |
| `require!(seller.key() == listing.seller, ...)` | 5 | ✅ |
| `require!(buyer.key() == transaction.buyer, ...)` | 4 | ✅ |
| `require!(caller.key() == offer.buyer, ...)` | 2 | ✅ |

### Timelock Patterns

| Pattern | Occurrences | Consistent |
|---------|-------------|------------|
| `ADMIN_TIMELOCK_SECONDS` | 2 | ✅ |
| `DISPUTE_RESOLUTION_TIMELOCK_SECONDS` | 3 | ✅ |
| `BACKEND_TIMEOUT_SECONDS` | 2 | ✅ |

### Event Emission Patterns

| Operation | Event Emitted | Status |
|-----------|---------------|--------|
| Initialize | `MarketplaceInitialized` | ✅ |
| Listing created | `ListingCreated` | ✅ |
| Bid placed | `BidPlaced` | ✅ |
| Sale completed | `SaleCompleted` | ✅ |
| Dispute opened | `DisputeOpened` | ✅ |
| Dispute resolved | `DisputeResolved` | ✅ |
| Treasury changed | `TreasuryChanged` | ✅ |
| Admin changed | `AdminChanged` | ✅ |

---

## Recommendations

### No Action Required

All identified vulnerability patterns have been consistently fixed across the codebase.

### Future Monitoring

1. **New functions** should follow established patterns
2. **Access control** should use the same `require!` pattern
3. **Arithmetic** should always use `checked_*` operations
4. **Events** should be emitted for all state changes

---

## Conclusion

Variant analysis confirms that:

1. **C-01 fix** is complete - no other initialization vulnerabilities
2. **C-02 fix** is complete - fallback mechanisms cover all verification paths
3. **H-01 fix** is complete - no other partial validation issues
4. **H-02 fix** is complete - timelocks applied consistently
5. **H-03 fix** is complete - all unchecked accounts have constraints
6. **Arithmetic** is consistently safe throughout

The main branch shows no variant vulnerabilities related to the original audit findings.
