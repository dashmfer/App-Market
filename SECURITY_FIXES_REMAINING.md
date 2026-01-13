# Remaining Security Fixes - Implementation Notes

## ✅ Completed Fixes

1. ✅ Changed FINALIZE_GRACE_PERIOD from 72h to 7 days
2. ✅ Added `backend_authority` to MarketConfig
3. ✅ Added `requires_github` and `required_github_username` to Listing
4. ✅ Added `withdrawal_count` to Listing
5. ✅ Added `uploads_verified`, `verification_timestamp`, `verification_hash` to Transaction
6. ✅ Added `withdrawal_id` to PendingWithdrawal struct
7. ✅ Reject bids below reserve in place_bid
8. ✅ Removed "reserve not met" logic from settle_auction
9. ✅ Added `verify_uploads` instruction
10. ✅ Updated `finalize_transaction` (seller only, 7 days, uploads verified, dispute blocked)
11. ✅ Fixed offer accept to store old_bid before updating
12. ✅ Renamed `claim_expired_offer` to `expire_offer` (anyone can call)
13. ✅ Added `offer_seed` parameter to `make_offer`

## 🔴 CRITICAL - Must Fix Before Deployment

### 1. PendingWithdrawal PDA Seeds (CRITICAL)

**Problem:** Current seeds use `[b"withdrawal", listing.key(), user.key()]` which causes collision when same user gets multiple withdrawals.

**Current Code (BROKEN):**
```rust
#[account(
    init,
    payer = bidder,
    space = 8 + PendingWithdrawal::INIT_SPACE,
    seeds = [
        b"withdrawal",
        listing.key().as_ref(),
        listing.current_bidder.unwrap_or(system_program::ID).as_ref()  // ❌ COLLIDES
    ],
    bump
)]
pub pending_withdrawal: Account<'info, PendingWithdrawal>,
```

**Solution:** Use withdrawal_id in seeds

**Locations to Fix:**
- PlaceBid context (line ~1810)
- AcceptOffer context (needs to be found)
- SettleAuction context (needs to be found)
- WithdrawFunds context (line ~1840) - This one is OK, but needs withdrawal_id added

**Implementation:**
```rust
// Add instruction parameter
#[derive(Accounts)]
#[instruction(amount: u64, next_withdrawal_id: u64)]  // ADD THIS
pub struct PlaceBid<'info> {
    #[account(
        init,
        payer = bidder,
        space = 8 + PendingWithdrawal::INIT_SPACE,
        seeds = [
            b"withdrawal",
            listing.key().as_ref(),
            &next_withdrawal_id.to_le_bytes()  // FIX: Use withdrawal_id
        ],
        bump
    )]
    pub pending_withdrawal: Account<'info, PendingWithdrawal>,
    // ...
}

// In instruction
pub fn place_bid(ctx: Context<PlaceBid>, amount: u64, next_withdrawal_id: u64) -> Result<()> {
    // Validate next_withdrawal_id matches listing.withdrawal_count + 1
    require!(
        next_withdrawal_id == ctx.accounts.listing.withdrawal_count + 1,
        AppMarketError::InvalidWithdrawalId
    );
    // ... rest of logic
}
```

**Frontend Must:**
1. Read `listing.withdrawal_count`
2. Calculate `next_withdrawal_id = listing.withdrawal_count + 1`
3. Pass it to `place_bid(amount, next_withdrawal_id)`

### 2. Offer PDA Seeds in MakeOffer Context

**Problem:** Context still uses Clock::get() in seeds (non-deterministic)

**Current Code (BROKEN):**
```rust
seeds = [b"offer", listing.key(), buyer.key(), &Clock::get()?.unix_timestamp.to_le_bytes()]
```

**Solution:** Already added `offer_seed` parameter to instruction, NOW must update the context:

```rust
#[derive(Accounts)]
#[instruction(amount: u64, deadline: i64, offer_seed: u64)]  // ADD THIS
pub struct MakeOffer<'info> {
    #[account(
        init,
        payer = buyer,
        space = 8 + Offer::INIT_SPACE,
        seeds = [
            b"offer",
            listing.key().as_ref(),
            buyer.key().as_ref(),
            &offer_seed.to_le_bytes()  // FIX: Use parameter, not Clock::get()
        ],
        bump
    )]
    pub offer: Account<'info, Offer>,
    // ...
}
```

