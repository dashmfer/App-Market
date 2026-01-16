# Entry Point Analysis: App Market Escrow (Main Branch)

**Analyzed**: 2026-01-16
**Scope**: `programs/app-market/src/lib.rs`
**Languages**: Rust (Solana/Anchor 0.30.0)
**Focus**: State-changing functions only (view/pure excluded)
**Branch**: main

---

## Summary

| Category | Count |
|----------|-------|
| Public (Unrestricted) | 10 |
| Role-Restricted (Admin) | 6 |
| Role-Restricted (Backend) | 1 |
| Role-Restricted (Buyer) | 5 |
| Role-Restricted (Seller) | 6 |
| Role-Restricted (Party to Transaction) | 2 |
| Contract-Only | 0 |
| **Total** | **30** |

---

## Public Entry Points (Unrestricted)

State-changing functions callable by anyone—prioritize for attack surface analysis.

| Function | File | Notes |
|----------|------|-------|
| `place_bid(amount: u64)` | `lib.rs:L396-527` | DoS protected (MAX_BIDS=1000, MAX_CONSECUTIVE=10) |
| `buy_now()` | `lib.rs:L727-870` | Buy now price validation |
| `settle_auction()` | `lib.rs:L873-961` | Anyone can settle after auction ends |
| `expire_listing()` | `lib.rs:L733-780` | Anyone can expire after deadline |
| `withdraw_funds()` | `lib.rs:L530-600` | Withdrawal pattern for outbid bidders |
| `make_offer(amount, deadline, offer_seed)` | `lib.rs:L1380-1489` | DoS protected (MAX_OFFERS=100, MAX_CONSECUTIVE=10) |
| `cancel_offer()` | `lib.rs:L1492-1554` | Only offer owner (buyer check in code) |
| `expire_offer()` | `lib.rs:L1558-1625` | Only offer owner (buyer check in code) |
| `contest_dispute_resolution()` | `lib.rs:L1902-1942` | Buyer/seller can contest within 48hr |
| `execute_dispute_resolution()` | `lib.rs:L1946-2160` | Anyone after timelock expires |

---

## Role-Restricted Entry Points

### Admin

| Function | File | Restriction |
|----------|------|-------------|
| `initialize(...)` | `lib.rs:L85-144` | **SECURITY: EXPECTED_ADMIN hardcoded check (C-01 FIXED)** |
| `propose_treasury_change(new_treasury)` | `lib.rs:L147-178` | `config.admin == admin.key()` |
| `execute_treasury_change()` | `lib.rs:L181-213` | `config.admin == admin.key()` + 48hr timelock |
| `propose_admin_change(new_admin)` | `lib.rs:L216-247` | `config.admin == admin.key()` |
| `execute_admin_change()` | `lib.rs:L250-281` | `config.admin == admin.key()` + 48hr timelock |
| `set_paused(paused)` | `lib.rs:L284-302` | `config.admin == admin.key()` |
| `propose_dispute_resolution(...)` | `lib.rs:L1848-1898` | `config.admin == admin.key()` |
| `admin_emergency_verify()` | `lib.rs:L1092-1134` | `config.admin == admin.key()` + 30-day timeout |

### Backend Authority

| Function | File | Restriction |
|----------|------|-------------|
| `verify_uploads(verification_hash)` | `lib.rs:L1008-1042` | `config.backend_authority == backend_authority.key()` |

**Note**: C-02 FIXED - Emergency verification fallback after 30 days (`BACKEND_TIMEOUT_SECONDS`).

### Buyer

| Function | File | Restriction |
|----------|------|-------------|
| `confirm_receipt()` | `lib.rs:L1266-1377` | `transaction.buyer == buyer.key()` |
| `emergency_refund()` | `lib.rs:L2163-2246` | `transaction.buyer == buyer.key()` + deadline passed |
| `open_dispute(reason)` | `lib.rs:L1766-1843` | `buyer OR seller` (see Party to Transaction) |
| `emergency_auto_verify()` | `lib.rs:L1046-1088` | `transaction.buyer == buyer.key()` + 30-day timeout |
| `cancel_offer()` | `lib.rs:L1492-1554` | `offer.buyer == buyer.key()` |
| `expire_offer()` | `lib.rs:L1558-1625` | `offer.buyer == buyer.key()` |

### Seller

| Function | File | Restriction |
|----------|------|-------------|
| `create_listing(...)` | `lib.rs:L305-393` | Seller creates listing (pays rent) |
| `cancel_listing()` | `lib.rs:L2249-2267` | `listing.seller == seller.key()` + no bids |
| `cancel_auction()` | `lib.rs:L783-822` | `listing.seller == seller.key()` + no bids |
| `seller_confirm_transfer(...)` | `lib.rs:L964-1005` | `transaction.seller == seller.key()` |
| `finalize_transaction()` | `lib.rs:L1137-1263` | `transaction.seller == seller.key()` + grace period |
| `accept_offer()` | `lib.rs:L1628-1763` | `listing.seller == seller.key()` |

