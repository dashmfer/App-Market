# Entry Point Analysis: App Market Escrow Program

**Analyzed**: 2026-03-01
**Scope**: `programs/app-market/src/lib.rs` (3,876 lines)
**Languages**: Rust (Anchor Framework 0.29.0 for Solana)
**Program ID**: `9udUgupraga6dj92zfLec8bAdXUZsU3FGNN3Lf8XGzog`
**Focus**: State-changing functions only (view/pure excluded)

## Summary

| Category | Count |
|----------|-------|
| Public (Unrestricted) | 3 |
| Role-Restricted (Buyer/Seller/Party) | 18 |
| Admin | 9 |
| Backend Authority | 1 |
| **Total** | **31** |

---

## Public Entry Points (Unrestricted)

State-changing functions callable by **anyone** — prioritize for attack surface analysis.

| Function | File | Notes |
|----------|------|-------|
| `expire_withdrawal()` | `lib.rs:700` | Permissionless cleanup — refunds expired withdrawal to original user. Anyone can call after `expires_at` passes. |
| `close_escrow()` | `lib.rs:757` | Permissionless cleanup — closes escrow PDA after terminal state (Completed/Refunded) and `amount == 0`. Caller receives rent as incentive. |
| `expire_listing()` | `lib.rs:1075` | Permissionless — marks listing as Ended after `end_time` passes with no bids. Escrow rent returns to seller. |

---

## Role-Restricted Entry Points

### Seller

| Function | File | Restriction | Notes |
|----------|------|-------------|-------|
| `create_listing(salt, listing_type, starting_price, reserve_price, buy_now_price, duration_seconds, requires_github, required_github_username, payment_mint)` | `lib.rs:269` | `seller: Signer` | Creates listing + escrow atomically. Paused check. Seller pays rent. |
| `cancel_auction()` | `lib.rs:1028` | `seller.key() == listing.seller` | Only if no bids received. Closes escrow, returns rent. |
| `seller_confirm_transfer()` | `lib.rs:1106` | `seller.key() == transaction.seller` | Marks transfer as confirmed on-chain. |
| `finalize_transaction()` | `lib.rs:1266` | `seller.key() == transaction.seller` + `seller.is_signer` | After 7-day grace period + upload verification. Transfers platform fee to treasury, proceeds to seller. |
| `accept_offer()` | `lib.rs:1771` | `seller.key() == listing.seller` | Accepts offer, moves funds from offer escrow to listing escrow, creates transaction. |
| `cancel_listing()` | `lib.rs:2461` | `seller.key() == listing.seller` | Only if no bids. Closes escrow. |

### Buyer

| Function | File | Restriction | Notes |
|----------|------|-------------|-------|
| `place_bid(amount)` | `lib.rs:411` | `bidder: Signer`, `bidder != listing.seller` | Bids on auction. Creates withdrawal PDA for previous bidder. Anti-sniping. |
| `buy_now()` | `lib.rs:779` | `buyer: Signer`, `buyer != listing.seller` | Instant purchase at buy_now_price. SOL-only (APP token path blocked). |
| `confirm_receipt()` | `lib.rs:1397` | `buyer.key() == transaction.buyer` | Releases escrow to seller + treasury. Requires upload verification. |
| `make_offer(amount, deadline, offer_seed)` | `lib.rs:1511` | `buyer: Signer`, `buyer != listing.seller` | Creates offer with separate escrow PDA. |
| `cancel_offer()` | `lib.rs:1622` | `buyer.key() == offer.buyer` | Cancels active offer, refunds from offer escrow. |
| `expire_offer()` | `lib.rs:1695` | `caller.key() == offer.buyer` | Expires offer after deadline, refunds buyer. |
| `emergency_refund()` | `lib.rs:2375` | `buyer.key() == transaction.buyer` | After transfer deadline, only if seller never confirmed. Full refund. |
| `emergency_auto_verify()` | `lib.rs:1175` | `buyer.key() == transaction.buyer` | After 30-day backend timeout. Sets verification hash to "EMERGENCY_BUYER_TIMEOUT". |
| `withdraw_funds()` | `lib.rs:644` | `user.key() == withdrawal.user` | Outbid user claims refund from withdrawal PDA. |

### Buyer or Seller (Transaction Parties)

| Function | File | Restriction | Notes |
|----------|------|-------------|-------|
| `open_dispute(reason)` | `lib.rs:1952` | `initiator == transaction.buyer \|\| initiator == transaction.seller` | Opens dispute, charges dispute fee (locked from listing creation). Within 7-day grace period. |
| `contest_dispute_resolution()` | `lib.rs:2094` | `caller == transaction.buyer \|\| caller == transaction.seller` | Within 48hr timelock window. Can only contest once. |

### Seller, Winner, or Admin

| Function | File | Restriction | Notes |
|----------|------|-------------|-------|
| `settle_auction()` | `lib.rs:940` | `payer == listing.seller \|\| payer == current_bidder \|\| payer == config.admin` | After auction ends. Validates bidder account matches `listing.current_bidder`. Creates transaction. |

---

## Admin Entry Points

### Initialization (Hardcoded Admin)

| Function | File | Restriction | Notes |
|----------|------|-------------|-------|
| `initialize(platform_fee_bps, dispute_fee_bps, backend_authority)` | `lib.rs:90` | `admin.key() == EXPECTED_ADMIN` (hardcoded: `63jQ3q...`) | One-time setup. Validates fee bounds (platform ≤ 10%, dispute ≤ 5%). |

