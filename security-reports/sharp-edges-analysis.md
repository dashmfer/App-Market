# Sharp Edges Analysis: App Market Escrow

**Analysis Date**: 2026-01-16
**Scope**: `programs/app-market/src/lib.rs`
**Framework**: Anchor 0.30.0 (Solana)
**Focus**: API design footguns, dangerous configurations, misuse-prone interfaces

---

## Executive Summary

| Category | Findings |
|----------|----------|
| Dangerous Defaults | 4 |
| Configuration Cliffs | 5 |
| Silent Failures | 3 |
| Primitive vs Semantic APIs | 2 |
| Zero/Empty/Null Edge Cases | 4 |
| **Total Sharp Edges** | **18** |

---

## 1. Dangerous Defaults

### SE-01: First-Caller-Wins Admin Assignment (Critical)

**Location**: `lib.rs:L88`
**Category**: Dangerous Default
**Adversary**: The Scoundrel

```rust
pub fn initialize(...) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key(); // First caller wins!
}
```

**The Sharp Edge**:
The default behavior is "whoever calls first is admin". There's no validation, no expected admin parameter, no deployment guard.

**Pit of Success Violation**:
- The easy path (just call `initialize`) leads to potential compromise
- A secure deployment requires external coordination (deploying in same tx, monitoring mempool)
- No compile-time or runtime protection

**Proof of Misuse**:
```typescript
// Attacker script
const tx = new Transaction();
tx.add(
  program.methods.initialize(500, 200, attackerBackend)
    .accounts({
      admin: attacker.publicKey,
      treasury: attackerTreasury,
      config: configPda,
      systemProgram: SystemProgram.programId,
    })
    .instruction()
);
await sendAndConfirmTransaction(connection, tx, [attacker]);
// Attacker is now admin
```

**Recommendation**:
```rust
// Option 1: Hardcoded expected admin
const EXPECTED_ADMIN: Pubkey = pubkey!("ExpectedAdmin...");
require!(ctx.accounts.admin.key() == EXPECTED_ADMIN, NotDeployer);

// Option 2: Two-step initialization
pub fn initialize_step1(ctx: Context<InitStep1>, expected_admin: Pubkey) -> Result<()>
pub fn initialize_step2(ctx: Context<InitStep2>) -> Result<()>  // Only expected_admin can call
```

---

### SE-02: Zero Fees Allowed Without Warning

**Location**: `lib.rs:L77-85`
**Category**: Dangerous Default
**Adversary**: The Confused Developer

```rust
require!(platform_fee_bps <= MAX_PLATFORM_FEE_BPS, FeeTooHigh);  // 0 is allowed
require!(dispute_fee_bps <= MAX_DISPUTE_FEE_BPS, FeeTooHigh);    // 0 is allowed
```

**The Sharp Edge**:
Setting `platform_fee_bps = 0` is silently accepted. This could be:
- Intentional (free marketplace)
- A mistake (forgot to set fees)
- Exploitation (admin sets to 0 to attract users, then changes later)

**Zero Semantics Ambiguity**:
- Does 0% platform fee mean "no fee taken"? ✓ (current behavior)
- Does 0% dispute fee mean "free disputes"? ✓ (current behavior)
- Is this intentional or an oversight?

**Recommendation**:
```rust
// At minimum, require explicit acknowledgment
pub fn initialize(
    ctx: Context<Initialize>,
    platform_fee_bps: u64,
    dispute_fee_bps: u64,
    zero_fees_acknowledged: bool,  // Force caller to acknowledge
) -> Result<()> {
    if platform_fee_bps == 0 || dispute_fee_bps == 0 {
        require!(zero_fees_acknowledged, ZeroFeesNotAcknowledged);
    }
}
```

---

### SE-03: Backend Authority as Single Required Parameter

**Location**: `lib.rs:L90`
**Category**: Dangerous Default
**Adversary**: The Lazy Developer

```rust
config.backend_authority = backend_authority;  // Just a Pubkey, no validation
```

**The Sharp Edge**:
The backend authority is accepted as a plain `Pubkey` with no validation that it's:
- A real account that exists
- Controlled by the deployer
- Not a program or system account

**Misuse Scenarios**:
```typescript
// Lazy developer uses placeholder
await program.methods.initialize(500, 200, Keypair.generate().publicKey)
// Now nobody can call verify_uploads!

// Or typo
await program.methods.initialize(500, 200, new PublicKey("wrong"))
```

---

### SE-04: Anti-Sniping Without Maximum Extension

**Location**: `lib.rs:L451-456`
**Category**: Dangerous Default
**Adversary**: The Scoundrel

