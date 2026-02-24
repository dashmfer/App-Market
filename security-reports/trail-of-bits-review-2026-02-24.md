# Trail of Bits Security Review — 2026-02-24

**Methodologies Applied:** Solana Vulnerability Scanner, Entry Point Analyzer, Sharp Edges Analysis, Variant Analysis
**Scope:** Smart contract (`programs/app-market/src/lib.rs`, 3,875 LOC) + full-stack TypeScript codebase
**Agents:** 4 parallel analyses, cross-validated findings

---

## Executive Summary

| Severity | Smart Contract | Web App | Total |
|----------|---------------|---------|-------|
| HIGH     | 2             | 2       | 4     |
| MEDIUM   | 5             | 7       | 12    |
| LOW      | 5             | 6       | 11    |
| **Total** | **12**       | **15**  | **27** |

The most critical finding is a **functional bug** in the smart contract where the `MakeOffer` instruction silently discards all offer-tracking state because the `listing` account is not marked `mut`. This completely disables the anti-DoS protections for offers. All three contract analysis agents independently flagged this as the #1 priority fix.

---

## Smart Contract Findings

### SC-1: HIGH — `MakeOffer` listing not marked `#[account(mut)]` — DoS protection bypass

**Location:** `lib.rs` line 2947 (`MakeOffer` struct), instruction body lines 1559-1581
**Found by:** All 3 contract agents (Solana Vuln Scanner, Entry Point Analyzer, Sharp Edges)

**Issue:** The `listing` field in `MakeOffer` is `Account<'info, Listing>` without `#[account(mut)]`. Anchor only persists changes to accounts marked `mut`. The instruction body mutates `listing.offer_count`, `listing.last_offer_buyer`, and `listing.consecutive_offer_count` — but none of these writes are persisted on-chain.

**Impact:**
- `MAX_OFFERS_PER_LISTING` (100) limit is completely non-functional
- `MAX_CONSECUTIVE_OFFERS` (10) limit is completely non-functional
- `offer_count` never increments, causing PDA seed collisions for multiple offers from the same buyer
- Offer spam DoS protection is entirely disabled

**Fix:**
```rust
// In MakeOffer struct, change:
pub listing: Account<'info, Listing>,
// To:
#[account(mut)]
pub listing: Account<'info, Listing>,
```

---

### SC-2: HIGH — `try_from_slice` on zeroed buffer in `buy_now` withdrawal creation

**Location:** `lib.rs` line 879
**Found by:** Sharp Edges Analysis

**Issue:** The `buy_now` path creates a `PendingWithdrawal` by deserializing an all-zeros buffer (`PendingWithdrawal::try_from_slice(&vec![0u8; space])`), then overwriting fields. This differs from `place_bid` (line 611) and `accept_offer` (line 1889), which correctly construct the struct and call `try_serialize`. The zeroed buffer lacks the Anchor discriminator, and Borsh deserialization from zeros may fail for certain field types.

**Impact:** `buy_now` transactions may fail entirely when there is a previous bidder who needs a refund withdrawal created. This would block buy-now purchases on active auctions.

**Fix:** Use the same pattern as `place_bid`:
```rust
let withdrawal = PendingWithdrawal {
    user: previous_bidder,
    listing: listing.key(),
    amount: old_bid,
    withdrawal_id: listing.withdrawal_count,
    created_at: clock.unix_timestamp,
    expires_at: clock.unix_timestamp + 3600,
    bump,
};
withdrawal.try_serialize(&mut &mut withdrawal_data[..])?;
```

---

### SC-3: MEDIUM — 11 unchecked u64 additions in balance comparisons

**Location:** Lines 660, 716, 1325, 1432, 1661, 1738, 1816, 2211, 2236, 2277, 2404
**Found by:** Sharp Edges, Solana Vuln Scanner

