# Deep Context Analysis: App Market Escrow

**Analysis Date**: 2026-01-16
**Scope**: `programs/app-market/src/lib.rs`
**Framework**: Anchor (Solana)
**Lines of Code**: ~3140

---

## Phase 1 — Initial Orientation (Bottom-Up Scan)

### 1.1 Major Modules/Structures

| Component | Purpose | Lines |
|-----------|---------|-------|
| Constants | Fee limits, timeouts, DoS protections | L23-65 |
| Instructions (27 total) | Entry points in `#[program]` module | L71-1991 |
| Account Structs (22 total) | Anchor account validation | L1998-2637 |
| State Structs (8 total) | On-chain data structures | L2651-2784 |
| Enums (6 total) | Type definitions | L2790-2833 |
| Events (16 total) | Emitted logs | L2839-3006 |
| Errors (40 total) | Custom error codes | L3012-3140 |

### 1.2 Public/External Entrypoints

**Unrestricted (highest risk)**:
- `create_listing` - Creates listing + escrow atomically
- `place_bid` - Places bids on auctions
- `buy_now` - Instant purchase
- `make_offer` - Creates offers with escrowed funds

**Role-Restricted**:
- Admin: `initialize`, `propose_*`, `execute_*`, `set_paused`, `resolve_dispute`
- Backend: `verify_uploads`
- Seller: `seller_confirm_transfer`, `finalize_transaction`, `cancel_*`, `accept_offer`
- Buyer: `confirm_receipt`, `emergency_refund`, `cancel_offer`, `expire_offer`

### 1.3 Actors & Trust Levels

| Actor | Trust Level | Capabilities |
|-------|-------------|--------------|
| Admin | Trusted (timelocked) | Config changes, dispute resolution, pause |
| Backend Authority | Trusted | Upload verification (centralized) |
| Seller | Semi-trusted | Creates listings, confirms transfers, accepts offers |
| Buyer/Bidder | Untrusted | Bids, buys, makes offers, disputes |
| Anyone | Untrusted | `expire_listing`, `settle_auction` (with restrictions) |

### 1.4 Important State Variables

**MarketConfig** (L2651-2668):
- `admin`: Pubkey - Marketplace administrator
- `treasury`: Pubkey - Fee recipient
- `backend_authority`: Pubkey - Upload verifier
- `platform_fee_bps`: u64 - Current platform fee (max 10%)
- `dispute_fee_bps`: u64 - Current dispute fee (max 5%)
- `paused`: bool - Emergency stop
- `pending_*`: Option<Pubkey> - Timelock staging

**Listing** (L2670-2703):
- `seller`, `current_bidder`: Pubkey/Option<Pubkey>
- `current_bid`, `starting_price`, `reserve_price`, `buy_now_price`: u64
- `platform_fee_bps`, `dispute_fee_bps`: u64 - **LOCKED at creation**
- `withdrawal_count`: u64 - PDA collision prevention
- `offer_count`, `consecutive_offer_count`: u64 - DoS protection

**Escrow** (L2705-2711):
- `listing`: Pubkey - Associated listing
- `amount`: u64 - **Tracked amount** (critical for withdrawal validation)

**Transaction** (L2713-2735):
- `seller`, `buyer`: Pubkey
- `sale_price`, `platform_fee`, `seller_proceeds`: u64
- `status`: TransactionStatus
- `seller_confirmed_transfer`: bool - Unlock condition
- `uploads_verified`: bool - Backend verification gate

---

## Phase 2 — Ultra-Granular Function Analysis

### 2.1 `initialize` (L71-102)

**Purpose:**
Initializes the marketplace configuration PDA. This is a one-time setup that establishes the admin, treasury, backend authority, and fee structure. **CRITICAL**: First caller becomes admin with no access control.

**Inputs & Assumptions:**
- `platform_fee_bps: u64` - Platform fee in basis points (untrusted, validated)
- `dispute_fee_bps: u64` - Dispute fee in basis points (untrusted, validated)
- `backend_authority: Pubkey` - Backend service key (trusted, no validation)
- `ctx.accounts.admin: Signer` - Becomes the admin (trusted, pays rent)
- `ctx.accounts.treasury: AccountInfo` - Fee recipient (unchecked, no validation)

