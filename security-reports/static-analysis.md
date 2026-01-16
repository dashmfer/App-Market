# Static Analysis Report: App Market Escrow

**Analysis Date**: 2026-01-16
**Tool**: Manual static analysis (Semgrep unavailable for Rust/Solana)
**Scope**: `programs/app-market/src/lib.rs`
**Framework**: Anchor 0.30.0 (Solana)

---

## Executive Summary

| Severity | Count |
|----------|-------|
| Critical | 2 |
| High | 4 |
| Medium | 6 |
| Low | 5 |
| Informational | 3 |
| **Total** | **20** |

---

## Critical Findings

### C-01: Initialization Frontrunning Vulnerability

**Location**: `lib.rs:L71-102` (`initialize` function)
**Pattern**: Missing access control on initialization
**CWE**: CWE-284 (Improper Access Control)

**Description**:
The `initialize` function has no access control. Whoever calls this function first becomes the admin with full control over the marketplace.

```rust
pub fn initialize(
    ctx: Context<Initialize>,
    platform_fee_bps: u64,
    dispute_fee_bps: u64,
    backend_authority: Pubkey,
) -> Result<()> {
    // No access control check
    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key(); // First caller becomes admin
    // ...
}
```

**Attack Scenario**:
1. Legitimate deployer deploys program
2. Attacker monitors mempool for deployment
3. Attacker frontuns initialization with their own admin key
4. Attacker controls treasury and all admin functions

**Recommendation**:
- Use a hardcoded expected admin pubkey
- Or use a two-step deployment: deploy with known authority, then verify

---

### C-02: Centralized Backend Authority Without Fallback

**Location**: `lib.rs:L924-958` (`verify_uploads` function)
**Pattern**: Single point of failure in trust model
**CWE**: CWE-306 (Missing Authentication for Critical Function)

**Description**:
The `verify_uploads` function is controlled by a single backend authority. If this key is compromised or lost, all pending transactions are stuck indefinitely.

```rust
pub fn verify_uploads(ctx: Context<VerifyUploads>, verification_hash: String) -> Result<()> {
    require!(
        ctx.accounts.backend_authority.key() == ctx.accounts.config.backend_authority,
        AppMarketError::NotBackendAuthority
    );
    // No timeout fallback, no multi-sig, no recovery mechanism
}
```

**Impact**:
- Backend key compromise: Attacker can verify fraudulent transfers
- Backend key loss: All transactions in escrow are permanently stuck
- No on-chain verification: Buyer/seller disputes require off-chain trust

**Recommendation**:
- Add timeout-based fallback (e.g., buyer can confirm after 30 days if backend unresponsive)
- Consider multi-sig for backend authority
- Add emergency admin override for stuck transactions

---

## High Findings

### H-01: Admin Can Extract Funds via Partial Refund

**Location**: `lib.rs:L1760-1831` (`resolve_dispute` with `PartialRefund`)
**Pattern**: Privileged function with fund extraction capability
**CWE**: CWE-863 (Incorrect Authorization)

**Description**:
Admin can resolve disputes with `PartialRefund` where `buyer_amount + seller_amount < sale_price`. The remainder goes to treasury, which admin controls.

```rust
DisputeResolution::PartialRefund { buyer_amount, seller_amount } => {
    let total_refund = buyer_amount.checked_add(seller_amount)?;
    require!(total_refund <= transaction.sale_price, ...); // ≤ not ==
    // ...
    let remaining = transaction.sale_price.checked_sub(total_refund)?;
    if remaining > 0 {
        // Remainder goes to treasury (admin-controlled)
        anchor_lang::system_program::transfer(cpi_ctx, remaining)?;
    }
}
```

**Attack Scenario**:
1. User dispute with 10 SOL sale price
2. Admin resolves with buyer_amount=1, seller_amount=1
3. Remaining 8 SOL goes to treasury
4. Admin extracts 8 SOL unfairly

**Recommendation**:
- Require `buyer_amount + seller_amount == sale_price`
- Or add explicit platform_fee_retained field
- Add timelock on dispute resolution

---

### H-02: No Timelock on Dispute Resolution

**Location**: `lib.rs:L1658-1884` (`resolve_dispute`)
**Pattern**: Missing timelock on privileged operation
**CWE**: CWE-269 (Improper Privilege Management)

**Description**:
While treasury and admin changes have 48-hour timelocks, dispute resolution has no timelock. Admin can immediately and unilaterally resolve disputes.

```rust
// Treasury change: has timelock
pub fn execute_treasury_change(ctx: Context<ExecuteTreasuryChange>) -> Result<()> {
    require!(clock.unix_timestamp >= proposed_at + ADMIN_TIMELOCK_SECONDS, ...);
}

// Dispute resolution: no timelock
pub fn resolve_dispute(ctx: Context<ResolveDispute>, ...) -> Result<()> {
    // Immediate execution
}
```

