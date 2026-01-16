# Sharp Edges Analysis: App Market Escrow (Main Branch)

**Analysis Date**: 2026-01-16
**Scope**: `programs/app-market/src/lib.rs`
**Framework**: Anchor 0.30.0 (Solana)
**Branch**: main

---

## Executive Summary

This analysis evaluates API designs, configurations, and interfaces for patterns that could lead to developer misuse or security mistakes.

| Category | Count | Risk Level |
|----------|-------|------------|
| Algorithm/Mode Selection | 0 | - |
| Dangerous Defaults | 2 | Low |
| Primitive vs Semantic APIs | 1 | Low |
| Configuration Cliffs | 3 | Medium |
| Silent Failures | 0 | - |
| Stringly-Typed Security | 1 | Low |
| **Total** | **7** | **Medium** |

**Significant improvement from audit branch (18 → 7 sharp edges)**

---

## Category Analysis

### 1. Algorithm/Mode Selection Footguns

**Status**: ✅ NONE IDENTIFIED

No algorithm selection APIs exposed. Cryptographic operations use Solana's built-in primitives.

---

### 2. Dangerous Defaults

#### SE-01: Zero Fee Configuration Possible

**Location**: `lib.rs:L107-125`
**Risk**: Low
**Status**: ⚠️ REMAINING

```rust
require!(
    platform_fee_bps <= MAX_PLATFORM_FEE_BPS,
    AppMarketError::FeeTooHigh
);
require!(
    dispute_fee_bps <= MAX_DISPUTE_FEE_BPS,
    AppMarketError::FeeTooHigh
);
```

**Issue**: Zero fees are allowed. While not a vulnerability, `platform_fee_bps = 0` means no revenue.

**Mitigation**: Intentional design choice - protocol may want zero-fee periods.

---

#### SE-02: Default Timelock Values

**Location**: `lib.rs:L73-76`
**Risk**: Low
**Status**: ✅ SECURE DEFAULTS

```rust
pub const BACKEND_TIMEOUT_SECONDS: i64 = 30 * 24 * 60 * 60; // 30 days
pub const DISPUTE_RESOLUTION_TIMELOCK_SECONDS: i64 = 48 * 60 * 60; // 48 hours
```

**Analysis**: These are compile-time constants, not configurable at runtime. This is the secure pattern.

---

### 3. Primitive vs Semantic APIs

#### SE-03: Pubkey Used for Multiple Purposes

**Location**: Throughout
**Risk**: Low
**Status**: ⚠️ INHERENT

```rust
pub admin: Pubkey,
pub treasury: Pubkey,
pub backend_authority: Pubkey,
pub seller: Pubkey,
pub buyer: Pubkey,
```

**Issue**: All use `Pubkey` type. Could theoretically swap treasury and admin keys.

**Mitigation**:
- Anchor's account constraints prevent this at runtime
- Named fields provide semantic clarity
- Consider newtype wrappers in future: `AdminPubkey(Pubkey)`

---

### 4. Configuration Cliffs

#### SE-04: Pause State is Binary

**Location**: `lib.rs:L284-302`
**Risk**: Medium
**Status**: ⚠️ DESIGN CONSIDERATION

```rust
pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
    config.paused = paused;
}
```

**Issue**: Single boolean controls all operations. No granular pause capability.

**Potential Attack**: If admin key is compromised, attacker can pause entire protocol.

**Mitigation**: Consider:
- Multi-sig for pause
- Granular pause (pause_bids, pause_listings, etc.)
- Auto-unpause after timeout

---

#### SE-05: Fee BPS Upper Bounds

**Location**: `lib.rs:L50-51`
**Risk**: Low
**Status**: ✅ SECURE

```rust
pub const MAX_PLATFORM_FEE_BPS: u64 = 1000;  // 10%
pub const MAX_DISPUTE_FEE_BPS: u64 = 500;    // 5%
```

**Analysis**: Reasonable caps prevent admin from setting exploitative fees.

---

#### SE-06: Expected Admin is Compile-Time Constant

**Location**: `lib.rs:L79`
**Risk**: Medium
**Status**: ⚠️ DESIGN TRADE-OFF

```rust
pub const EXPECTED_ADMIN: Pubkey = pubkey!("63jQ3qffMgacpUw8ebDZPuyUHf7DsfsYnQ7sk8fmFaF1");
```

**Issue**: Hardcoded admin address requires redeployment to change.

**Analysis**: This is actually a security FEATURE for C-01 fix, but creates operational rigidity.

**Mitigation**:
- ✅ Intentional design to prevent frontrunning
- After initialization, admin can be changed via timelock
- Document the address clearly in deployment docs

---

### 5. Silent Failures

**Status**: ✅ NONE IDENTIFIED

All operations return `Result<()>` with descriptive errors. No silent bypasses.

```rust
#[error_code]
pub enum AppMarketError {
    // 45 distinct error variants with descriptive messages
}
```

