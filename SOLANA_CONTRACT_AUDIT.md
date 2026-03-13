# Solana Smart Contract Security Audit Report

## App Market - Anchor Program

**Program ID:** `9udUgupraga6dj92zfLec8bAdXUZsU3FGNN3Lf8XGzog`
**Anchor Version:** 0.29.0
**Audit Date:** January 31, 2026
**Auditor:** Claude Opus 4.5 (Automated Security Analysis)

---

## Executive Summary

The App Market Solana program is a marketplace escrow system built using the Anchor framework. The contract handles secure escrow for digital asset transactions including auctions, buy-now purchases, and offer-based sales. Overall, the contract demonstrates good security practices with proper use of PDAs, checked arithmetic, and access controls. However, several findings ranging from informational to medium severity were identified.

### Risk Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 1 |
| Medium | 4 |
| Low | 5 |
| Informational | 8 |

---

## Detailed Findings

### HIGH SEVERITY

#### H-1: Unchecked Account in PlaceBid - Potential PDA Seed Grinding

**Location:** `PlaceBid` struct (line 2379-2405) and `place_bid` function (line 408-637)

**Description:**
The `pending_withdrawal` account in the `PlaceBid` instruction is marked as `UncheckedAccount`. While the code manually verifies the PDA derivation using `Pubkey::find_program_address`, the account is created via a raw `create_account` CPI call without Anchor's type-safe account initialization.

```rust
/// CHECK: Only created if there's a previous bidder to refund
#[account(mut)]
pub pending_withdrawal: UncheckedAccount<'info>,
```

The manual serialization at line 607-617 bypasses Anchor's discriminator mechanism:
```rust
let mut withdrawal_data = ctx.accounts.pending_withdrawal.try_borrow_mut_data()?;
let withdrawal = PendingWithdrawal {
    user: previous_bidder,
    listing: listing.key(),
    amount: old_bid,
    withdrawal_id: listing.withdrawal_count,
    created_at: clock.unix_timestamp,
    bump,
};
withdrawal.try_serialize(&mut &mut withdrawal_data[..])?;
```

**Impact:**
Without the 8-byte Anchor discriminator prefix, the account could potentially be confused with other account types in cross-instruction scenarios. An attacker might be able to supply a pre-initialized account with matching first bytes.

**Recommendation:**
Use Anchor's `init_if_needed` with proper constraints, or ensure the 8-byte discriminator is written before the account data. Alternatively, use a separate instruction for withdrawal creation.

---

### MEDIUM SEVERITY

#### M-1: Missing Account Ownership Check in SettleAuction

**Location:** `SettleAuction` struct (line 2476-2507)

**Description:**
The `bidder` field in SettleAuction is an `AccountInfo` with no constraints:

```rust
/// CHECK: Current bidder (validated in instruction)
#[account(mut)]
pub bidder: AccountInfo<'info>,
```

While the instruction validates that `listing.current_bidder.is_some()`, there is no constraint ensuring the `bidder` account passed matches `listing.current_bidder`. This could allow an attacker to pass any account as the bidder.

**Impact:**
The `bidder` account info is not used for fund transfers in this instruction, so direct fund theft is not possible. However, this is poor hygiene and could lead to issues if the code is modified.

**Recommendation:**
Add a constraint to verify the bidder matches the listing's current bidder:
```rust
#[account(
    mut,
    constraint = Some(bidder.key()) == listing.current_bidder @ AppMarketError::InvalidBidder
)]
pub bidder: AccountInfo<'info>,
```

---

#### M-2: BuyNow Withdrawal PDA Seed Mismatch

**Location:** `buy_now` function (line 739-756)

**Description:**
In the `buy_now` function, when creating a withdrawal for a previous bidder, the PDA seeds use `previous_bidder.as_ref()`:

```rust
let withdrawal_seeds = &[
    b"withdrawal",
    listing_key.as_ref(),
    previous_bidder.as_ref(),  // Uses bidder pubkey
];
```