**Recommendation**:
- Add timelock period between dispute review and resolution
- Or implement multi-sig requirement for large disputes

---

### H-03: Unchecked Treasury Account

**Location**: `lib.rs:L2009-2010` (`Initialize` struct)
**Pattern**: Missing account validation
**CWE**: CWE-20 (Improper Input Validation)

**Description**:
The treasury account in initialization is marked as `/// CHECK` with no validation.

```rust
#[derive(Accounts)]
pub struct Initialize<'info> {
    // ...
    /// CHECK: Treasury wallet to receive fees
    pub treasury: AccountInfo<'info>, // No validation!
    // ...
}
```

**Impact**:
- Can set treasury to program-owned account (funds locked forever)
- Can set treasury to system program (funds burned)
- No validation treasury is a valid SOL recipient

**Recommendation**:
```rust
#[account(
    constraint = treasury.owner == &system_program::ID @ AppMarketError::InvalidTreasury
)]
pub treasury: AccountInfo<'info>,
```

---

### H-04: Withdrawal Pattern Race Condition Window

**Location**: `lib.rs:L469-528` (withdrawal creation in `place_bid`)
**Pattern**: State consistency gap
**CWE**: CWE-362 (Race Condition)

**Description**:
The withdrawal account is created manually after the bid transfer. Between the transfer and account creation, there's a state where funds exist but no withdrawal record exists.

```rust
// L466: Transfer happens
anchor_lang::system_program::transfer(cpi_ctx, amount)?;

// L469-528: Withdrawal created AFTER transfer
if let Some(previous_bidder) = old_bidder {
    // ... create withdrawal account ...
}
```

While Solana's single-threaded execution prevents true race conditions, if the transaction fails between these points, state becomes inconsistent.

**Recommendation**:
- Use Anchor's `init_if_needed` for withdrawal accounts (careful with rent drain)
- Or atomic operations with program-derived accounts

---

## Medium Findings

### M-01: DoS via Withdrawal Count Exhaustion

**Location**: `lib.rs:L391-395`
**Pattern**: Resource exhaustion
**CWE**: CWE-400 (Uncontrolled Resource Consumption)

```rust
require!(listing.withdrawal_count < MAX_BIDS_PER_LISTING, AppMarketError::MaxBidsExceeded);
// MAX_BIDS_PER_LISTING = 1000
```

**Issue**: A wealthy attacker can place and outbid themselves 1000 times to prevent legitimate bids.

**Cost**: ~1000 * (rent + bid increment) ≈ 100+ SOL
**Impact**: Listing becomes unbiddable

---

### M-02: Anti-Sniping Infinite Extension

**Location**: `lib.rs:L451-456`
**Pattern**: Unbounded loop/extension
**CWE**: CWE-835 (Loop with Unreachable Exit Condition)

```rust
if listing.auction_started && clock.unix_timestamp > listing.end_time - ANTI_SNIPE_WINDOW {
    listing.end_time = clock.unix_timestamp.checked_add(ANTI_SNIPE_EXTENSION)?;
}
```

**Issue**: No maximum extension limit. Two bidders could extend auction indefinitely by bidding every 14 minutes.

**Recommendation**: Add `max_end_time` field set at auction start.

---

### M-03: Fee Boundary Edge Cases

**Location**: `lib.rs:L77-85`
**Pattern**: Boundary value issues
**CWE**: CWE-190 (Integer Overflow)

```rust
require!(platform_fee_bps <= MAX_PLATFORM_FEE_BPS, ...); // ≤ 1000
require!(dispute_fee_bps <= MAX_DISPUTE_FEE_BPS, ...);   // ≤ 500
```

**Issues**:
1. No minimum fee validation (0% fees allowed)
2. Combined fees could be 15% (10% platform + 5% dispute)
3. No validation fees don't exceed meaningful threshold

---

### M-04: Missing Event on Initialize

**Location**: `lib.rs:L71-102`
**Pattern**: Missing audit trail
**CWE**: CWE-778 (Insufficient Logging)

**Description**: The `initialize` function emits no event, making it harder to track who initialized the contract.

---

### M-05: Offer Seed Collision Potential

**Location**: `lib.rs:L2362-2375`
**Pattern**: Non-unique PDA seed
**CWE**: CWE-330 (Insufficient Entropy)

```rust
seeds = [
    b"offer",
    listing.key().as_ref(),
    buyer.key().as_ref(),
    &offer_seed.to_le_bytes() // Client-provided seed
]
```