**Assumptions:**
1. First caller is the legitimate deployer
2. Treasury address is correct (no validation)
3. Backend authority is a secure key
4. Config PDA seed `"config"` is unique
5. Fee bounds are sufficient (10% max platform, 5% max dispute)

**Outputs & Effects:**
- Creates `MarketConfig` account (state write)
- Sets `admin`, `treasury`, `backend_authority` (critical security fields)
- Sets `paused = false` (contract starts active)
- Emits no event (potential improvement)

**Block-by-Block Analysis:**

```rust
// L77-85: Fee validation block
require!(platform_fee_bps <= MAX_PLATFORM_FEE_BPS, AppMarketError::FeeTooHigh);
require!(dispute_fee_bps <= MAX_DISPUTE_FEE_BPS, AppMarketError::FeeTooHigh);
```
- **What**: Validates fees are within bounds (platform ≤10%, dispute ≤5%)
- **Why here**: Must validate before any state writes (fail-fast)
- **Assumptions**: `MAX_PLATFORM_FEE_BPS = 1000`, `MAX_DISPUTE_FEE_BPS = 500` are appropriate limits
- **First Principles**: Fee validation exists to prevent admin from setting extractive fees. But what about 0% fees? Both fees can be 0, which is valid but potentially unintended.

```rust
// L87-100: State initialization block
config.admin = ctx.accounts.admin.key();
config.treasury = ctx.accounts.treasury.key();
config.backend_authority = backend_authority;
config.platform_fee_bps = platform_fee_bps;
config.dispute_fee_bps = dispute_fee_bps;
config.total_volume = 0;
config.total_sales = 0;
config.paused = false;
config.pending_treasury = None;
config.pending_treasury_at = None;
config.pending_admin = None;
config.pending_admin_at = None;
config.bump = ctx.bumps.config;
```
- **What**: Initializes all config fields
- **Why here**: After validation, before returning
- **Assumptions**:
  - Signer is legitimate (no verification)
  - Treasury is valid SOL account (no verification)
  - Backend authority is secure offchain (no verification)
- **5 Whys - Why no access control on initialize?**
  1. Why no restriction? → Anchor's `init` constraint ensures PDA doesn't exist
  2. Why is that sufficient? → Only one config can ever be created (singleton)
  3. Why singleton? → Seeds are fixed `[b"config"]`
  4. Why not require specific deployer? → First-caller model is simpler
  5. Why is first-caller risky? → **Frontrunning risk on deployment**

**Invariants Established:**
1. Only one config PDA exists (enforced by Anchor `init`)
2. Fees are bounded at initialization
3. Contract starts unpaused

**Cross-Function Dependencies:**
- Every other function reads `config` for admin/treasury/backend_authority/paused/fees
- `propose_*` and `execute_*` modify config
- `resolve_dispute` reads admin from config

**Risk Analysis:**
- **CRITICAL**: No access control - deployment frontrunning possible
- Treasury receives `/// CHECK: Treasury wallet to receive fees` with no validation
- Backend authority has no validation (must trust deployer)

---

### 2.2 `place_bid` (L344-540)

**Purpose:**
Places a bid on an active auction listing. Implements the withdrawal pattern for refunds to prevent DoS. This is the primary auction interaction function handling fund transfers, state updates, and anti-sniping logic.

**Inputs & Assumptions:**
- `amount: u64` - Bid amount in lamports (untrusted, validated against reserves and increments)
- `ctx.accounts.bidder: Signer` - Bidder placing the bid (untrusted)
- `ctx.accounts.listing: Account<Listing>` - Target listing (must be active auction)
- `ctx.accounts.escrow: Account<Escrow>` - Listing's escrow (pre-existing)
- `ctx.accounts.pending_withdrawal: UncheckedAccount` - For previous bidder refund (conditionally created)

**Assumptions:**
1. Listing status is `Active`
2. Listing type is `Auction`
3. Bidder is not the seller
4. Bidder has sufficient lamports
5. Clock timestamp is accurate
6. withdrawal_count is monotonically increasing
7. System program is the real system program