However, in `place_bid`, the withdrawal PDA seeds use `withdrawal_count`:

```rust
let withdrawal_seeds = &[
    b"withdrawal",
    listing_key.as_ref(),
    &withdrawal_count_bytes,  // Uses counter
];
```

This inconsistency means withdrawals created via `buy_now` use different seeds than those created via `place_bid`, potentially causing PDA derivation mismatches.

**Impact:**
Withdrawals created during a `buy_now` transaction may fail the PDA verification in `withdraw_funds` since it expects the counter-based seed structure.

**Recommendation:**
Ensure consistent PDA seed generation across all withdrawal creation paths using the `withdrawal_count` approach.

---

#### M-3: AcceptOffer Always Creates Withdrawal Account

**Location:** `AcceptOffer` struct (line 2776-2834)

**Description:**
The `AcceptOffer` struct unconditionally initializes a `pending_withdrawal` account:

```rust
#[account(
    init,
    payer = seller,
    space = 8 + PendingWithdrawal::INIT_SPACE,
    seeds = [
        b"withdrawal",
        listing.key().as_ref(),
        &(listing.withdrawal_count + 1).to_le_bytes()
    ],
    bump
)]
pub pending_withdrawal: Account<'info, PendingWithdrawal>,
```

However, the instruction logic only uses this withdrawal account if there's a previous bidder AND the bidder is not the offer buyer:

```rust
if let Some(previous_bidder) = old_bidder {
    if previous_bidder != offer.buyer && old_bid > 0 {
        // ... uses pending_withdrawal
    }
}
```

**Impact:**
If there's no previous bidder, or the previous bidder is the same as the offer buyer, rent is wasted on an unused withdrawal account that will persist until manually closed.

**Recommendation:**
Use conditional account initialization or refactor to only create withdrawal accounts when needed.

---

#### M-4: Dispute Resolution Can Drain Funds from Pending Withdrawals

**Location:** `execute_dispute_resolution` (line 2009-2041)

**Description:**
The dispute resolution execution validates escrow balance but does not check if the `escrow.amount` tracker matches the sale price. Unlike `confirm_receipt` and `finalize_transaction` which verify:

```rust
// SECURITY: Check no pending withdrawals before closing escrow
require!(
    ctx.accounts.escrow.amount == required_balance,
    AppMarketError::PendingWithdrawalsExist
);
```

The `execute_dispute_resolution` only checks:
```rust
require!(
    escrow_balance >= sale_price + rent,
    AppMarketError::InsufficientEscrowBalance
);
```

**Impact:**
If there are pending withdrawals in the escrow, a dispute resolution could transfer funds that are owed to previous bidders, effectively draining their withdrawal entitlements.

**Recommendation:**
Add the `PendingWithdrawalsExist` check to dispute resolution to ensure all pending withdrawals are claimed before dispute resolution can drain the escrow.

---

### LOW SEVERITY

#### L-1: No Upper Bound Validation on offer_seed

**Location:** `make_offer` function (line 1458-1462)

**Description:**
While `offer_seed` is validated to match `listing.offer_count`, there's no upper bound check. The counter could theoretically overflow (though `MAX_OFFERS_PER_LISTING = 100` makes this very unlikely).

```rust
require!(
    offer_seed == listing.offer_count,
    AppMarketError::InvalidOfferSeed
);
```

**Impact:**
Minimal - the 100 offer limit prevents this from being exploitable.

**Recommendation:**
Consider using `u32` for offer counters to save space while maintaining sufficient capacity.

---

#### L-2: Seller Can Confirm Transfer Without Actually Transferring

**Location:** `seller_confirm_transfer` (line 993-1021)

**Description:**
The `seller_confirm_transfer` function only updates an on-chain flag and emits an event. There's no verification that any actual asset transfer occurred:

