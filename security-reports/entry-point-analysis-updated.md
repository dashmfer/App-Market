# Entry Point Analysis: App Market Escrow (Updated)

**Analyzed**: 2026-01-16
**Scope**: `programs/app-market/src/lib.rs`
**Languages**: Solana (Anchor Framework)
**Focus**: State-changing functions only (view/pure excluded)

---

## Summary

| Category | Count |
|----------|-------|
| Public (Unrestricted) | 10 |
| Admin-Restricted | 7 |
| Backend Authority | 1 |
| Seller-Restricted | 6 |
| Buyer-Restricted | 4 |
| Contract-Only | 0 |
| **Total** | **28** |

---

## Public Entry Points (Unrestricted)

State-changing functions callable by anyone—prioritize for attack surface analysis.

| Function | Line | Notes |
|----------|------|-------|
| `initialize(platform_fee_bps, dispute_fee_bps, backend_authority)` | L71-102 | **CRITICAL: First caller becomes admin (C-01)** |
| `create_listing(salt, listing_type, starting_price, ...)` | L234-341 | Any user can create listings |
| `place_bid(amount)` | L344-541 | Any user can bid (except seller) |
| `buy_now()` | L598-736 | Any user can purchase (except seller) |
| `make_offer(amount, deadline, offer_seed)` | L1205-1308 | Any user can make offers |
| `settle_auction()` | L739-817 | Seller/winner/admin can settle |
| `withdraw_funds()` | L544-595 | Users can claim their pending withdrawals |
| `expire_listing()` | L865-891 | Anyone can expire (requires deadline passed) |
| `expire_offer()` | L1377-1444 | Buyer can expire their own offers |
| `open_dispute(reason)` | L1585-1656 | Buyer or seller can open dispute |

---

## Admin-Restricted Entry Points

### Admin Role
Functions requiring `ctx.accounts.admin.key() == ctx.accounts.config.admin`

| Function | Line | Restriction Pattern |
|----------|------|---------------------|
| `propose_treasury_change(new_treasury)` | L105-125 | `require!(admin.key() == config.admin)` |
| `execute_treasury_change()` | L128-158 | `require!(admin.key() == config.admin)` + 48hr timelock |
| `propose_admin_change(new_admin)` | L161-181 | `require!(admin.key() == config.admin)` |
| `execute_admin_change()` | L184-214 | `require!(admin.key() == config.admin)` + 48hr timelock |
| `set_paused(paused)` | L217-231 | `require!(admin.key() == config.admin)` - **No timelock** |
| `resolve_dispute(resolution, notes)` | L1659-1885 | `require!(admin.key() == config.admin)` - **No timelock (H-02)** |

### Backend Authority Role
Functions requiring `ctx.accounts.backend_authority.key() == ctx.accounts.config.backend_authority`

| Function | Line | Restriction Pattern |
|----------|------|---------------------|
| `verify_uploads(verification_hash)` | L925-959 | `require!(backend_authority.key() == config.backend_authority)` - **Single point of failure (C-02)** |

---

## Seller-Restricted Entry Points

Functions requiring the caller to be the listing seller.

| Function | Line | Restriction Pattern |
|----------|------|---------------------|
| `seller_confirm_transfer()` | L894-922 | `require!(seller.key() == transaction.seller)` |
| `accept_offer()` | L1447-1582 | `require!(seller.key() == listing.seller)` |
| `cancel_auction()` | L820-862 | `require!(seller.key() == listing.seller)` |
| `cancel_listing()` | L1974-1992 | `require!(seller.key() == listing.seller)` |
| `finalize_transaction()` | L962-1088 | `require!(seller.key() == transaction.seller)` |

---

## Buyer-Restricted Entry Points

Functions requiring the caller to be the transaction buyer.

| Function | Line | Restriction Pattern |
|----------|------|---------------------|
| `confirm_receipt()` | L1091-1202 | `require!(buyer.key() == transaction.buyer)` |
| `emergency_refund()` | L1888-1971 | `require!(buyer.key() == transaction.buyer)` |
| `cancel_offer()` | L1311-1373 | `require!(buyer.key() == offer.buyer)` |
| `expire_offer()` | L1377-1444 | `require!(caller.key() == offer.buyer)` |