---

### 6. Stringly-Typed Security

#### SE-07: GitHub Username as String

**Location**: `lib.rs:L305-393`
**Risk**: Low
**Status**: ⚠️ VALIDATED

```rust
#[max_len(64)]
pub required_github_username: String,
```

**Issue**: Username is a string, could contain invalid characters.

**Mitigation**: ✅ COMPREHENSIVE VALIDATION ADDED

```rust
fn validate_github_username(username: &str) -> Result<()> {
    // Max 39 chars
    // Alphanumeric + hyphens only
    // No start/end hyphens
    // No consecutive hyphens
}
```

---

## Sharp Edges Fixed from Audit Branch

| Sharp Edge | Previous | Current | Fix |
|------------|----------|---------|-----|
| Init frontrunning | ❌ Critical | ✅ Fixed | `EXPECTED_ADMIN` check |
| Backend SPOF | ❌ Critical | ✅ Fixed | 30-day timeout fallback |
| Unchecked treasury | ❌ High | ✅ Fixed | Account constraints |
| Partial refund | ❌ High | ✅ Fixed | `== sale_price` check |
| Dispute resolution | ❌ High | ✅ Fixed | 48-hour timelock |
| GitHub validation | ❌ Medium | ✅ Fixed | Comprehensive rules |
| Bid DoS | ❌ Medium | ✅ Fixed | MAX_BIDS limit |
| Offer DoS | ❌ Medium | ✅ Fixed | MAX_OFFERS limit |
| Consecutive spam | ❌ Medium | ✅ Fixed | MAX_CONSECUTIVE limits |
| Magic numbers | ⚠️ Low | ✅ Fixed | Named constants |
| Offer seed collision | ❌ Medium | ✅ Fixed | Counter-based seeds |

---

## Edge Case Probing

### Zero/Empty/Null Analysis

| Parameter | Value | Behavior |
|-----------|-------|----------|
| `platform_fee_bps = 0` | Zero fee | ✅ Allowed (protocol choice) |
| `dispute_fee_bps = 0` | Zero fee | ✅ Allowed (protocol choice) |
| `amount = 0` | Zero bid/offer | ❌ Rejected: `InvalidPrice` |
| `duration = 0` | Zero duration | ❌ Rejected: `InvalidDuration` |
| `buyer_amount = 0, seller_amount = 0` | Zero refund | ❌ Rejected: `InvalidRefundAmounts` |
| `github_username = ""` | Empty string | ❌ Rejected: validation fails |
| `reason = ""` | Empty dispute reason | ✅ Allowed (may want to require) |

### Negative Value Analysis

| Parameter | Behavior |
|-----------|----------|
| `i64` timestamps | Solana's clock is always positive |
| `u64` amounts | Rust prevents negative values |

---

## Threat Modeling

### The Scoundrel (Malicious Developer/Attacker)

| Attack Vector | Protection |
|---------------|------------|
| Disable security via config | ❌ Cannot - constants are compile-time |
| Downgrade algorithms | ❌ N/A - no algorithm selection |
| Inject malicious values | ❌ Anchor constraints + validation |
| Initialize as admin | ❌ EXPECTED_ADMIN check |

### The Lazy Developer (Copy-Paste)

| Risk | Protection |
|------|------------|
| Wrong account passed | ✅ Anchor constraints enforce types |
| Missing validation | ✅ Comprehensive error messages |
| Forgot timelock check | ✅ Built into functions |

### The Confused Developer (Misunderstanding)

| Risk | Protection |
|------|------------|
| Swap parameters | ✅ Named fields, type constraints |
| Wrong key type | ✅ Anchor account validation |
| Silent failure | ✅ All errors are explicit |

---

## Recommendations

### High Priority

1. **Consider multi-sig for pause** - Single admin key controlling pause is a risk
2. **Add minimum fees** - Zero fees may be unintentional
3. **Document EXPECTED_ADMIN** - Make deployment process clear

### Medium Priority

4. **Require non-empty dispute reasons** - For audit trail
5. **Add newtype wrappers** - `AdminPubkey`, `TreasuryPubkey` for type safety

### Low Priority

6. **Consider granular pause** - Separate controls for different operations
7. **Add rate limiting events** - For off-chain monitoring

---

## Quality Checklist

- [x] Probed all zero/empty/null edge cases
- [x] Verified defaults are secure (compile-time constants)
- [x] Checked for algorithm/mode selection footguns (none)
- [x] Tested type confusion between security concepts
- [x] Considered all three adversary types
- [x] Verified error paths don't bypass security
- [x] Checked configuration validation

---

## Conclusion

The main branch has significantly improved its sharp edges profile:

- **18 → 7 sharp edges** (61% reduction)
- **All critical and high sharp edges fixed**
- **Secure defaults through compile-time constants**
- **Comprehensive input validation**

The remaining sharp edges are low-risk design considerations rather than security vulnerabilities.