**Outputs & Effects:**
- Updates `listing.current_bid` and `listing.current_bidder`
- Updates `listing.auction_started` if reserve met
- Updates `listing.end_time` if anti-snipe triggered
- Updates `listing.withdrawal_count` for PDA uniqueness
- Updates `escrow.amount` tracking
- Creates `PendingWithdrawal` account for outbid user
- Transfers SOL from bidder to escrow
- Emits `BidPlaced`, `WithdrawalCreated` events

**Block-by-Block Analysis:**

```rust
// L345: Pause check
require!(!ctx.accounts.config.paused, AppMarketError::ContractPaused);
```
- **What**: Ensures contract is not paused
- **Why here**: First check, fail-fast
- **Assumptions**: Config.paused is accurately maintained

```rust
// L351-363: Status and type validation
require!(listing.status == ListingStatus::Active, AppMarketError::ListingNotActive);
require!(listing.listing_type == ListingType::Auction, AppMarketError::NotAnAuction);
if listing.auction_started {
    require!(clock.unix_timestamp < listing.end_time, AppMarketError::AuctionEnded);
}
```
- **What**: Validates listing is active auction and not ended
- **Why here**: Must validate before any state changes
- **Assumptions**: ListingStatus and ListingType enums are correctly maintained
- **5 Hows - How could this check be bypassed?**
  1. Replay attack? → No, state is checked on-chain
  2. Concurrent transactions? → No, Solana serializes account access
  3. Status manipulation? → Only through other instructions that validate roles
  4. Clock manipulation? → Validators could manipulate slightly, but not significantly
  5. How to attack timing? → **Anti-snipe extends time, not reduces it**

```rust
// L365: Seller exclusion
require!(ctx.accounts.bidder.key() != listing.seller, AppMarketError::SellerCannotBid);
```
- **What**: Prevents seller from bidding on own listing
- **Why here**: After listing validation, before balance checks
- **Assumptions**: listing.seller is immutable after creation

```rust
// L367-395: Balance pre-check with rent calculation
let required_balance = if listing.current_bidder.is_some() && listing.current_bid > 0 {
    let withdrawal_space = 8 + PendingWithdrawal::INIT_SPACE;
    let withdrawal_rent = rent.minimum_balance(withdrawal_space);
    amount.checked_add(withdrawal_rent)?.checked_add(tx_fee_buffer)?
} else {
    amount.checked_add(tx_fee_buffer)?
};
require!(ctx.accounts.bidder.lamports() >= required_balance, AppMarketError::InsufficientBalance);
```
- **What**: Pre-checks bidder has enough SOL for bid + withdrawal PDA rent + fees
- **Why here**: Before any state changes, fail-fast on insufficient funds
- **Assumptions**:
  - tx_fee_buffer (10k lamports) is sufficient
  - PendingWithdrawal::INIT_SPACE is accurate
  - Rent calculation is correct
- **First Principles**: Why pre-check instead of letting transfer fail?
  - Better UX: Clear error message
  - Avoids partial state changes
  - But: Race condition possible between check and transfer (lamports could decrease)

```rust
// L391-395: DoS protection
require!(listing.withdrawal_count < MAX_BIDS_PER_LISTING, AppMarketError::MaxBidsExceeded);
```
- **What**: Limits total bids to 1000 per listing
- **Why here**: After basic validation, before reserve checks
- **Assumptions**: 1000 is sufficient limit to prevent DoS
- **5 Whys - Why 1000 limit?**
  1. Why limit bids? → Prevent state bloat and tx cost inflation
  2. Why 1000? → Balance between usability and DoS protection
  3. Why per listing? → Each listing has independent withdrawal PDAs
  4. Why withdrawal_count? → Tracks unique withdrawals, not just bids
  5. **Why is this tied to withdrawal_count, not bid count?** → Could be confusing; a single bidder outbid 999 times creates 1000 withdrawals

