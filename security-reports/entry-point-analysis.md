# Entry Point Analysis: App Market Escrow

**Analyzed**: 2026-01-16
**Scope**: `programs/app-market/src/lib.rs`
**Languages**: Solana (Anchor Framework)
**Focus**: State-changing functions only (view/pure excluded)

## Summary

| Category | Count |
|----------|-------|
| Public (Unrestricted) | 10 |
| Role-Restricted (Admin) | 7 |
| Role-Restricted (Backend) | 1 |
| Participant-Restricted (Seller) | 5 |
| Participant-Restricted (Buyer) | 3 |
| Participant-Restricted (Buyer/Seller) | 1 |
| **Total** | **27** |

---

## Public Entry Points (Unrestricted)

State-changing functions callable by anyone—prioritize for attack surface analysis.

| Function | File | Notes |
|----------|------|-------|
| `create_listing(salt, listing_type, starting_price, reserve_price, buy_now_price, duration_seconds, requires_github, required_github_username)` | `lib.rs:L234` | Creates listing + escrow atomically. Requires pause check. |
| `place_bid(amount)` | `lib.rs:L344` | Places bid on auction. Has DoS protections (MAX_BIDS_PER_LISTING). |
| `withdraw_funds()` | `lib.rs:L543` | Pull pattern for refunds. Validates withdrawal ownership. |
| `buy_now()` | `lib.rs:L597` | Instant purchase at buy_now_price. Creates transaction record. |
| `settle_auction()` | `lib.rs:L738` | Settles ended auction. Allows seller, winner, or admin. |
| `expire_listing()` | `lib.rs:L864` | Expires listing past deadline. No bids required. |
| `make_offer(amount, deadline, offer_seed)` | `lib.rs:L1204` | Creates offer with escrowed funds. DoS protections exist. |
| `cancel_offer()` | `lib.rs:L1310` | Offer owner cancels and gets refund. |
| `expire_offer()` | `lib.rs:L1376` | Only offer buyer can expire. |
| `accept_offer()` | `lib.rs:L1446` | Only seller can accept. |

---

## Role-Restricted Entry Points

### Admin

Functions restricted to the marketplace admin with `config.admin` check.

| Function | File | Restriction |
|----------|------|-------------|
| `initialize(platform_fee_bps, dispute_fee_bps, backend_authority)` | `lib.rs:L71` | First caller becomes admin (one-time setup) |
| `propose_treasury_change(new_treasury)` | `lib.rs:L105` | `ctx.accounts.admin.key() == ctx.accounts.config.admin` |
| `execute_treasury_change()` | `lib.rs:L128` | `ctx.accounts.admin.key() == ctx.accounts.config.admin` + 48hr timelock |
| `propose_admin_change(new_admin)` | `lib.rs:L161` | `ctx.accounts.admin.key() == ctx.accounts.config.admin` |
| `execute_admin_change()` | `lib.rs:L184` | `ctx.accounts.admin.key() == ctx.accounts.config.admin` + 48hr timelock |
| `set_paused(paused)` | `lib.rs:L217` | `ctx.accounts.admin.key() == ctx.accounts.config.admin` |
| `resolve_dispute(resolution, notes)` | `lib.rs:L1658` | `ctx.accounts.admin.key() == ctx.accounts.config.admin` |

### Backend Authority

| Function | File | Restriction |
|----------|------|-------------|
| `verify_uploads(verification_hash)` | `lib.rs:L924` | `ctx.accounts.backend_authority.key() == ctx.accounts.config.backend_authority` |

---

## Participant-Restricted Entry Points

### Seller-Only

| Function | File | Restriction |
|----------|------|-------------|
| `seller_confirm_transfer()` | `lib.rs:L893` | `ctx.accounts.seller.key() == transaction.seller` |
| `finalize_transaction()` | `lib.rs:L961` | `ctx.accounts.seller.key() == transaction.seller` + 7 day grace period |
| `cancel_listing()` | `lib.rs:L1973` | `ctx.accounts.seller.key() == listing.seller` |
| `cancel_auction()` | `lib.rs:L819` | `ctx.accounts.seller.key() == listing.seller` + no bids |
| `accept_offer()` | `lib.rs:L1446` | `ctx.accounts.seller.key() == listing.seller` |

### Buyer-Only

| Function | File | Restriction |
|----------|------|-------------|
| `confirm_receipt()` | `lib.rs:L1090` | `ctx.accounts.buyer.key() == transaction.buyer` |
| `emergency_refund()` | `lib.rs:L1887` | `ctx.accounts.buyer.key() == transaction.buyer` + deadline passed + seller not confirmed |
| `expire_offer()` | `lib.rs:L1376` | `ctx.accounts.caller.key() == offer.buyer` |

### Buyer or Seller (Transaction Party)

| Function | File | Restriction |
|----------|------|-------------|
| `open_dispute(reason)` | `lib.rs:L1584` | `initiator == transaction.buyer OR initiator == transaction.seller` |

---

## Restricted (Review Required)

Functions with access control patterns that need manual verification.

| Function | File | Pattern | Why Review |
|----------|------|---------|------------|
| `initialize()` | `lib.rs:L71` | First caller becomes admin | **CRITICAL**: No access control - first caller sets all admin keys |
| `settle_auction()` | `lib.rs:L738` | `is_seller OR is_winner OR is_admin` | Multiple callers allowed; verify winner validation |
| `expire_listing()` | `lib.rs:L864` | No Signer requirement on seller | `seller` is AccountInfo, not Signer - anyone can expire |
| `verify_uploads()` | `lib.rs:L924` | Backend authority | Centralized trust in backend key |

---

## Contract-Only (Internal Integration Points)

No CPI callbacks detected. All entry points are user-facing Anchor instructions.

---

## Access Control Architecture

### Timelock Pattern (48 hours)
- `propose_treasury_change` → `execute_treasury_change`
- `propose_admin_change` → `execute_admin_change`

### Pause Mechanism
Functions checking `!ctx.accounts.config.paused`:
- `create_listing`, `place_bid`, `buy_now`, `settle_auction`, `finalize_transaction`, `confirm_receipt`, `make_offer`, `accept_offer`

### Fee Locking
- Fees locked at listing creation time (`listing.platform_fee_bps`, `listing.dispute_fee_bps`)
- Prevents admin fee manipulation on active transactions

---

## Files Analyzed

- `programs/app-market/src/lib.rs` (27 state-changing entry points)

---

## Key Security Observations

1. **Initialization Risk**: `initialize()` has no access control - first caller becomes admin
2. **Centralized Backend**: `verify_uploads()` relies on trusted backend authority
3. **DoS Protections**: MAX_BIDS_PER_LISTING (1000), MAX_OFFERS_PER_LISTING (100), MAX_CONSECUTIVE_OFFERS (10)
4. **Pull Pattern**: Uses withdrawal pattern for bid refunds (prevents reentrancy)
5. **Math Safety**: Uses `checked_*` operations and `saturating_add` for stats