```rust
pub fn seller_confirm_transfer(ctx: Context<SellerConfirmTransfer>) -> Result<()> {
    // Only checks status and that caller is seller
    transaction.seller_confirmed_transfer = true;
    transaction.seller_confirmed_at = Some(clock.unix_timestamp);
    // ...
}
```

**Impact:**
A malicious seller can confirm transfer without actually delivering assets. This is mitigated by:
1. The 7-day grace period before finalization
2. The dispute mechanism for buyers
3. The upload verification by backend

**Recommendation:**
This is a known limitation of off-chain asset escrow. The existing mitigations (grace period + disputes + backend verification) are appropriate. Documentation should clearly explain this flow to users.

---

#### L-3: Saturating Add for Statistics May Hide Overflows

**Location:** `finalize_transaction` (line 1264-1267) and `confirm_receipt` (line 1378-1381)

**Description:**
Statistics tracking uses `saturating_add`:

```rust
config.total_volume = config.total_volume.saturating_add(transaction.sale_price);
config.total_sales = config.total_sales.saturating_add(1);
```

**Impact:**
If the maximum u64 value is reached, statistics will silently stop incrementing rather than reverting. While this prevents DoS, it could lead to inaccurate statistics.

**Recommendation:**
This is an acceptable tradeoff. Consider emitting an event if saturation occurs for monitoring purposes.

---

#### L-4: Emergency Auto-Verify Allows Buyer to Skip Verification

**Location:** `emergency_auto_verify` (line 1062-1104)

**Description:**
After 30 days from seller confirmation, a buyer can trigger emergency verification:

```rust
transaction.uploads_verified = true;
transaction.verification_hash = "EMERGENCY_BUYER_TIMEOUT".to_string();
```

**Impact:**
This is a safety valve for unresponsive backends but could be abused if a buyer wants to skip verification intentionally.

**Recommendation:**
The 30-day timeout is appropriately long to discourage abuse. Consider requiring the buyer to have NOT received the assets (though this is difficult to verify on-chain).

---

#### L-5: ExpireListing Seller Account Not Validated as Signer

**Location:** `ExpireListing` struct (line 2529-2547)

**Description:**
The `seller` account in `ExpireListing` is marked as `AccountInfo` and only validated via constraint, not as a signer:

```rust
/// CHECK: Seller receives rent
#[account(mut)]
pub seller: AccountInfo<'info>,
```

The constraint only validates the address matches:
```rust
constraint = listing.seller == seller.key() @ AppMarketError::NotSeller
```

**Impact:**
Anyone can call `expire_listing` and the rent will go to the seller. This is actually benign since it only allows third parties to help expire listings.

**Recommendation:**
This is acceptable design - it allows bots to clean up expired listings. Document this as intentional behavior.

---

### INFORMATIONAL

#### I-1: Hardcoded Admin Address

**Location:** Line 83

```rust
pub const EXPECTED_ADMIN: Pubkey = solana_program::pubkey!("63jQ3qffMgacpUw8ebDZPuyUHf7DsfsYnQ7sk8fmFaF1");
```

**Note:** This is good practice to prevent initialization frontrunning. Ensure this address is securely controlled.

---

#### I-2: APP Token Fee Discount Implementation

**Location:** Lines 364-368

```rust
listing.platform_fee_bps = if payment_mint == Some(APP_TOKEN_MINT) {
    APP_FEE_BPS
} else {
    ctx.accounts.config.platform_fee_bps
};
```

**Note:** The SPL token payment functionality appears incomplete - all actual transfers use system_program for SOL. Ensure SPL token support is implemented if this fee discount is intended to be functional.

---

#### I-3: Unused Transaction Status

**Location:** Line 3200

```rust
pub enum TransactionStatus {
    Pending,  // This variant is never used
    InEscrow,
    Completed,
    Disputed,
    Refunded,
}
```