### 3. Account Closure Rent Theft

**Problem:** Some contexts use unchecked AccountInfo for seller/buyer in `close = seller` constraints.

**Locations to Check:**
- ConfirmReceipt context
- Any context with `close = seller` or `close = buyer`

**Solution:** Either:
- Option A: Use `close = transaction.seller` (validated Pubkey from account)
- Option B: Add constraint `constraint = seller.key() == transaction.seller`

## 🟡 Important - Add Before Testing

### 4. Add VerifyUploads Account Context

```rust
#[derive(Accounts)]
pub struct VerifyUploads<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, MarketConfig>,

    #[account(mut)]
    pub transaction: Account<'info, Transaction>,

    /// Backend authority that verifies uploads
    pub backend_authority: Signer<'info>,
}
```

### 5. Rename ClaimExpiredOffer Context to ExpireOffer

```rust
// OLD: ClaimExpiredOffer
// NEW: ExpireOffer

#[derive(Accounts)]
pub struct ExpireOffer<'info> {
    #[account(mut)]
    pub offer: Account<'info, Offer>,

    #[account(
        mut,
        seeds = [b"offer_escrow", offer.key().as_ref()],
        bump = offer_escrow.bump
    )]
    pub offer_escrow: Account<'info, OfferEscrow>,

    pub listing: Account<'info, Listing>,

    /// Buyer receives refund (from offer.buyer, not caller)
    #[account(
        mut,
        constraint = buyer.key() == offer.buyer @ AppMarketError::InvalidBuyer
    )]
    pub buyer: SystemAccount<'info>,

    /// Caller pays gas (can be anyone)
    #[account(mut)]
    pub caller: Signer<'info>,

    pub system_program: Program<'info, System>,
}
```

### 6. Add New Error Codes

```rust
#[error_code]
pub enum AppMarketError {
    // ... existing errors

    // NEW ERRORS
    #[msg("Uploads not verified")]
    UploadsNotVerified,

    #[msg("Uploads already verified")]
    AlreadyVerified,

    #[msg("Not backend authority")]
    NotBackendAuthority,

    #[msg("Offer not expired")]
    OfferNotExpired,

    #[msg("Bid below reserve price")]
    BidBelowReserve,

    #[msg("Cannot finalize disputed transaction")]
    CannotFinalizeDisputed,

    #[msg("Seller must sign")]
    SellerMustSign,

    #[msg("Invalid withdrawal ID")]
    InvalidWithdrawalId,
}
```

### 7. Update WithdrawalCreated Event

```rust
#[event]
pub struct WithdrawalCreated {
    pub user: Pubkey,
    pub listing: Pubkey,
    pub amount: u64,
    pub withdrawal_id: u64,  // ADD THIS
    pub timestamp: i64,
}
```

### 8. Add UploadsVerified Event

```rust
#[event]
pub struct UploadsVerified {
    pub transaction: Pubkey,
    pub verification_hash: String,
    pub timestamp: i64,
}
```

## 📋 Testing Checklist

Before deployment:

- [ ] Test withdrawal PDA collision scenario (multiple withdrawals same user)
- [ ] Test offer creation with deterministic seeds
- [ ] Test finalize_transaction with all checks (seller only, 7 days, uploads verified, not disputed)
- [ ] Test reject bids below reserve
- [ ] Test verify_uploads with backend authority
- [ ] Test expire_offer (anyone can call, refund goes to buyer)
- [ ] Test account closure rent goes to correct recipient
- [ ] Test offer accept with correct withdrawal amount

## 🚀 Deployment Steps

1. Fix all CRITICAL items (#1, #2, #3)
2. Add all contexts and error codes (#4-8)
3. Run anchor build
4. Run tests
5. Deploy to devnet
6. Test all flows on devnet
7. Get external audit
8. Deploy to mainnet

---

**Last Updated:** 2026-01-13
**Status:** IN PROGRESS - Critical PDA fixes needed