```rust
if listing.auction_started && clock.unix_timestamp > listing.end_time - ANTI_SNIPE_WINDOW {
    listing.end_time = clock.unix_timestamp.checked_add(ANTI_SNIPE_EXTENSION)?;
    // No maximum! Can extend forever
}
```

**The Sharp Edge**:
There's no `max_end_time` cap. Two colluding bidders could extend an auction indefinitely.

**Default Behavior Problem**:
- Users expect auctions to end within reasonable bounds
- The default "extend by 15 minutes" is sensible per-bid
- But unbounded cumulative extension is a footgun

---

## 2. Configuration Cliffs

### SE-05: Treasury Account Accepts Any AccountInfo

**Location**: `lib.rs:L2009-2010`
**Category**: Configuration Cliff
**Adversary**: The Confused Developer

```rust
/// CHECK: Treasury wallet to receive fees
pub treasury: AccountInfo<'info>,  // No validation whatsoever
```

**The Sharp Edge**:
Treasury can be set to:
- A program-owned account (fees locked forever)
- The system program (fees burned)
- A closed account (transfers fail later)
- An executable (transfers fail)

**Configuration Cliff**: One wrong treasury address = all fees lost with no recovery.

**Recommendation**:
```rust
#[account(
    constraint = treasury.lamports() > 0 @ InvalidTreasury,
    constraint = treasury.owner == &system_program::ID @ InvalidTreasury,
)]
pub treasury: AccountInfo<'info>,
```

---

### SE-06: Offer Seed is Client-Controlled

**Location**: `lib.rs:L2367-2372`
**Category**: Configuration Cliff
**Adversary**: The Confused Developer

```rust
seeds = [
    b"offer",
    listing.key().as_ref(),
    buyer.key().as_ref(),
    &offer_seed.to_le_bytes()  // Client provides this
]
```

**The Sharp Edge**:
If a client accidentally reuses `offer_seed`, the transaction fails silently (PDA collision).

**Client Code Footgun**:
```typescript
// First offer
await program.methods.makeOffer(amount, deadline, 1n).accounts({...});
// Oops, used same seed
await program.methods.makeOffer(amount2, deadline2, 1n).accounts({...}); // FAILS
```

**Recommendation**: Use a counter like `withdrawal_count`:
```rust
// Better: auto-incrementing counter
listing.offer_count += 1;
seeds = [b"offer", listing.key().as_ref(), &listing.offer_count.to_le_bytes()]
```

---

### SE-07: GitHub Username Validation Incomplete

**Location**: `lib.rs:L275-284`
**Category**: Configuration Cliff
**Adversary**: The Confused Developer

```rust
require!(required_github_username.len() <= 64, InvalidGithubUsername);
require!(
    required_github_username.chars().all(|c| c.is_alphanumeric() || c == '-'),
    InvalidGithubUsername
);
```

**The Sharp Edge**:
GitHub usernames have additional rules not enforced:
- Cannot start with hyphen
- Cannot end with hyphen
- Cannot have consecutive hyphens
- Must be 1-39 characters (not 64)

**Example Accepted but Invalid**:
```rust
// All of these pass validation but are invalid GitHub usernames:
"-invalid"
"invalid-"
"in--valid"
"this-is-way-too-long-for-github-but-accepted-here-sixty-four-chars"
```

---

### SE-08: Duration Accepts Maximum 30 Days Without Warning

**Location**: `lib.rs:L247-250`
**Category**: Configuration Cliff
**Adversary**: The Lazy Developer

```rust
require!(
    duration_seconds > 0 && duration_seconds <= MAX_AUCTION_DURATION_SECONDS,
    InvalidDuration
);
// MAX_AUCTION_DURATION_SECONDS = 30 * 24 * 60 * 60
```

**The Sharp Edge**:
- Maximum is exactly 30 days, no flexibility
- Error message doesn't tell you the actual limit
- Client must know magic number

**Better Error Message**:
```rust
#[msg("Invalid duration: must be between 1 second and 30 days (2,592,000 seconds)")]
InvalidDuration,
```

---

### SE-09: Timelock Exactly 48 Hours (No Configuration)

**Location**: `lib.rs:L54`
**Category**: Configuration Cliff
**Adversary**: The Confused Developer

```rust
pub const ADMIN_TIMELOCK_SECONDS: i64 = 48 * 60 * 60;  // Hardcoded
```

**The Sharp Edge**:
Timelock is hardcoded with no ability to adjust for different security/convenience tradeoffs.