```rust
// L397-420: Reserve and increment validation
if !listing.auction_started {
    if let Some(reserve) = listing.reserve_price {
        require!(amount >= reserve, AppMarketError::BidBelowReserve);
    }
}
if listing.current_bid > 0 {
    let increment = listing.current_bid.checked_mul(MIN_BID_INCREMENT_BPS)?
        .checked_div(BASIS_POINTS_DIVISOR)?;
    let min_increment = increment.max(MIN_BID_INCREMENT_LAMPORTS);
    let min_bid = listing.current_bid.checked_add(min_increment)?;
    require!(amount >= min_bid, AppMarketError::BidIncrementTooSmall);
} else {
    require!(amount >= listing.starting_price, AppMarketError::BidTooLow);
}
```
- **What**: Validates bid meets reserve (if applicable) and minimum increment
- **Why here**: Before state changes, after balance check
- **Assumptions**:
  - MIN_BID_INCREMENT_BPS = 500 (5%)
  - MIN_BID_INCREMENT_LAMPORTS = 100_000_000 (0.1 SOL)
  - checked_* prevents overflow
- **5 Hows - How is minimum bid calculated?**
  1. Take 5% of current bid
  2. Compare with 0.1 SOL minimum
  3. Use whichever is larger
  4. Add to current bid
  5. **Edge case**: First bid only needs to meet starting_price, not reserve (unless auction not started)

```rust
// L422-444: State updates (EFFECTS)
let old_bid = listing.current_bid;
let old_bidder = listing.current_bidder;
listing.current_bid = amount;
listing.current_bidder = Some(ctx.accounts.bidder.key());

if !listing.auction_started {
    let reserve_met = if let Some(reserve) = listing.reserve_price {
        amount >= reserve
    } else { true };
    if reserve_met {
        listing.auction_started = true;
        listing.auction_start_time = Some(clock.unix_timestamp);
        listing.end_time = clock.unix_timestamp + (listing.end_time - listing.created_at);
    }
}
```
- **What**: Updates bid state and starts auction timer if reserve met
- **Why here**: After all validation (CEI pattern)
- **Assumptions**:
  - Saving old values before update is correct
  - end_time calculation is correct (original duration from creation)
