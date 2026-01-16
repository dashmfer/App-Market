# Sharp Edges Analysis: App Market Escrow (Updated)

**Date**: 2026-01-16
**Scope**: `programs/app-market/src/lib.rs`
**Framework**: Anchor 0.30.0 (Solana)

---

## Executive Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 3 | 0 fixed |
| High | 5 | 1 partially fixed |
| Medium | 6 | 2 fixed |
| Low | 4 | 0 fixed |
| **Total** | **18** | **3 addressed** |

---

## Critical Sharp Edges

### SE-01: Initialize Function - First Caller Wins (CRITICAL)

**Category**: Dangerous Default / Configuration Cliff

**Location**: `lib.rs:L71-102`

**The Footgun**:
```rust
pub fn initialize(
    ctx: Context<Initialize>,
    platform_fee_bps: u64,
    dispute_fee_bps: u64,
    backend_authority: Pubkey,
) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();  // First caller = admin forever
    config.treasury = ctx.accounts.treasury.key();
    // ...
}
```

**Why It's a Footgun**:
- **The Lazy Developer**: Deploys program, takes a coffee break, attacker initializes first
- **The Confused Developer**: Assumes program deployer is automatically admin
- **The Scoundrel**: Monitors mempool, frontruns initialization

**Misuse Scenario**:
1. Developer deploys program
2. Attacker sees deployment transaction
3. Attacker sends `initialize` with their own admin key
4. Attacker now controls entire marketplace

**Status**: ❌ NOT FIXED

---

### SE-02: Treasury Account - No Validation (CRITICAL)

**Category**: Silent Failure / Stringly-Typed Security

**Location**: `lib.rs:L2010-2011`

**The Footgun**:
```rust
/// CHECK: Treasury wallet to receive fees
pub treasury: AccountInfo<'info>,  // NO VALIDATION
```

**Why It's a Footgun**:
- Can set treasury to a program-owned account (funds locked forever)
- Can set treasury to system program (funds burned)
- Can set treasury to an account that can't receive SOL

**Edge Cases NOT Checked**:
- `treasury.owner != system_program::ID` → Not a normal wallet
- `treasury.lamports() == 0` → May not be initialized
- `treasury == Pubkey::default()` → Null address

**Status**: ❌ NOT FIXED

---

### SE-03: Backend Authority - Single Point of Failure (CRITICAL)

**Category**: Configuration Cliff / Dangerous Default

**Location**: `lib.rs:L924-958`

**The Footgun**:
```rust
pub fn verify_uploads(...) -> Result<()> {
    require!(
        ctx.accounts.backend_authority.key() == ctx.accounts.config.backend_authority,
        AppMarketError::NotBackendAuthority
    );
    // No fallback if key is lost or compromised
}
```

**Edge Cases**:
| Scenario | Result |
|----------|--------|
| Backend key lost | All pending transactions stuck FOREVER |
| Backend key compromised | Attacker can verify fraudulent transfers |
| Backend server down | No transactions can complete |
| Backend key rotation | Must update on-chain (admin action) |

**Status**: ❌ NOT FIXED

---

## High Sharp Edges

### SE-04: Partial Refund - Admin Fund Extraction (HIGH)

**Category**: Configuration Cliff / Stringly-Typed Security

**Location**: `lib.rs:L1761-1832`

**The Footgun**:
```rust
DisputeResolution::PartialRefund { buyer_amount, seller_amount } => {
    let total_refund = buyer_amount.checked_add(seller_amount)?;
    require!(total_refund <= transaction.sale_price, ...);  // <= not ==
    // ...
    let remaining = transaction.sale_price.checked_sub(total_refund)?;
    if remaining > 0 {
        // Goes to TREASURY (admin-controlled!)
        anchor_lang::system_program::transfer(cpi_ctx, remaining)?;
    }
}
```

**Misuse Scenario**:
```
Sale price: 10 SOL
Admin resolves: buyer=1 SOL, seller=1 SOL
Remaining: 8 SOL → Treasury
Admin withdraws: 8 SOL profit
```

**Status**: ❌ NOT FIXED

---

### SE-05: Timelock Inconsistency (HIGH)

**Category**: API Inconsistency / Configuration Cliff