**Trade-off Blindness**:
- 48 hours might be too long for legitimate urgent fixes
- 48 hours might be too short for high-value protocol changes
- No way to configure per-operation or overall

---

## 3. Silent Failures

### SE-10: Stats Overflow Silently Caps

**Location**: `lib.rs:L1074-1075`
**Category**: Silent Failure
**Adversary**: The Confused Developer

```rust
config.total_volume = config.total_volume.saturating_add(transaction.sale_price);
config.total_sales = config.total_sales.saturating_add(1);
```

**The Sharp Edge**:
After `u64::MAX` (~18 quintillion), stats silently cap. No event, no warning, no flag.

**Silent Data Corruption**:
```rust
// Before overflow
total_volume = 18,446,744,073,709,551,615
// After 100 SOL sale
total_volume = 18,446,744,073,709,551,615  // Same! Silent cap
```

**Recommendation**:
```rust
let (new_volume, overflowed) = config.total_volume.overflowing_add(sale_price);
if overflowed {
    emit!(StatsOverflowed { field: "total_volume" });
}
config.total_volume = new_volume.saturating_add(0); // or handle differently
```

---

### SE-11: Transaction Fee Buffer is Insufficient Check

**Location**: `lib.rs:L369`
**Category**: Silent Failure
**Adversary**: The Scoundrel

```rust
let tx_fee_buffer = 10_000; // 10k lamports = 0.00001 SOL
```

**The Sharp Edge**:
This is an estimated buffer for transaction fees. If Solana fee markets spike:
- Check passes (user appears to have enough)
- Actual transaction fails (insufficient for compute units)
- User is confused

**Race Condition**:
```
1. Check: user has 1.0001 SOL, needs 1.00001 SOL (bid + buffer) ✓
2. Between check and transfer: fee market spikes
3. Transfer fails: not enough for actual fees
```

---

### SE-12: Unchecked Account Types in Several Contexts

**Location**: Multiple `/// CHECK:` comments
**Category**: Silent Failure
**Adversary**: The Scoundrel

```rust
// lib.rs:L2197-2199
/// CHECK: Current bidder (validated in instruction)
#[account(mut)]
pub bidder: AccountInfo<'info>,

// lib.rs:L2533-2535
/// CHECK: Treasury to receive dispute fees
#[account(mut)]
pub treasury: AccountInfo<'info>,
```

**The Sharp Edge**:
`AccountInfo` with `/// CHECK` comments are "trust me" markers. Each is a potential bypass if the instruction-level validation is incomplete.

**Pattern of Risk**:
| Location | Claimed Validation | Actual Risk |
|----------|-------------------|-------------|
| `SettleAuction.bidder` | "validated in instruction" | Not checked against listing.current_bidder |
| `OpenDispute.treasury` | "Treasury to receive..." | Not validated matches config |
| `Initialize.treasury` | "Treasury wallet" | Zero validation |

---

## 4. Primitive vs Semantic APIs

### SE-13: Pubkey Used for Multiple Semantic Types

**Location**: Throughout
**Category**: Primitive vs Semantic
**Adversary**: The Confused Developer

```rust
pub admin: Pubkey,           // Role: administrator
pub treasury: Pubkey,        // Role: fee recipient
pub backend_authority: Pubkey, // Role: verifier
pub seller: Pubkey,          // Role: listing owner
pub buyer: Pubkey,           // Role: purchaser
```

**The Sharp Edge**:
All roles are `Pubkey`. No type-level distinction prevents:
- Setting admin = treasury (same entity, different roles)
- Setting backend_authority = admin (centralization)
- Copying wrong field in client code

**Type Confusion Possible**:
```typescript
// Client code: easy to swap
await program.methods.initialize(500, 200, treasuryKey)  // Oops, wrong key!
  .accounts({ admin: backendKey, treasury: adminKey });  // Swapped!
```

**Recommendation (Rust newtype pattern)**:
```rust
#[derive(Clone, Copy)]
pub struct AdminKey(pub Pubkey);
#[derive(Clone, Copy)]
pub struct TreasuryKey(pub Pubkey);
// Now type system prevents swaps
```

---

### SE-14: Amount Used for Multiple Semantic Values

**Location**: Throughout
**Category**: Primitive vs Semantic
**Adversary**: The Confused Developer

```rust
pub amount: u64,        // In Escrow: total held
pub amount: u64,        // In Offer: offer amount
pub amount: u64,        // In PendingWithdrawal: refund amount
pub sale_price: u64,    // In Transaction: agreed price
pub platform_fee: u64,  // In Transaction: fee portion
pub seller_proceeds: u64, // In Transaction: seller portion
```