**Issue:** Balance guards use raw `+` (e.g., `escrow_balance >= withdrawal.amount + rent`). If `amount` were near `u64::MAX`, the addition wraps silently in release mode, producing a small number that passes the `>=` check.

**Exploitability:** Low-to-theoretical (amounts come from validated transfers), but violates defense-in-depth.

**Fix:** Replace all with `checked_add`:
```rust
escrow_balance >= withdrawal.amount.checked_add(rent).ok_or(AppMarketError::MathOverflow)?,
```

---

### SC-4: MEDIUM — 15+ unchecked i64 additions on timestamps

**Location:** Lines 156, 179, 212, 235, 359, 617, 885, 1200, 1246, 1306, 1895, 1976, 2078, 2115, 2162
**Found by:** Sharp Edges, Solana Vuln Scanner

**Issue:** Timestamp comparisons use raw `+` (e.g., `clock.unix_timestamp + ADMIN_TIMELOCK_SECONDS`). Overflow is impractical (Unix timestamps are ~1.7B, i64::MAX is ~9.2 quintillion), but inconsistent with the program's checked-arithmetic pattern elsewhere.

**Fix:** Use `checked_add` for consistency.

---

### SC-5: MEDIUM — Transaction accounts not PDA-constrained in 3 instructions

**Location:** `VerifyUploads` (line 2829), `EmergencyAutoVerify` (line 2841), `AdminEmergencyVerify` (line 2853)
**Found by:** Entry Point Analyzer, Solana Vuln Scanner

**Issue:** The `transaction` field is `#[account(mut)]` with no PDA seeds constraint. Any `Transaction` account owned by the program can be passed. While instruction-level checks (buyer/admin validation) prevent cross-user abuse, a compromised backend could verify uploads on any transaction.

**Fix:** Add PDA seeds:
```rust
#[account(
    mut,
    seeds = [b"transaction", listing.key().as_ref()],
    bump = transaction.bump
)]
pub transaction: Account<'info, Transaction>,
```

---

### SC-6: MEDIUM — `requires_github = true` with empty username logic ambiguity

**Location:** `lib.rs` lines 312, 376-377
**Found by:** Sharp Edges

**Issue:** If `requires_github = true` but `required_github_username = ""`, the `&&` condition skips validation entirely. The listing "requires GitHub" but has no specific username requirement — semantics are undefined.

**Fix:** Require non-empty username when `requires_github = true`:
```rust
if requires_github {
    require!(!required_github_username.is_empty(), AppMarketError::InvalidGithubUsername);
}
```

---

### SC-7: MEDIUM — `.unwrap()` on different field than `.is_some()` guard

**Location:** Lines 177-183 (`execute_treasury_change`), 233-239 (`execute_admin_change`), 2113 (`contest_dispute_resolution`), 2160-2179 (`execute_dispute_resolution`)
**Found by:** Sharp Edges

**Issue:** Code checks `config.pending_treasury.is_some()` then unwraps `config.pending_treasury_at` — a different field. If a future code path sets one without the other, this panics. Same pattern in dispute resolution.

**Fix:** Use `.ok_or()` on each field individually:
```rust
let proposed_at = config.pending_treasury_at.ok_or(AppMarketError::NoPendingChange)?;
```

---

### SC-8: MEDIUM — Raw i64 subtraction in anti-snipe and duration logic

**Location:** Lines 538 (`end_time - created_at`), 549 (`end_time - ANTI_SNIPE_WINDOW`)
**Found by:** Sharp Edges

**Issue:** Raw subtraction could wrap if `end_time < created_at` (clock drift/bug) or `end_time < ANTI_SNIPE_WINDOW` (small value).

**Fix:**
```rust
let duration = listing.end_time.checked_sub(listing.created_at).ok_or(AppMarketError::MathOverflow)?;
```

---

### SC-9: LOW — `FinalizeTransaction.seller` is `AccountInfo` not `Signer`

**Location:** `lib.rs` lines 2874-2879, instruction check at line 1278
**Found by:** All 3 contract agents