**The Footgun**:
| Operation | Timelock | Impact |
|-----------|----------|--------|
| Change treasury | 48 hours | Money destination |
| Change admin | 48 hours | Full control |
| Pause contract | None | Halt all operations |
| Resolve dispute | None | Move user funds |

**Why It's Inconsistent**:
- Changing treasury (future fees) requires 48hr wait
- Resolving dispute (moving existing funds) is immediate
- Admin can drain user funds faster than they can change where fees go

**Status**: ❌ NOT FIXED

---

### SE-06: Fee Bounds - Zero Allowed (HIGH)

**Category**: Dangerous Default / Edge Case

**Location**: `lib.rs:L77-85`

**The Footgun**:
```rust
require!(platform_fee_bps <= MAX_PLATFORM_FEE_BPS, ...);  // 0 is valid!
require!(dispute_fee_bps <= MAX_DISPUTE_FEE_BPS, ...);    // 0 is valid!
```

**Edge Cases NOT Checked**:
- `platform_fee_bps = 0` → No platform revenue (intentional? bug?)
- `dispute_fee_bps = 0` → Free dispute spam
- Combined fees could be 15% (10% + 5%)

**Status**: ❌ NOT FIXED

---

### SE-07: DoS Limits - Boundary Conditions (HIGH → FIXED)

**Category**: Dangerous Default

**Location**: `lib.rs:L59-64`

**Previous Issue**: No limits on bids/offers

**Current Code** (FIXED):
```rust
pub const MAX_BIDS_PER_LISTING: u64 = 1000;
pub const MAX_OFFERS_PER_LISTING: u64 = 100;
pub const MAX_CONSECUTIVE_OFFERS: u64 = 10;
```

**Implementation**:
```rust
require!(listing.withdrawal_count < MAX_BIDS_PER_LISTING, AppMarketError::MaxBidsExceeded);
require!(listing.offer_count < MAX_OFFERS_PER_LISTING, AppMarketError::MaxOffersExceeded);
```

**Status**: ✅ FIXED

---

### SE-08: offer_seed - Client-Controlled PDA (HIGH)

**Category**: Stringly-Typed Security

**Location**: `lib.rs:L2356-2375`

**The Footgun**:
```rust
seeds = [
    b"offer",
    listing.key().as_ref(),
    buyer.key().as_ref(),
    &offer_seed.to_le_bytes()  // Client provides this!
]
```

**Problem**: Same buyer can accidentally use same `offer_seed` and transaction fails.

**Why Not Fixed**: Uses counter-based IDs for withdrawals but not for offers.

**Status**: ❌ NOT FIXED

---

## Medium Sharp Edges

### SE-09: Anti-Sniping Infinite Extension (MEDIUM)

**Category**: Configuration Cliff

**Location**: `lib.rs:L451-456`

```rust
if listing.auction_started && clock.unix_timestamp > listing.end_time - ANTI_SNIPE_WINDOW {
    listing.end_time = clock.unix_timestamp.checked_add(ANTI_SNIPE_EXTENSION)?;
}
```

**Edge Case**: Two bidders alternating every 14 minutes = infinite auction

**Status**: ❌ NOT FIXED

---

### SE-10: GitHub Username Validation Incomplete (MEDIUM)

**Category**: Input Validation Gap

**Location**: `lib.rs:L275-284`

```rust
require!(required_github_username.len() <= 64, ...);
require!(required_github_username.chars().all(|c| c.is_alphanumeric() || c == '-'), ...);
```

**Missing Validations**:
- Cannot start with hyphen
- Cannot end with hyphen
- Cannot have consecutive hyphens

**Status**: ❌ NOT FIXED

---

### SE-11: Clock Manipulation Window (MEDIUM)

**Category**: Dangerous Default

**Location**: Multiple functions using `Clock::get()?`

Solana validators can manipulate clock by ±30 seconds. Affects:
- Anti-sniping window boundary (15 minutes)
- Auction end timing
- Offer deadlines

**Status**: Acknowledged (inherent Solana limitation)

---

### SE-12: Saturating Stats (MEDIUM)

**Category**: Silent Failure

**Location**: `lib.rs:L1074-1077`