**The Sharp Edge**:
All monetary values are `u64`. Easy to:
- Mix up which "amount" you're reading
- Perform arithmetic on mismatched amounts
- Display wrong value to users

---

## 5. Zero/Empty/Null Edge Cases

### SE-15: reserve_price = Some(0) Behavior

**Location**: `lib.rs:L256-261`
**Category**: Zero Edge Case
**Adversary**: The Confused Developer

```rust
if let Some(reserve) = reserve_price {
    require!(starting_price == reserve, StartingPriceMustEqualReserve);
}
```

**The Sharp Edge**:
What does `reserve_price = Some(0)` mean?
- Free auction? (reserve is 0)
- Different from `reserve_price = None`? (no reserve)

**Actual Behavior**: `Some(0)` requires `starting_price = 0`, but `starting_price > 0` is required elsewhere, so this is implicitly blocked. But the intent is unclear.

---

### SE-16: Empty GitHub Username Handling

**Location**: `lib.rs:L275-284`
**Category**: Empty Edge Case
**Adversary**: The Confused Developer

```rust
if requires_github && !required_github_username.is_empty() {
    // Validation...
}
```

**The Sharp Edge**:
What does `requires_github = true` + `required_github_username = ""` mean?
- Require some GitHub account? (any user)
- No requirement? (validation skipped)

**Actual Behavior**: Empty string skips validation. So `requires_github = true` with empty string effectively means "requires nothing".

---

### SE-17: deadline = current_timestamp Behavior

**Location**: `lib.rs:L1222-1224`
**Category**: Edge Case
**Adversary**: The Scoundrel

```rust
require!(deadline > clock.unix_timestamp, InvalidDeadline);
```

**The Sharp Edge**:
`deadline = current_timestamp` (exact equality) is rejected. But what about:
- `deadline = current_timestamp + 1`? (1 second offer)
- Very short deadlines allow gaming

**Minimum Deadline Missing**:
```rust
// Should probably have:
require!(deadline >= clock.unix_timestamp + MIN_OFFER_DURATION, ...);
```

---

### SE-18: withdrawal_id = 0 Case

**Location**: `lib.rs:L516`
**Category**: Zero Edge Case
**Adversary**: The Confused Developer

```rust
withdrawal.withdrawal_id = listing.withdrawal_count;  // Starts at 1 after increment
```

**The Sharp Edge**:
`withdrawal_count` starts at 0, is incremented before use. So first `withdrawal_id` is 1.

But what if someone expects 0-indexed? PDA with `withdrawal_id = 0` would be:
```rust
seeds = [b"withdrawal", listing.key().as_ref(), &0u64.to_le_bytes()]
```

This PDA is never created but could be confused with the escrow or other PDAs.

---

## Threat Model Summary

### The Scoundrel (Malicious Actor)

| Sharp Edge | Exploit |
|------------|---------|
| SE-01 | Frontrun initialization, become admin |
| SE-04 | Collude to extend auction indefinitely |
| SE-11 | Time transaction to fail on fee spike |
| SE-17 | Create 1-second offers that expire before seller sees |

### The Lazy Developer (Copy-Paste Programmer)

| Sharp Edge | Misuse |
|------------|--------|
| SE-03 | Use placeholder backend authority |
| SE-06 | Reuse offer seeds, get PDA collision |
| SE-08 | Not know 30-day limit, set invalid duration |

### The Confused Developer (Misunderstands API)

| Sharp Edge | Mistake |
|------------|---------|
| SE-02 | Set 0% fees accidentally |
| SE-05 | Set treasury to program account |
| SE-07 | Use invalid GitHub username format |
| SE-13 | Swap admin/treasury keys |
| SE-16 | Set `requires_github = true` but empty username |

---

## Recommendations Summary

### High Priority (Pit of Success Violations)

1. **Add initialization access control** - First caller shouldn't automatically be admin
2. **Validate treasury account type** - Must be SOL-receivable
3. **Use semantic types for Pubkeys** - Prevent role confusion
4. **Add maximum auction extension** - Prevent infinite extension

### Medium Priority (Configuration Cliffs)

5. **Complete GitHub validation** - Follow actual GitHub rules
6. **Use counter-based offer seeds** - Prevent client confusion
7. **Add minimum offer duration** - Prevent gaming
8. **Improve error messages** - Include actual limits in messages

### Low Priority (Silent Failures)

9. **Emit events on stats overflow** - Don't silently cap
10. **Document zero-fee semantics** - Make intent clear
11. **Validate backend authority** - Ensure it's a real account