**Issue**: Same buyer can accidentally use same `offer_seed` and fail.
**Recommendation**: Use counter-based seed like withdrawals.

---

### M-06: Inconsistent Escrow Closure Rent Recipients

**Location**: Various account structs
**Pattern**: Inconsistent design
**CWE**: CWE-1068 (Inconsistency)

| Context | Rent Recipient |
|---------|----------------|
| `CancelAuction` | seller |
| `ExpireListing` | seller |
| `EmergencyRefund` | buyer |
| `ResolveDispute` | seller (via transaction.seller) |

**Issue**: Inconsistent rent return could cause confusion about who pays what.

---

## Low Findings

### L-01: Saturating Stats Can Become Inaccurate

**Location**: `lib.rs:L1074-1075, L1186-1189`

```rust
config.total_volume = config.total_volume.saturating_add(transaction.sale_price);
config.total_sales = config.total_sales.saturating_add(1);
```

After `u64::MAX`, stats become inaccurate. Consider using u128 or separate overflow counter.

---

### L-02: No Validation of GitHub Username Format Completeness

**Location**: `lib.rs:L275-284`

```rust
require!(required_github_username.len() <= 64, ...);
require!(required_github_username.chars().all(|c| c.is_alphanumeric() || c == '-'), ...);
```

GitHub usernames:
- Cannot start with hyphen
- Cannot end with hyphen
- Cannot have consecutive hyphens

These rules are not enforced.

---

### L-03: Clock Manipulation Window

**Location**: Multiple functions using `Clock::get()?`

Validators can manipulate clock by ±30 seconds. This could affect:
- Anti-sniping window boundary
- Auction end timing
- Offer deadlines

---

### L-04: Magic Numbers in Code

**Location**: `lib.rs:L369`

```rust
let tx_fee_buffer = 10_000; // Magic number
```

Should be a named constant.

---

### L-05: Unused Error Variants

**Location**: `lib.rs:L3133`

```rust
#[msg("Dispute deadline expired: must dispute within grace period")]
DisputeDeadlineExpired, // Never used in code
```

---

## Informational

### I-01: Consider Using Anchor Constraints for Access Control

Many functions manually check access control:
```rust
require!(ctx.accounts.admin.key() == ctx.accounts.config.admin, AppMarketError::NotAdmin);
```

Could use Anchor constraints:
```rust
#[account(constraint = admin.key() == config.admin @ AppMarketError::NotAdmin)]
```

---

### I-02: Listing ID Format Limits

**Location**: `lib.rs:L292`

```rust
listing.listing_id = format!("{}-{}", ctx.accounts.seller.key(), salt);
```

Pubkey (44 chars) + "-" + u64 (up to 20 digits) could exceed 64 char limit in `#[max_len(64)]`.

---

### I-03: Version Compatibility Notes

The contract uses Anchor 0.30.0 features. Ensure compatibility with:
- Solana 1.18+ (for transaction size limits)
- SPL Token 2022 (if future token support needed)

---

## Security Pattern Analysis

### Patterns Correctly Implemented ✓

| Pattern | Location | Status |
|---------|----------|--------|
| CEI (Checks-Effects-Interactions) | Most functions | ✓ Mostly correct |
| Withdrawal pattern | `place_bid`, `buy_now` | ✓ Implemented |
| Fee locking | `create_listing` | ✓ Fees locked at creation |
| Math safety | Throughout | ✓ Uses checked_* operations |
| Timelock | Admin/treasury changes | ✓ 48hr delay |
| DoS protection | Bid/offer limits | ✓ Limits in place |
| Pause mechanism | Critical functions | ✓ Emergency stop |

### Patterns Missing or Incomplete ✗

| Pattern | Issue | Risk |
|---------|-------|------|
| Access control on init | First-caller wins | Critical |
| Backend fallback | No timeout/recovery | Critical |
| Dispute timelock | Immediate resolution | High |
| Treasury validation | Unchecked account | High |
| Multi-sig | All admin ops single-sig | Medium |

---

## Recommendations Summary

### Immediate Actions (Critical/High):
1. Add deployment access control to `initialize`
2. Add fallback mechanism for stuck transactions (backend unavailable)
3. Require `buyer_amount + seller_amount == sale_price` in partial refunds
4. Add timelock to dispute resolution
5. Validate treasury account is SOL-receivable

### Short-term Improvements (Medium):
6. Add maximum auction extension limit
7. Use counter-based offer seeds instead of user-provided
8. Add initialization event emission
9. Validate fee combinations don't exceed threshold

### Long-term Considerations (Low/Info):
10. Consider multi-sig for admin operations
11. Add comprehensive GitHub username validation
12. Replace magic numbers with named constants
13. Remove unused error variants