- **5 Whys - Why recalculate end_time?**
  1. Why change end_time? → Auction timer starts when reserve met
  2. Why use original duration? → `end_time - created_at` = original intended duration
  3. Why not store duration separately? → Storage optimization
  4. Why could this fail? → If `end_time < created_at` (shouldn't happen, but unchecked)
  5. **Why no overflow check?** → Uses checked_add on L440-442

```rust
// L447-450: Escrow amount tracking
ctx.accounts.escrow.amount = ctx.accounts.escrow.amount.checked_add(amount)?;
```
- **What**: Updates tracked escrow amount
- **Why here**: Before external transfers
- **Assumptions**: escrow.amount accurately reflects actual lamports
- **First Principles**: Why track amount separately from actual lamports?
  - Enables pending withdrawal protection
  - Validates escrow hasn't been drained unexpectedly
  - **Risk**: If actual lamports < tracked amount, withdrawals may fail

```rust
// L451-456: Anti-sniping
if listing.auction_started && clock.unix_timestamp > listing.end_time - ANTI_SNIPE_WINDOW {
    listing.end_time = clock.unix_timestamp.checked_add(ANTI_SNIPE_EXTENSION)?;
}
```
- **What**: Extends auction if bid placed within 15 minutes of end
- **Why here**: After bid accepted, before transfers
- **Assumptions**:
  - ANTI_SNIPE_WINDOW = 15 * 60 (15 minutes)
  - ANTI_SNIPE_EXTENSION = 15 * 60 (15 minutes)
  - Continuous extensions are acceptable
- **5 Hows - How does anti-sniping work?**
  1. Check if auction started
  2. Check if within 15-minute window of end
  3. Extend by 15 minutes from current time
  4. **Can be extended indefinitely** with rapid bidding
  5. No maximum extension limit defined

```rust
// L458-466: INTERACTIONS - SOL transfer to escrow
let cpi_ctx = CpiContext::new(
    ctx.accounts.system_program.to_account_info(),
    anchor_lang::system_program::Transfer { from: bidder, to: escrow },
);
anchor_lang::system_program::transfer(cpi_ctx, amount)?;
```
- **What**: Transfers bid amount from bidder to escrow
- **Why here**: After state updates (CEI pattern)
- **Assumptions**: System program is legitimate, transfer will succeed

```rust
// L469-528: Withdrawal pattern for outbid user
if let Some(previous_bidder) = old_bidder {
    if old_bid > 0 {
        listing.withdrawal_count += 1;
        // ... PDA derivation and account creation ...
        withdrawal.user = previous_bidder;
        withdrawal.amount = old_bid;
        // ...
    }
}
```
- **What**: Creates PendingWithdrawal account for outbid user
- **Why here**: After bid transfer succeeds
- **Assumptions**:
  - PDA derivation is correct
  - Manual account creation is safe
  - withdrawal_count is unique
- **5 Whys - Why withdrawal pattern?**
  1. Why not direct refund? → Prevents DoS via malicious recipient
  2. Why PDA? → Ensures unique account per withdrawal
  3. Why manual creation? → Conditional creation only when needed
  4. Why use withdrawal_count? → Unique seed per outbid event
  5. **Why is this safe?** → CEI pattern: state updated, bid transferred, then withdrawal created

**Invariants:**
1. `escrow.amount` equals sum of all unprocessed bids/purchases minus withdrawals
2. `listing.current_bid >= starting_price` (when current_bid > 0)
3. `listing.current_bidder` is set iff `listing.current_bid > 0`
4. Each PendingWithdrawal has unique PDA seed
5. Anti-sniping only activates after auction started

**Cross-Function Dependencies:**
- Reads: `config.paused`
- Creates: `PendingWithdrawal` (consumed by `withdraw_funds`)
- Updates: `Listing`, `Escrow`
- Called by: External (users)
- Affects: `settle_auction`, `buy_now` (may outbid existing bidder)

---

### 2.3 `confirm_receipt` (L1090-1201)

**Purpose:**
Buyer confirms receipt of assets, triggering final fund distribution. This is the **happy path completion** - buyer acknowledges seller delivered, escrow releases to seller minus platform fee.

**Inputs & Assumptions:**
- `ctx.accounts.buyer: Signer` - Must match transaction.buyer
- `ctx.accounts.transaction: Account<Transaction>` - Must be InEscrow status
- `ctx.accounts.escrow: Account<Escrow>` - Listing's escrow with funds
- `ctx.accounts.seller: AccountInfo` - Validated via constraint
- `ctx.accounts.treasury: AccountInfo` - Receives platform fee

**Assumptions:**
1. Transaction status is `InEscrow`
2. Buyer is legitimate transaction buyer
3. Uploads have been verified by backend
4. Escrow has sufficient funds
5. No pending withdrawals exist

**Outputs & Effects:**
- Transfers `platform_fee` to treasury
- Transfers `seller_proceeds` to seller
- Updates `transaction.status = Completed`
- Updates `config.total_volume` and `config.total_sales` (saturating)
- Closes escrow (rent to seller)
- Emits `TransactionCompleted`

**Block-by-Block Analysis:**

```rust
// L1091-1112: Validation block
require!(!ctx.accounts.config.paused, AppMarketError::ContractPaused);
require!(transaction.status == TransactionStatus::InEscrow, ...);
require!(ctx.accounts.buyer.key() == transaction.buyer, AppMarketError::NotBuyer);
require!(ctx.accounts.treasury.key() == ctx.accounts.config.treasury, ...);
require!(ctx.accounts.seller.key() == transaction.seller, ...);
require!(transaction.uploads_verified, AppMarketError::UploadsNotVerified);
```
- **What**: Validates all parties and preconditions
- **Why here**: Fail-fast before any transfers
- **Assumptions**: All referenced accounts are correct
- **5 Whys - Why require uploads_verified?**
  1. Why check? → Ensures backend confirmed assets were transferred
  2. Why backend? → Off-chain asset transfer verification
  3. Why not trust seller_confirmed_transfer alone? → Seller could lie
  4. Why centralized verification? → No on-chain mechanism for off-chain assets
  5. **Centralization risk**: Backend is single point of trust

```rust
// L1114-1142: Escrow balance validation
let escrow_balance = ctx.accounts.escrow.to_account_info().lamports();
let rent = Rent::get()?.minimum_balance(escrow.data_len());
let required_balance = platform_fee + seller_proceeds;
require!(escrow_balance >= required_balance + rent, AppMarketError::InsufficientEscrowBalance);
require!(escrow_balance >= tracked_with_rent, AppMarketError::EscrowBalanceMismatch);
require!(ctx.accounts.escrow.amount == required_balance, AppMarketError::PendingWithdrawalsExist);
```
- **What**: Triple-validates escrow state
- **Why here**: Before transfers, critical security check
- **Assumptions**:
  - `escrow.amount` accurately tracks deposits/withdrawals
  - No external lamport modifications
- **First Principles**: Why 3 separate checks?
  1. `escrow_balance >= required + rent` → Has enough lamports
  2. `escrow_balance >= tracked_with_rent` → Tracked amount matches reality
  3. `escrow.amount == required` → **No pending withdrawals** (critical)
- **5 Hows - How does this prevent theft?**
  1. Tracks all deposits and withdrawals in `escrow.amount`
  2. Before closing escrow, checks `amount == required`
  3. If withdrawals exist, `amount > required`
  4. This would cause `PendingWithdrawalsExist` error
  5. **Prevents stealing outbid users' funds**

```rust
// L1144-1180: Fund distribution
// Platform fee to treasury
anchor_lang::system_program::transfer(cpi_ctx, transaction.platform_fee)?;
escrow.amount -= platform_fee;
// Seller proceeds
anchor_lang::system_program::transfer(cpi_ctx2, transaction.seller_proceeds)?;
escrow.amount -= seller_proceeds;
```
- **What**: Distributes funds to treasury and seller
- **Why here**: After all validation
- **Assumptions**: Transfer will succeed, math is correct
- **5 Whys - Why update escrow.amount after each transfer?**
  1. Why update? → Keeps tracking accurate
  2. Why after transfer? → CEI: interaction then update
  3. **Actually reversed**: State updated after interaction here
  4. Why is this safe? → No reentrancy in Solana native programs
  5. Why not before? → Allows recovery on failure

```rust
// L1182-1189: Status and stats update
transaction.status = TransactionStatus::Completed;
transaction.completed_at = Some(clock.unix_timestamp);
config.total_volume = config.total_volume.saturating_add(transaction.sale_price);
config.total_sales = config.total_sales.saturating_add(1);
```
- **What**: Marks complete, updates stats
- **Why here**: After successful transfers
- **Assumptions**: saturating_add prevents overflow blocking
- **5 Hows - Why saturating_add for stats?**
  1. What if total_volume overflows? → Would block all transactions
  2. saturating_add caps at u64::MAX
  3. Stats become inaccurate but contract works
  4. Acceptable tradeoff: usability over accuracy
  5. **Note**: Inaccurate stats after overflow

**Invariants:**
1. `transaction.status == Completed` after success
2. Escrow account closed (rent returned)
3. Platform fee went to treasury
4. Seller proceeds went to seller
5. No pending withdrawals stolen

**Cross-Function Dependencies:**
- Reads: `config.paused`, `config.treasury`, `transaction.*`, `escrow.*`
- Requires: `verify_uploads` called first
- Mutually exclusive with: `finalize_transaction`, `emergency_refund`, `resolve_dispute`

---

### 2.4 `resolve_dispute` (L1658-1884)

**Purpose:**
Admin-only function to resolve disputes. Can fully refund buyer, release to seller, or split. This is the **centralized resolution path** with significant power over funds.

**Inputs & Assumptions:**
- `resolution: DisputeResolution` - Admin's decision (FullRefund, ReleaseToSeller, PartialRefund)
- `notes: String` - Admin notes for record
- `ctx.accounts.admin: Signer` - Must match config.admin
- All party accounts validated via constraints

**Assumptions:**
1. Admin is trusted and acting in good faith
2. Dispute is Open or UnderReview
3. Escrow has sufficient funds
4. Resolution amounts are valid (for PartialRefund)

**Outputs & Effects:**
- Transfers funds according to resolution
- Updates transaction status
- Distributes dispute fee
- Closes escrow and dispute accounts
- Emits `DisputeResolved`

**Block-by-Block Analysis:**

```rust
// L1668-1681: Admin and state validation
require!(ctx.accounts.admin.key() == ctx.accounts.config.admin, AppMarketError::NotAdmin);
require!(dispute.status == DisputeStatus::Open || dispute.status == DisputeStatus::UnderReview, ...);
```
- **What**: Validates admin authority and dispute state
- **Why here**: Critical access control first
- **First Principles**: Admin has unilateral power to resolve disputes. **No multisig, no timelock on resolution.**

```rust
// L1696-1832: Resolution switch block
match resolution {
    DisputeResolution::FullRefund => { /* refund buyer */ },
    DisputeResolution::ReleaseToSeller => { /* pay seller + treasury */ },
    DisputeResolution::PartialRefund { buyer_amount, seller_amount } => { /* split */ },
}
```
- **What**: Executes resolution based on admin decision
- **Why here**: After all validation
- **Assumptions**: Admin provides valid amounts for PartialRefund
- **5 Whys - Why no timelock on dispute resolution?**
  1. Why no delay? → Disputes may need quick resolution
  2. Why is this risky? → Admin can steal funds via malicious resolution
  3. What mitigation exists? → None on-chain
  4. Why accept this? → Trade-off for dispute velocity
  5. **Trust assumption**: Admin is honest

**PartialRefund Analysis (L1760-1831):**
```rust
require!(buyer_amount > 0 || seller_amount > 0, AppMarketError::InvalidRefundAmounts);
let total_refund = buyer_amount.checked_add(seller_amount)?;
require!(total_refund <= transaction.sale_price, AppMarketError::InvalidRefundAmounts);
```
- **What**: Validates partial refund amounts
- **Why**: Prevent invalid or extractive resolutions
- **Assumptions**: Admin sets amounts honestly
- **5 Hows - How can admin abuse this?**
  1. Set buyer_amount = 0, seller_amount = 0? → Blocked by require
  2. Set total > sale_price? → Blocked by require
  3. Set total < sale_price? → Remainder goes to treasury (L1811-1828)
  4. **Admin can give themselves (treasury) extra via low totals**
  5. **Risk**: Admin extracts value via partial refunds

```rust
// L1834-1867: Dispute fee distribution
match resolution {
    DisputeResolution::FullRefund => { /* refund fee to buyer */ },
    _ => { /* fee to treasury */ },
}
```
- **What**: Returns dispute fee based on outcome
- **Why**: Incentivize legitimate disputes
- **Assumptions**: Dispute PDA has fee lamports
- **5 Whys - Why refund fee on FullRefund only?**
  1. Why refund? → Buyer was right, shouldn't lose fee
  2. Why not partial? → Compromise means both parties had merit
  3. Why to treasury otherwise? → Platform compensation for arbitration
  4. What if seller initiated? → **Fee always goes to treasury unless FullRefund**
  5. **Design choice**: Encourages buyers to dispute, sellers to resolve

**Invariants:**
1. Only admin can resolve
2. Total distributed ≤ sale_price + dispute_fee
3. Escrow closed after resolution
4. Dispute closed after resolution

**Cross-Function Dependencies:**
- Requires: `open_dispute` called first
- Reads: `config.admin`, `config.treasury`
- Mutually exclusive with: `confirm_receipt`, `finalize_transaction`, `emergency_refund`

**Risk Analysis:**
- **Admin can extract value** via PartialRefund with low totals
- **No oversight** on admin decisions
- **Single point of failure** for dispute resolution

---

## Phase 3 — Global System Understanding

### 3.1 State & Invariant Reconstruction

**Global Invariants:**

1. **Fee Immutability**: Once listing created, `listing.platform_fee_bps` and `listing.dispute_fee_bps` are locked (L307-309)

2. **Escrow Accounting**: `escrow.amount` = (all bids/purchases) - (all withdrawals claimed) - (all completions)

3. **Withdrawal Protection**: Before closing escrow, must verify `escrow.amount == expected_payout` (prevents theft of pending withdrawals)

4. **Singleton Config**: Only one MarketConfig PDA exists (`seeds = [b"config"]`)

5. **Listing Uniqueness**: Each listing has unique PDA (`seeds = [b"listing", seller, salt]`)

6. **Transaction Lifecycle**: Active → Sold → InEscrow → {Completed, Disputed, Refunded}

### 3.2 Workflow Reconstruction

**Happy Path (Buy Now):**
1. `create_listing` → Listing + Escrow created
2. `buy_now` → Funds to escrow, Transaction created
3. `seller_confirm_transfer` → Seller marks transfer done
4. `verify_uploads` → Backend verifies
5. `confirm_receipt` → Buyer confirms, funds released

**Happy Path (Auction):**
1. `create_listing` → Listing + Escrow created
2. `place_bid` (multiple) → Bids placed, withdrawals created for outbid
3. `withdraw_funds` → Outbid users claim refunds
4. `settle_auction` → Transaction created
5. Same as Buy Now from step 3

**Dispute Path:**
1. After step 2-4 of happy path
2. `open_dispute` → Dispute created, fee paid
3. `resolve_dispute` → Admin decides, funds distributed

**Emergency Path:**
1. After `buy_now` or `settle_auction`
2. Seller never confirms, deadline passes
3. `emergency_refund` → Full refund to buyer

### 3.3 Trust Boundary Mapping

```
┌─────────────────────────────────────────────────────────┐
│                    TRUSTED ZONE                          │
│  ┌─────────┐      ┌──────────────────┐                  │
│  │  Admin  │──────│  Config Changes  │                  │
│  │         │      │  Dispute Resolve │                  │
│  └─────────┘      └──────────────────┘                  │
│       │                    │                             │
│       │    48hr timelock   │  no timelock               │
│       ▼                    ▼                             │
│  ┌─────────┐      ┌──────────────────┐                  │
│  │Treasury │      │ Backend Authority│                  │
│  │ Change  │      │  (verify_uploads)│                  │
│  └─────────┘      └──────────────────┘                  │
├─────────────────────────────────────────────────────────┤
│                  SEMI-TRUSTED ZONE                       │
│  ┌─────────┐      ┌──────────────────┐                  │
│  │ Seller  │──────│  Confirm Transfer│                  │
│  │         │      │  Accept Offer    │                  │
│  │         │      │  Finalize        │                  │
│  └─────────┘      └──────────────────┘                  │
├─────────────────────────────────────────────────────────┤
│                   UNTRUSTED ZONE                         │
│  ┌─────────┐      ┌──────────────────┐                  │
│  │ Buyer   │──────│  Bid / Buy       │                  │
│  │ Bidder  │      │  Offer           │                  │
│  │         │      │  Dispute         │                  │
│  └─────────┘      └──────────────────┘                  │
└─────────────────────────────────────────────────────────┘
```

### 3.4 Complexity & Fragility Clusters

**High Complexity:**
1. `place_bid` - Most complex: state updates, anti-snipe, withdrawal creation, balance checks
2. `resolve_dispute` - Multiple resolution paths, fund distribution logic
3. `accept_offer` - Transfers between escrows, withdrawal for outbid

**High Fragility:**
1. `escrow.amount` tracking - Must be perfectly synchronized with lamports
2. Withdrawal pattern - PDA seeds must be unique
3. Finalize vs Confirm vs Emergency - Mutually exclusive paths

**Coupled State:**
1. `listing.withdrawal_count` ↔ `PendingWithdrawal` PDAs
2. `listing.offer_count` + `consecutive_offer_count` ↔ DoS protection
3. `transaction.uploads_verified` ↔ `verify_uploads` (backend dependency)

---

## Key Findings Summary

### Critical Observations:
1. **Initialization Frontrunning**: `initialize()` has no access control - first caller wins
2. **Centralized Backend**: `verify_uploads` creates single point of failure
3. **Admin Power**: `resolve_dispute` has no timelock, admin can extract funds
4. **Escrow Tracking**: `escrow.amount` is critical invariant - must stay synchronized

### Design Patterns:
1. **CEI Pattern**: Generally followed (Checks-Effects-Interactions)
2. **Withdrawal Pattern**: Prevents DoS on bid refunds
3. **Fee Locking**: Fees locked at listing creation (good)
4. **Timelock**: 48hr delay on admin/treasury changes (good, but not disputes)

### Unresolved Questions:
1. How is deployment frontrunning prevented in practice?
2. What happens if backend authority is compromised?
3. What if `escrow.amount` gets out of sync with actual lamports?