---

## Critical Access Control Issues

### C-01: Initialize Has No Access Control (CRITICAL)

**Location**: `lib.rs:L71-102`

```rust
pub fn initialize(
    ctx: Context<Initialize>,
    platform_fee_bps: u64,
    dispute_fee_bps: u64,
    backend_authority: Pubkey,
) -> Result<()> {
    // NO ACCESS CONTROL - First caller becomes admin!
    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();  // Whoever calls this first
    // ...
}
```

**Status**: ❌ NOT FIXED

---

### C-02: Backend Authority Single Point of Failure (CRITICAL)

**Location**: `lib.rs:L925-959`

```rust
pub fn verify_uploads(...) -> Result<()> {
    require!(
        ctx.accounts.backend_authority.key() == ctx.accounts.config.backend_authority,
        AppMarketError::NotBackendAuthority
    );
    // No timeout fallback - transactions stuck forever if key lost
}
```

**Status**: ❌ NOT FIXED

---

### H-02: No Timelock on Dispute Resolution (HIGH)

**Location**: `lib.rs:L1659-1885`

```rust
pub fn resolve_dispute(...) -> Result<()> {
    require!(ctx.accounts.admin.key() == ctx.accounts.config.admin, ...);
    // Executes IMMEDIATELY - no timelock unlike treasury/admin changes
}
```

**Status**: ❌ NOT FIXED

---

## Access Control Matrix

| Function | Anyone | Seller | Buyer | Admin | Backend | Timelock |
|----------|--------|--------|-------|-------|---------|----------|
| initialize | ✅ | - | - | - | - | ❌ |
| create_listing | ✅ | - | - | - | - | - |
| place_bid | ✅ | ❌ | - | - | - | - |
| buy_now | ✅ | ❌ | - | - | - | - |
| make_offer | ✅ | ❌ | - | - | - | - |
| accept_offer | - | ✅ | - | - | - | - |
| settle_auction | ✅ | ✅ | ✅ | ✅ | - | - |
| cancel_auction | - | ✅ | - | - | - | - |
| cancel_listing | - | ✅ | - | - | - | - |
| seller_confirm_transfer | - | ✅ | - | - | - | - |
| finalize_transaction | - | ✅ | - | - | - | - |
| confirm_receipt | - | - | ✅ | - | - | - |
| emergency_refund | - | - | ✅ | - | - | - |
| cancel_offer | - | - | ✅ | - | - | - |
| expire_offer | - | - | ✅ | - | - | - |
| withdraw_funds | - | - | ✅ | - | - | - |
| open_dispute | - | ✅ | ✅ | - | - | - |
| propose_treasury_change | - | - | - | ✅ | - | - |
| execute_treasury_change | - | - | - | ✅ | - | ✅ 48hr |
| propose_admin_change | - | - | - | ✅ | - | - |
| execute_admin_change | - | - | - | ✅ | - | ✅ 48hr |
| set_paused | - | - | - | ✅ | - | ❌ |
| resolve_dispute | - | - | - | ✅ | - | ❌ |
| verify_uploads | - | - | - | - | ✅ | - |

---

## Files Analyzed

- `programs/app-market/src/lib.rs` (28 state-changing entry points)

---

## Changes From Previous Analysis

| Change | Impact |
|--------|--------|
| Added DoS protection constants | MAX_BIDS_PER_LISTING, MAX_OFFERS_PER_LISTING |
| Added consecutive offer tracking | Prevents single buyer spam |
| expire_offer restricted to buyer | Previously anyone could call |
| Manual PDA creation in place_bid | More complex but gas-efficient |

---

## Recommendations

1. **C-01**: Add hardcoded expected admin check to `initialize`
2. **C-02**: Add timeout fallback for backend verification
3. **H-02**: Add timelock to `resolve_dispute` like treasury/admin changes
4. Consider multi-sig for admin operations