**Note:** The `Pending` status is defined but never set. All transactions start as `InEscrow`.

---

#### I-4: Redundant Escrow Amount Tracking

**Location:** `Escrow` struct and multiple functions

**Note:** The escrow tracks `amount` separately from the actual lamport balance. While this adds safety against unexpected deposits, it also adds complexity. Ensure all fund movements update both the tracked amount and perform the actual transfer.

---

#### I-5: Inconsistent Use of checked_add vs saturating_add

**Location:** Throughout the codebase

**Note:** Some operations use `checked_add` (which returns error on overflow) while others use `saturating_add` (which caps at max). Be consistent - use checked math for financial operations and saturating math only for statistics.

---

#### I-6: Anti-Sniping Extension Not Capped

**Location:** Lines 546-550

```rust
if listing.auction_started && clock.unix_timestamp > listing.end_time - ANTI_SNIPE_WINDOW {
    listing.end_time = clock.unix_timestamp
        .checked_add(ANTI_SNIPE_EXTENSION)
        .ok_or(AppMarketError::MathOverflow)?;
}
```

**Note:** There's no cap on total extensions. A bidding war could extend an auction indefinitely. Consider adding a maximum total extension time.

---

#### I-7: Missing Input Validation on reason/notes Strings

**Location:** `open_dispute` and `propose_dispute_resolution`

**Note:** While string lengths are bounded by `#[max_len()]` in the structs, there's no validation of string content. Malicious UTF-8 sequences could be stored.

---

#### I-8: Timelock Can Be Circumvented by Contract Pause

**Location:** Admin functions

**Note:** An admin can pause the contract, preventing users from interacting during the timelock period. This is acceptable for emergencies but could be abused. Consider allowing withdrawal operations even when paused.

---

## Security Best Practices Observed

### Access Control
- Admin operations properly gated with signer checks
- Initialization protected with hardcoded expected admin
- Backend authority validation for upload verification
- Proper seller/buyer validation on sensitive operations

### Arithmetic Safety
- Consistent use of `checked_*` operations for financial calculations
- Overflow protection on all critical math operations
- Proper handling of basis points calculations

### Account Validation
- PDA seeds properly constrained with bumps stored
- Account relationships validated via constraints
- Escrow account always initialized atomically with listing

### State Management
- Two-step timelock for sensitive admin operations (48 hours)
- Proper use of status enums to track state transitions
- Withdrawal pattern prevents DoS from failed refunds

### CPI Safety
- No arbitrary CPIs - only system_program transfers
- Seeds properly constructed for PDA signing
- Signer seeds validated before CPI calls

---

## Recommendations Summary

1. **High Priority:** Fix the unchecked account initialization in PlaceBid to include proper discriminator
2. **Medium Priority:** Add bidder constraint validation in SettleAuction
3. **Medium Priority:** Fix PDA seed consistency between place_bid and buy_now withdrawals
4. **Medium Priority:** Make AcceptOffer withdrawal creation conditional
5. **Medium Priority:** Add pending withdrawal check to dispute resolution
6. **Consider:** Adding maximum auction extension cap
7. **Consider:** Allowing critical withdrawals even when paused
8. **Consider:** Implementing full SPL token support if APP token discounts are intended

---

## Conclusion

The App Market Solana program demonstrates solid security practices overall, particularly in areas of access control, arithmetic safety, and state management. The identified issues are primarily related to edge cases in the withdrawal mechanism and account constraint hygiene.

The most significant finding (H-1) relates to manual account initialization bypassing Anchor's type safety, which should be addressed before mainnet deployment. The medium severity findings are implementation inconsistencies that could lead to user experience issues or fund lockups in edge cases.

The contract's timelock mechanisms, pause functionality, and dispute resolution system provide good administrative controls for handling edge cases and emergencies.

---

*This report was generated through automated static analysis. A full audit would require manual review, formal verification, and comprehensive testing including fuzzing and integration tests.*
