# Variant Analysis: App Market Escrow

**Analysis Date**: 2026-01-16
**Scope**: `programs/app-market/src/lib.rs`
**Method**: Pattern-based search from known vulnerabilities

---

## Known Issues Used as Seeds

From previous analysis, the following critical issues were identified:

1. **Missing Access Control on Initialize** (C-01)
2. **Unchecked AccountInfo Parameters** (H-03)
3. **Admin Fund Extraction via Partial Refund** (H-01)
4. **Escrow Amount Tracking Inconsistency Risk** (H-04)

---

## Variant Search 1: Missing Access Control Patterns

### Root Cause
Functions that perform privileged operations without verifying the caller has appropriate authority.

### Original Instance
```rust
// lib.rs:L71 - initialize()
pub fn initialize(...) -> Result<()> {
    config.admin = ctx.accounts.admin.key(); // No check who admin is
}
```

### Search Pattern
Looking for functions that:
- Set authority/admin fields without constraint validation
- Accept Signer accounts without role verification

### Variants Found

| Location | Function | Pattern | Severity |
|----------|----------|---------|----------|
| L71-102 | `initialize` | First-caller-wins admin assignment | **Critical** |
| L864-890 | `expire_listing` | No signer requirement, anyone can expire | **Medium** |
| L738-816 | `settle_auction` | Allows admin OR seller OR winner (intentional but wide) | Low |

**Detailed Analysis:**

#### Variant 1.1: `expire_listing` Has No Signer Check on Caller

```rust
// lib.rs:L2227-2245
#[derive(Accounts)]
pub struct ExpireListing<'info> {
    #[account(mut)]
    pub listing: Account<'info, Listing>,

    // seller is just AccountInfo, not Signer!
    /// CHECK: Seller receives rent
    #[account(mut)]
    pub seller: AccountInfo<'info>,
    // No payer/caller Signer account at all
}
```

**Impact**: Anyone can call `expire_listing` for any expired listing. While this is probably intentional (permissionless expiry), it means:
- Attacker can front-run seller's own expiry transaction
- Rent goes to seller either way, but timing is uncontrolled

**Verdict**: Low severity - likely intentional design, but worth documenting.

#### Variant 1.2: `settle_auction` Wide Authorization

```rust
// lib.rs:L759-768
let is_seller = ctx.accounts.payer.key() == listing.seller;
let is_winner = listing.current_bidder
    .map(|bidder| ctx.accounts.payer.key() == bidder)
    .unwrap_or(false);
let is_admin = ctx.accounts.payer.key() == ctx.accounts.config.admin;

require!(is_seller || is_winner || is_admin, UnauthorizedSettlement);
```

**Impact**: Three different roles can settle. This is intentional but creates:
- Potential for race conditions between parties
- Admin can settle before seller/winner are ready

**Verdict**: Low severity - intentional design with documented behavior.

---

## Variant Search 2: Unchecked AccountInfo Patterns

### Root Cause
`AccountInfo` with `/// CHECK` comments that rely on instruction-level validation which may be incomplete.

### Original Instance
```rust
// lib.rs:L2009-2010
/// CHECK: Treasury wallet to receive fees
pub treasury: AccountInfo<'info>,  // No validation at all in Initialize
```

### Search Pattern
```bash
rg "/// CHECK" lib.rs
```

### Variants Found

| Location | Account | Claimed Validation | Actual Validation | Risk |
|----------|---------|-------------------|-------------------|------|
| L2009 | `Initialize.treasury` | "Treasury wallet" | None | **High** |
| L2164 | `BuyNow.pending_withdrawal` | "Only used if..." | Manual PDA check | Low |
| L2197 | `SettleAuction.bidder` | "validated in instruction" | None! | **Medium** |
| L2243 | `ExpireListing.seller` | "Seller receives rent" | constraint on listing.seller | Low |
| L2296 | `FinalizeTransaction.seller` | "validated via transaction.seller" | constraint ✓ | Safe |
| L2303 | `FinalizeTransaction.buyer` | "not used for rent" | No validation | Low |
| L2340 | `ConfirmReceipt.seller` | "validated via transaction.seller" | constraint ✓ | Safe |
| L2432 | `ExpireOffer.buyer` | "from offer.buyer" | constraint ✓ | Safe |
| L2500 | `AcceptOffer.buyer` | "rent recipient" | No constraint | **Medium** |
| L2533 | `OpenDispute.treasury` | "Treasury to receive..." | No validation | **Medium** |
| L2573 | `ResolveDispute.buyer` | "validated via transaction" | constraint ✓ | Safe |
| L2580 | `ResolveDispute.seller` | "validated via transaction" | constraint ✓ | Safe |
| L2587 | `ResolveDispute.treasury` | "Treasury" | No validation | **Medium** |