**Issue:** Uses `AccountInfo` with manual `is_signer` check instead of Anchor's `Signer<'info>` type. Functionally correct but fragile to refactoring.

---

### SC-10: LOW — No maximum deadline on offers

**Location:** `lib.rs` line 1514 (`make_offer`)
**Found by:** Sharp Edges

**Issue:** Only checks `deadline > clock.unix_timestamp`. A buyer could set `deadline = i64::MAX`, creating a perpetual offer that locks their funds forever.

---

### SC-11: LOW — Dispute PDA rent goes to caller, not initiator

**Location:** `lib.rs` line 3209 (`close = caller`)
**Found by:** Sharp Edges

**Issue:** The dispute initiator paid rent for the account, but on closure, rent goes to whoever executes the resolution (likely admin).

---

### SC-12: LOW — Listing and Transaction accounts never closeable

**Location:** No close instruction exists for `Listing` or `Transaction` PDAs
**Found by:** Sharp Edges

**Issue:** After terminal state, these accounts persist on-chain permanently, consuming rent. For a high-volume marketplace, this adds up.

---

### SC-13: LOW — `expire_offer` comment says "anyone can call" but code restricts to buyer

**Location:** `lib.rs` line 1694 (comment) vs line 1716 (code)
**Found by:** Entry Point Analyzer

**Issue:** Misleading documentation. Code is safer than documented, but a developer "fixing" to match the comment would introduce a vulnerability.

---

## Web App Findings (Variant Analysis)

### WA-1: HIGH — Agreement signing trusts client-supplied wallet address

**Location:** `app/api/transactions/[id]/agreements/route.ts` lines 172, 228-232
**Bug class:** Trusting Client-Supplied Identity (variant of the fixed Privy issue)

**Issue:** The `walletAddress` comes from `req.body` and is used to verify the signature, but is NOT validated against the authenticated user's actual wallet. A buyer could provide any wallet address they control to sign agreements.

**Fix:** Verify `walletAddress` matches the authenticated user's wallet (as done correctly in NDA signing at `app/api/listings/[slug]/nda/route.ts` line 229).

---

### WA-2: HIGH — Raw fetch() in seller-confirm transfer

**Location:** `app/dashboard/transfers/[id]/page.tsx` line 394
**Bug class:** Raw fetch() without CSRF

**Issue:** Uses raw `fetch()` for POST to `/api/transfers/[id]/seller-confirm`. The server has CSRF validation, so this call will be rejected. The `handleBuyerConfirm` function on line 421 of the same file correctly uses `apiFetch()`. This means the seller-confirm feature is likely broken.

**Fix:** Replace `fetch()` with `apiFetch()`.

---

### WA-3: MEDIUM — Listing unreserve TOCTOU race

**Location:** `app/api/listings/[slug]/reserve/route.ts` lines 209-225 (DELETE handler)
**Bug class:** TOCTOU (variant of the fixed listing reserve issue)

**Issue:** The POST handler correctly uses `updateMany` with atomic status guard, but the DELETE handler reads status then does a plain `.update()`. A concurrent request could unreserve a listing whose status changed between read and write.

**Fix:** Use `updateMany` with `where: { id: listing.id, status: "RESERVED" }`.

---

### WA-4: MEDIUM — Referral PATCH uses raw fetch()

**Location:** `app/dashboard/referrals/page.tsx` line 110

**Fix:** Replace `fetch()` with `apiFetch()`.

---

### WA-5: MEDIUM — 5 floating-point arithmetic issues on financial values

| Location | Operation | Fix |
|----------|-----------|-----|
| `app/api/disputes/[id]/route.ts:118-119` | `salePrice * 0.5` | Use BigInt |
| `app/api/transfers/[id]/complete/route.ts:242` | `proceeds * pct / 100` | Use BigInt (pattern exists in `lib/validation.ts`) |
| `app/api/transactions/[id]/partners/route.ts:152` | `salePrice * pct / 100` | Use BigInt |
| `lib/referral-earnings.ts:30-47` | `salePrice * bps / 10000` | Compute as single expression |
| `lib/meteora-dbc.ts:433-434` | Multi-step BPS conversion | Use `(amount * bps) / 10000` |

---

### WA-6: MEDIUM — Twitter disconnect missing rate limit

**Location:** `app/api/auth/twitter/disconnect/route.ts` line 9

**Fix:** Add `withRateLimitAsync('auth', 'twitter-disconnect')`.

---

### WA-7: LOW — Offer cancel TOCTOU race

**Location:** `app/api/offers/[offerId]/cancel/route.ts` lines 70-84

**Fix:** Use `updateMany` with `where: { id: offerId, status: "ACTIVE" }`.

---

### WA-8: LOW — Dispute response TOCTOU race

**Location:** `app/api/disputes/[id]/route.ts` lines 304-329

**Fix:** Use `updateMany` with status guard.

---

### WA-9: LOW — Admin reset listings missing rate limit

**Location:** `app/api/admin/reset-listings/route.ts` — triple-layer auth mitigates risk.

---

### WA-10: LOW — Profile image DELETE missing rate limit

**Location:** `app/api/user/profile/image/route.ts` line 134 — POST has it, DELETE doesn't.

---

### WA-11: LOW — Platform fee calculation uses float arithmetic

**Location:** `lib/solana.ts:138`, `lib/config.ts:290` — accepts `number` type for financial calculation.

---

## Passed Checks (No Issues Found)

### Solana Vulnerability Scanner — 6 Pattern Scan
- **Arbitrary CPI**: PASS — No raw `invoke`/`invoke_signed`. All CPI via Anchor typed wrappers.
- **Improper PDA Validation**: PASS — All bumps stored and reused correctly.
- **Missing Ownership Check**: PASS — All accounts use `Account<'info, T>` with automatic validation.
- **Missing Signer Check**: PASS — All privileged instructions require proper signers (one defense-in-depth gap noted in SC-9).
- **Sysvar Account Check**: PASS — All sysvar access via `Clock::get()`/`Rent::get()` syscalls.
- **Instruction Introspection**: PASS — Not used.