### Party to Transaction (Buyer OR Seller)

| Function | File | Restriction |
|----------|------|-------------|
| `open_dispute(reason)` | `lib.rs:L1766-1843` | `buyer OR seller` |
| `contest_dispute_resolution()` | `lib.rs:L1902-1942` | `buyer OR seller` |

---

## Security Fixes Verified (Main Branch)

### C-01: Initialization Frontrunning - **FIXED**

```rust
// lib.rs:L79
pub const EXPECTED_ADMIN: Pubkey = pubkey!("63jQ3qffMgacpUw8ebDZPuyUHf7DsfsYnQ7sk8fmFaF1");

// lib.rs:L93-96
require!(
    ctx.accounts.admin.key() == EXPECTED_ADMIN,
    AppMarketError::NotExpectedAdmin
);
```

### C-02: Backend Authority Single Point of Failure - **FIXED**

```rust
// lib.rs:L73
pub const BACKEND_TIMEOUT_SECONDS: i64 = 30 * 24 * 60 * 60; // 30 days

// lib.rs:L1046-1088 - emergency_auto_verify()
// lib.rs:L1092-1134 - admin_emergency_verify()
```

### H-01: Partial Refund Validation - **FIXED**

```rust
// lib.rs:L1867-1870
require!(
    total_refund == transaction.sale_price,
    AppMarketError::PartialRefundMustEqualSalePrice
);
```

### H-02: Dispute Resolution Timelock - **FIXED**

```rust
// lib.rs:L76
pub const DISPUTE_RESOLUTION_TIMELOCK_SECONDS: i64 = 48 * 60 * 60; // 48 hours

// lib.rs:L1848-1898 - propose_dispute_resolution()
// lib.rs:L1902-1942 - contest_dispute_resolution()
// lib.rs:L1946-2160 - execute_dispute_resolution()
```

### H-03: Treasury Validation - **FIXED**

Treasury is now validated against config in account constraints:

```rust
// lib.rs:L2648-2652 (ConfirmReceipt)
#[account(
    mut,
    constraint = treasury.key() == config.treasury @ AppMarketError::InvalidTreasury
)]
pub treasury: AccountInfo<'info>,
```

---

## Access Control Matrix

| Function | Admin | Backend | Seller | Buyer | Anyone |
|----------|-------|---------|--------|-------|--------|
| initialize | ✓ (expected) | | | | |
| propose_treasury_change | ✓ | | | | |
| execute_treasury_change | ✓ | | | | |
| propose_admin_change | ✓ | | | | |
| execute_admin_change | ✓ | | | | |
| set_paused | ✓ | | | | |
| verify_uploads | | ✓ | | | |
| create_listing | | | ✓ | | |
| place_bid | | | | | ✓ |
| buy_now | | | | | ✓ |
| settle_auction | | | | | ✓ |
| cancel_listing | | | ✓ | | |
| cancel_auction | | | ✓ | | |
| expire_listing | | | | | ✓ |
| seller_confirm_transfer | | | ✓ | | |
| emergency_auto_verify | | | | ✓ | |
| admin_emergency_verify | ✓ | | | | |
| finalize_transaction | | | ✓ | | |
| confirm_receipt | | | | ✓ | |
| make_offer | | | | | ✓ |
| cancel_offer | | | | ✓ | |
| expire_offer | | | | ✓ | |
| accept_offer | | | ✓ | | |
| open_dispute | | | ✓ | ✓ | |
| propose_dispute_resolution | ✓ | | | | |
| contest_dispute_resolution | | | ✓ | ✓ | |
| execute_dispute_resolution | | | | | ✓ |
| emergency_refund | | | | ✓ | |
| withdraw_funds | | | | | ✓ (owner) |

---

## DoS Protection Summary

| Protection | Constant | Value |
|------------|----------|-------|
| Max bids per listing | `MAX_BIDS_PER_LISTING` | 1,000 |
| Max offers per listing | `MAX_OFFERS_PER_LISTING` | 100 |
| Max consecutive bids | `MAX_CONSECUTIVE_BIDS` | 10 |
| Max consecutive offers | `MAX_CONSECUTIVE_OFFERS` | 10 |

---

## Files Analyzed

- `programs/app-market/src/lib.rs` (3545 lines, 30 state-changing entry points)

---

## Recommendations

1. ✅ C-01, C-02, H-01, H-02, H-03 all addressed on main branch
2. Consider adding rate limiting at the protocol level
3. Monitor consecutive bid/offer tracking for edge cases
4. Add comprehensive tests for timelock mechanisms