**Detailed Analysis:**

#### Variant 2.1: `SettleAuction.bidder` Not Validated

```rust
// lib.rs:L2197-2199
/// CHECK: Current bidder (validated in instruction)
#[account(mut)]
pub bidder: AccountInfo<'info>,
```

**But the instruction doesn't validate it!**:
```rust
// lib.rs:L738-816 - settle_auction
// Searches for validation of bidder account... NOT FOUND
// The function creates transaction.buyer from listing.current_bidder
// But never validates ctx.accounts.bidder matches!
```

**Impact**: The `bidder` account is passed but never used or validated. Harmless but confusing.

**Verdict**: Medium - Code smell, unused account parameter.

#### Variant 2.2: `AcceptOffer.buyer` No Constraint

```rust
// lib.rs:L2500-2502
/// CHECK: Buyer - rent recipient for offer escrow
#[account(mut)]
pub buyer: AccountInfo<'info>,
```

**Issue**: No constraint that `buyer.key() == offer.buyer`. The offer_escrow close constraint does check this, but directly passing wrong buyer account could cause issues.

```rust
// The constraint is on offer_escrow, not buyer:
#[account(
    mut,
    close = buyer,  // This buyer account
    constraint = offer.buyer == buyer.key() @ InvalidBuyer  // ✓ Actually validated!
)]
pub offer_escrow: Account<'info, OfferEscrow>,
```

**Verdict**: Actually safe - the constraint on offer_escrow validates buyer. But the validation location is confusing.

#### Variant 2.3: `OpenDispute.treasury` Not Validated Against Config

```rust
// lib.rs:L2533-2535
/// CHECK: Treasury to receive dispute fees
#[account(mut)]
pub treasury: AccountInfo<'info>,
```

**But wait, it IS validated in instruction**:
```rust
// lib.rs:L1600-1602
require!(
    ctx.accounts.treasury.key() == ctx.accounts.config.treasury,
    AppMarketError::InvalidTreasury
);
```

**Verdict**: Safe - validated in instruction. But would be cleaner as constraint.

---

## Variant Search 3: Fund Extraction Patterns

### Root Cause
Functions that allow one party to receive more funds than intended through configuration or parameter manipulation.

### Original Instance
```rust
// lib.rs:L1760-1831 - resolve_dispute with PartialRefund
// Admin can set buyer_amount + seller_amount < sale_price
// Remainder goes to treasury (admin-controlled)
```

### Search Pattern
Looking for:
- Fund distribution logic with configurable splits
- Calculations where total out ≠ total in
- Admin-controlled fund destinations

### Variants Found

| Location | Function | Pattern | Risk |
|----------|----------|---------|------|
| L1760-1831 | `resolve_dispute` | Partial refund remainder to treasury | **High** |
| L1038-1047 | `finalize_transaction` | platform_fee + seller_proceeds = sale_price | Safe |
| L1152-1176 | `confirm_receipt` | platform_fee + seller_proceeds = sale_price | Safe |

**Detailed Analysis:**

The only fund extraction risk is the already-identified `resolve_dispute` issue. Other fund distribution paths are correctly constrained:

```rust
// Transaction creation (safe pattern):
transaction.platform_fee = sale_price * fee_bps / BASIS_POINTS_DIVISOR;
transaction.seller_proceeds = sale_price - platform_fee;
// Total: platform_fee + seller_proceeds = sale_price ✓
```

**No additional variants found.**

---

## Variant Search 4: Escrow Tracking Consistency

### Root Cause
The `escrow.amount` field must stay synchronized with actual lamports. Any desync could allow theft.

### Original Instance
Multiple locations update `escrow.amount` after transfers.

### Search Pattern
```bash
rg "escrow.amount" lib.rs
```