### Admin (config.admin)

| Function | File | Restriction | Notes |
|----------|------|-------------|-------|
| `propose_treasury_change(new_treasury)` | `lib.rs:140` | `admin.key() == config.admin` | Step 1 of 48hr timelock. |
| `execute_treasury_change()` | `lib.rs:163` | `admin.key() == config.admin` | Step 2 after 48hr timelock. |
| `propose_admin_change(new_admin)` | `lib.rs:196` | `admin.key() == config.admin` | Step 1 of 48hr timelock. |
| `execute_admin_change()` | `lib.rs:219` | `admin.key() == config.admin` | Step 2 after 48hr timelock. |
| `set_paused(paused)` | `lib.rs:252` | `admin.key() == config.admin` | Emergency pause. **No timelock** (by design for emergencies). |
| `propose_dispute_resolution(resolution, notes)` | `lib.rs:2040` | `admin.key() == config.admin` | Proposes FullRefund / ReleaseToSeller / PartialRefund. Starts 48hr contest window. |
| `execute_dispute_resolution()` | `lib.rs:2138` | `caller.key() == config.admin` | After 48hr timelock, only if not contested. Distributes escrow + dispute fee. |
| `admin_emergency_verify()` | `lib.rs:1221` | `admin.key() == config.admin` | After 30-day backend timeout. Sets hash to "EMERGENCY_ADMIN_OVERRIDE". |

---

## Backend Authority Entry Points

| Function | File | Restriction | Notes |
|----------|------|-------------|-------|
| `verify_uploads(verification_hash)` | `lib.rs:1137` | `backend_authority.key() == config.backend_authority` | Marks uploads as verified. Required before buyer can confirm receipt or seller can finalize. |

---

## Restricted (Review Required)

Functions with access control patterns that need manual verification.

| Function | File | Pattern | Why Review |
|----------|------|---------|------------|
| `settle_auction()` | `lib.rs:940` | `is_seller \|\| is_winner \|\| is_admin` | Three-party settlement — verify no edge case where unauthorized caller can satisfy one condition |
| `expire_withdrawal()` | `lib.rs:700` | Permissionless, sends to `recipient` validated against `pending_withdrawal.user` | Verify `recipient` cannot be spoofed (constraint in account struct validates) |
| `close_escrow()` | `lib.rs:757` | Permissionless, `seller` receives rent | `CloseEscrow` struct has `listing.seller == seller.key()` constraint — verify correctness |
| `expire_listing()` | `lib.rs:1075` | No Signer required for caller | `seller` is `AccountInfo` (not Signer) — rent goes to seller via escrow close. Verify no griefing |
| `place_bid()` / `buy_now()` / `accept_offer()` | `lib.rs:411,779,1771` | `pending_withdrawal: UncheckedAccount` | Manual PDA derivation + initialization. Verify no account confusion attacks on UncheckedAccount |

---

## PDA Seed Map (Trust Boundaries)

| Account | Seeds | Authority |
|---------|-------|-----------|
| `MarketConfig` | `["config"]` | Admin |
| `Listing` | `["listing", seller, salt]` | Seller |
| `Escrow` | `["escrow", listing]` | Program (PDA signer) |
| `Transaction` | `["transaction", listing]` | Program |
| `PendingWithdrawal` | `["withdrawal", listing, withdrawal_count]` | Program |
| `Offer` | `["offer", listing, buyer, offer_seed]` | Buyer |
| `OfferEscrow` | `["offer_escrow", offer]` | Program (PDA signer) |
| `Dispute` | `["dispute", transaction]` | Initiator + Admin |

---

## Key Constants (Security-Relevant)

| Constant | Value | Purpose |
|----------|-------|---------|
| `PLATFORM_FEE_BPS` | 500 (5%) | Default platform fee |
| `APP_FEE_BPS` | 300 (3%) | Discounted fee for $APP token |
| `MAX_PLATFORM_FEE_BPS` | 1000 (10%) | Fee cap |
| `MAX_DISPUTE_FEE_BPS` | 500 (5%) | Dispute fee cap |
| `TRANSFER_DEADLINE_SECONDS` | 7 days | Emergency refund deadline |
| `ADMIN_TIMELOCK_SECONDS` | 48 hours | Admin operations timelock |
| `FINALIZE_GRACE_PERIOD` | 7 days | Grace period before finalize |
| `ANTI_SNIPE_WINDOW` | 15 minutes | Anti-sniping threshold |
| `ANTI_SNIPE_EXTENSION` | 15 minutes | Auction extension on snipe |
| `MAX_BIDS_PER_LISTING` | 1000 | DoS prevention |
| `MAX_OFFERS_PER_LISTING` | 100 | DoS prevention |
| `MAX_CONSECUTIVE_BIDS` | 10 | Anti-spam per bidder |
| `BACKEND_TIMEOUT_SECONDS` | 30 days | Backend unresponsive fallback |
| `DISPUTE_RESOLUTION_TIMELOCK_SECONDS` | 48 hours | Contest window |
| `EXPECTED_ADMIN` | `63jQ3q...` | Hardcoded initialization guard |

---

## Files Analyzed

- `programs/app-market/src/lib.rs` (31 state-changing entry points, 3,876 lines)