```rust
config.total_volume = config.total_volume.saturating_add(transaction.sale_price);
config.total_sales = config.total_sales.saturating_add(1);
```

After `u64::MAX`, stats become silently inaccurate.

**Status**: ❌ NOT FIXED (but low practical impact)

---

### SE-13: Consecutive Offer Tracking (MEDIUM → FIXED)

**Category**: DoS Prevention

**Location**: `lib.rs:L1243-1265`

**Current Code** (FIXED):
```rust
if let Some(last_buyer) = listing.last_offer_buyer {
    if last_buyer == buyer_key {
        require!(
            listing.consecutive_offer_count < MAX_CONSECUTIVE_OFFERS,
            AppMarketError::MaxConsecutiveOffersExceeded
        );
        listing.consecutive_offer_count = listing.consecutive_offer_count.checked_add(1)?;
    } else {
        listing.last_offer_buyer = Some(buyer_key);
        listing.consecutive_offer_count = 1;
    }
}
```

**Status**: ✅ FIXED

---

### SE-14: expire_offer Access Control (MEDIUM → FIXED)

**Category**: Access Control

**Location**: `lib.rs:L1390-1394`

**Previous Issue**: Anyone could expire offers

**Current Code** (FIXED):
```rust
// SECURITY: Only offer owner (buyer) can expire their own offer
require!(
    ctx.accounts.caller.key() == offer.buyer,
    AppMarketError::NotOfferOwner
);
```

**Status**: ✅ FIXED

---

## Low Sharp Edges

### SE-15: Magic Numbers (LOW)

**Location**: `lib.rs:L369`

```rust
let tx_fee_buffer = 10_000; // Magic number - should be named constant
```

**Status**: ❌ NOT FIXED

---

### SE-16: Unused Error Variant (LOW)

**Location**: `lib.rs:L3133`

```rust
DisputeDeadlineExpired,  // Never used
```

**Status**: ❌ NOT FIXED

---

### SE-17: Listing ID Format (LOW)

**Location**: `lib.rs:L292`

```rust
listing.listing_id = format!("{}-{}", ctx.accounts.seller.key(), salt);
```

Pubkey (44 chars) + "-" + u64 (up to 20 digits) could exceed 64 char limit.

**Status**: ❌ NOT FIXED

---

### SE-18: Escrow Rent Recipient Inconsistency (LOW)

| Context | Rent Recipient |
|---------|----------------|
| CancelAuction | seller |
| ExpireListing | seller |
| EmergencyRefund | buyer |
| ConfirmReceipt | seller |

**Status**: By design (not a bug)

---

## Summary by Adversary Type

### The Scoundrel (Malicious Actor)
| Sharp Edge | Exploitable? | Impact |
|------------|--------------|--------|
| SE-01 Initialize | ✅ Frontrun | Full control |
| SE-02 Treasury | ✅ Set to own | Steal fees |
| SE-03 Backend | ✅ Compromise | Verify fraud |
| SE-04 Partial Refund | ✅ As admin | Extract funds |

### The Lazy Developer
| Sharp Edge | Likely Mistake | Impact |
|------------|----------------|--------|
| SE-01 Initialize | Forget to init first | Lose control |
| SE-06 Fee Bounds | Set 0% fee | No revenue |
| SE-08 offer_seed | Reuse same value | Failed txs |

### The Confused Developer
| Sharp Edge | Confusion Point | Impact |
|------------|-----------------|--------|
| SE-05 Timelock | Assume all admin ops timelocked | Surprise drain |
| SE-09 Anti-snipe | Assume auctions end | Infinite auction |
| SE-12 Saturating | Assume stats accurate | Wrong data |

---

## Recommendations Priority

| Priority | Sharp Edge | Fix Effort |
|----------|------------|------------|
| CRITICAL | SE-01 Initialize | Low (add check) |
| CRITICAL | SE-02 Treasury | Low (add constraint) |
| CRITICAL | SE-03 Backend | Medium (add timeout) |
| HIGH | SE-04 Partial Refund | Low (change <= to ==) |
| HIGH | SE-05 Timelock | Medium (add timelock) |
| HIGH | SE-08 offer_seed | Low (use counter) |
| MEDIUM | SE-09 Anti-snipe | Low (add max extension) |