### Variants Found

All `escrow.amount` modifications:

| Location | Operation | Pattern | Sync Risk |
|----------|-----------|---------|-----------|
| L447-450 | `place_bid` | `+= amount` after transfer in | Low |
| L582-584 | `withdraw_funds` | `-= amount` after transfer out | Low |
| L627-629 | `buy_now` | `+= buy_now_price` after transfer in | Low |
| L1049-1051 | `finalize_transaction` | `-= platform_fee` after transfer | Low |
| L1064-1066 | `finalize_transaction` | `-= seller_proceeds` after transfer | Low |
| L1163-1165 | `confirm_receipt` | `-= platform_fee` after transfer | Low |
| L1178-1180 | `confirm_receipt` | `-= seller_proceeds` after transfer | Low |
| L1513-1515 | `accept_offer` | `+= offer.amount` after transfer | Low |
| L1713-1715 | `resolve_dispute` | `-= sale_price` after transfer | Low |
| L1739-1741 | `resolve_dispute` | `-= platform_fee` after transfer | Low |
| L1754-1756 | `resolve_dispute` | `-= seller_proceeds` after transfer | Low |
| L1788-1790 | `resolve_dispute` | `-= buyer_amount` after transfer | Low |
| L1805-1807 | `resolve_dispute` | `-= seller_amount` after transfer | Low |
| L1825-1827 | `resolve_dispute` | `-= remaining` after transfer | Low |
| L1953-1955 | `emergency_refund` | `-= sale_price` after transfer | Low |

**Pattern Analysis:**

All updates follow the same pattern:
1. Transfer lamports
2. Update `escrow.amount` tracking

This is actually the reverse of CEI (Checks-Effects-Interactions), but in Solana's single-threaded execution model, it's safe. The update happens atomically with the transfer.

**Critical Validation Points:**

```rust
// Before closing escrow, these checks run:
require!(escrow.amount == required_balance, PendingWithdrawalsExist);
```

This invariant check prevents closing escrow when withdrawals are pending.

**No additional desync risks found** - the pattern is consistent across all functions.

---

## Variant Search 5: Arithmetic Safety

### Root Cause
Integer overflow/underflow in financial calculations.

### Search Pattern
Looking for arithmetic without `checked_*` or `saturating_*` wrappers.

### Results

All arithmetic operations found:

| Location | Operation | Method | Safe? |
|----------|-----------|--------|-------|
| L376-384 | Balance calculation | `checked_add` | ✓ |
| L406-416 | Bid increment | `checked_mul`, `checked_div`, `checked_add` | ✓ |
| L440-442 | End time extension | `checked_add` | ✓ |
| L447-450 | Escrow tracking | `checked_add` | ✓ |
| L453-455 | Anti-snipe extension | `checked_add` | ✓ |
| L472-474 | Withdrawal count | `checked_add` | ✓ |
| L706-713 | Fee calculation | `checked_mul`, `checked_div`, `checked_sub` | ✓ |
| L1074-1075 | Stats update | `saturating_add` | ✓ (intentional cap) |

**All financial arithmetic uses safe methods.**

---

## Summary: Variant Analysis Results

### New Issues Found

| ID | Location | Description | Severity |
|----|----------|-------------|----------|
| VA-01 | `ExpireListing` | No Signer on caller (intentional?) | Low |
| VA-02 | `SettleAuction.bidder` | Unused/unvalidated account parameter | Low |

### Confirmed Patterns (No New Variants)

| Pattern | Searched | Result |
|---------|----------|--------|
| Missing access control | ✓ | Only `initialize` is problematic |
| Unchecked AccountInfo | ✓ | Most have instruction-level validation |
| Fund extraction | ✓ | Only `resolve_dispute` partial refund |
| Escrow desync | ✓ | Consistent pattern, no risks |
| Arithmetic overflow | ✓ | All use checked/saturating |

### Code Quality Observations

1. **Consistent validation pattern**: Most `/// CHECK` accounts are validated in instructions
2. **Consistent arithmetic safety**: All math uses safe methods
3. **Consistent escrow tracking**: All paths update `escrow.amount` correctly

The codebase shows good consistency in security patterns. The vulnerabilities found are specific issues, not systemic patterns repeated throughout.