### Additional Cleared Items
- Account reinitialization: NOT POSSIBLE — all `init` accounts use deterministic PDA seeds.
- PDA seed collisions: NONE — unique prefixes per account type.
- Rent exemption: CORRECT — Anchor's `init` ensures rent-exempt minimum.
- Account closure: CORRECT — `close` attribute zeroes discriminator preventing revival.
- Escrow accounting: CORRECT — running balance properly maintained.
- State transition ordering: CORRECT — prerequisite checks enforce proper flow.

---

## Priority Remediation Order

### Immediate (before launch)
1. **SC-1**: Add `#[account(mut)]` to `MakeOffer` listing — offer DoS protection completely broken
2. **SC-2**: Fix `try_from_slice` in `buy_now` — potential buy-now functional failure
3. **WA-1**: Validate wallet ownership in agreement signing — identity spoofing
4. **WA-2**: Replace raw `fetch()` in seller-confirm — feature likely broken

### High Priority
5. **SC-3**: Replace 11 unchecked u64 additions with `checked_add`
6. **SC-5**: Add PDA seeds to transaction in 3 verify instructions
7. **WA-3**: Fix listing unreserve TOCTOU race
8. **WA-5**: Replace float arithmetic with BigInt in 5 financial calculations

### Standard Priority
9. **SC-4, SC-8**: Replace remaining unchecked arithmetic
10. **SC-6, SC-7**: Fix GitHub username ambiguity and unwrap mismatches
11. **WA-4, WA-6-WA-10**: CSRF, rate limiting, and minor TOCTOU fixes

### Future
12. **SC-10-SC-13**: Offer deadline caps, rent routing, account closure, doc fixes
