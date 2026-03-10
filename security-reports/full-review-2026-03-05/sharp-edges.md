# Sharp Edges Analysis Report

**Date**: 2026-03-05  
**Target**: /home/user/App-Market  
**Focus**: Solana transactions, escrow logic, wallet verification, encryption, rate limiting, admin endpoints

---

## Overall Assessment: GOOD with minor sharp edges

The codebase demonstrates strong security-by-default patterns. Most APIs are well-designed with fail-closed behavior. The sharp edges identified are primarily in areas where developers extend the system.

---

## Sharp Edges Found

### SE-1: Webhook signature verify uses timingSafeEqual but doesn't reject zero-length secrets (MEDIUM)

**Location**: `app/api/webhooks/pool-graduation/route.ts:101-118`  
**Category**: Silent Failures / Dangerous Defaults

```typescript
const expectedSecret = process.env.WEBHOOK_SECRET;
if (!authHeader || !expectedSecret) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**Sharp edge**: `WEBHOOK_SECRET` is not in `env-validation.ts`, so there's no startup check. If unset, the webhook simply rejects all requests (fail-closed). However, the absence of startup validation means a misconfigured deployment silently loses webhook functionality with no alert.

**Recommendation**: Add `WEBHOOK_SECRET` to `env-validation.ts` with `required: true` in production.

---

### SE-2: Encryption API silently degrades to plaintext on non-key errors (MEDIUM)

**Location**: `lib/account-token-encryption.ts:22-29`  
**Category**: Silent Failures

The `encryptAccountTokens` function catches all errors and falls through to storing plaintext:

```typescript
} catch (error) {
  console.error("[Token Encryption] SECURITY WARNING: ...");
  // Token stored unencrypted
}
```

**Sharp edge**: While `getEncryptionSecret()` throws on missing key, other crypto failures (e.g., memory pressure, corrupt data) silently degrade. A developer adding new encrypted fields would inherit this fail-open pattern.

**Recommendation**: Throw on encryption failure in production. Only fall through for decryption (legacy data support).

---

### SE-3: `verifyWalletOwnership` uses includes() for nested prefix check (LOW)

**Location**: `lib/wallet-verification.ts:38`  
**Category**: Primitive vs. Semantic APIs

```typescript
if (!validPrefixes.some(prefix => message.startsWith(prefix) || message.includes(`\n${prefix}`)))
```

**Sharp edge**: `message.includes(\`\n${prefix}\`)` matches the prefix anywhere after a newline in the message. An attacker could craft a message with the prefix embedded after arbitrary content:

```
Malicious text here\nSign this message to prove you own this wallet
```

The `startsWith` check is strict, but the `includes` fallback is weaker. In practice, the signature itself binds the message to the wallet, limiting exploitability.

**Recommendation**: Use only `startsWith` checks, or validate the full message structure with a regex.

---

### SE-4: CSRF secret shares NEXTAUTH_SECRET by default (LOW)

**Location**: `lib/csrf.ts:19`  
**Category**: Configuration Cliffs

```typescript
const secret = process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET;
```

**Sharp edge**: Key reuse means compromise of one secret compromises both CSRF and session signing. While not a vulnerability itself, it reduces defense-in-depth.

**Recommendation**: Document that `CSRF_SECRET` should be set separately in production. Add to `env-validation.ts`.

---

### SE-5: Transaction state machine uses stringly-typed states (LOW)

**Location**: `lib/validation.ts:77-90`  
**Category**: Stringly-Typed Security

```typescript
const VALID_TRANSACTION_TRANSITIONS: Record<string, string[]> = {
  'PENDING': ['AWAITING_PARTNER_DEPOSITS', 'FUNDED', 'CANCELLED'],
  ...
};
```

**Sharp edge**: Transaction states are plain strings. A typo like `'COMPELTED'` instead of `'COMPLETED'` would silently fail the transition check with no type error. The Prisma enum enforces correctness at the DB level, but the state machine code doesn't benefit from TypeScript's type system.

**Recommendation**: Use TypeScript enum or const assertion for state names to get compile-time checking.

---

### SE-6: Backend authority keypair parsed from JSON env var (LOW)

**Location**: `lib/cron-helpers.ts:48`, `app/api/cron/expire-withdrawals/route.ts:43`

```typescript
const keypairBytes = JSON.parse(secretKeyJson);
```

**Sharp edge**: `BACKEND_AUTHORITY_SECRET_KEY` is a JSON array stored as an environment variable. If malformed, `JSON.parse` throws, which is caught — but the error message may leak the partial secret in logs via the default error handler.

**Recommendation**: Wrap in explicit try/catch with a sanitized error message. Consider base64 encoding instead of JSON for env vars.

---

### SE-7: Partner payment remainder goes to last partner (INFORMATIONAL)

**Location**: `lib/validation.ts:194-198`

```typescript
const amountLamports = isLast
  ? totalLamports - distributedLamports  // Last partner gets remainder
  : (totalLamports * BigInt(Math.round(Number(partner.percentage) * 100))) / BigInt(10000);
```

**Sharp edge**: The last partner in the array receives rounding remainders. If partner ordering changes, a different partner absorbs rounding dust. This is a standard approach but could surprise developers who assume fixed allocations.

**Status**: ACCEPTABLE — integer arithmetic prevents precision loss, remainder is dust-level.

---

### SE-8: Anti-snipe constants duplicated between contract and config (INFORMATIONAL)

**Location**: `lib/config.ts:273-275` vs `programs/app-market/src/lib.rs:54-56`

```typescript
// config.ts
antiSnipeMinutes: 15,
antiSnipeExtension: 15,
```
```rust
// lib.rs
pub const ANTI_SNIPE_WINDOW: i64 = 15 * 60;
pub const ANTI_SNIPE_EXTENSION: i64 = 15 * 60;
```

**Sharp edge**: Constants are duplicated across TypeScript and Rust. If one is changed without the other, the frontend will display incorrect auction extension times. The comment in config.ts notes this dependency but there's no compile-time or test-time enforcement.

**Recommendation**: Add an integration test that validates on-chain constants match off-chain config.

---

## Positive Security Patterns Observed

1. **Fail-closed secrets**: All critical secrets throw on missing (NEXTAUTH_SECRET, ENCRYPTION_SECRET, CRON_SECRET)
2. **Integer arithmetic for finances**: All fee calculations use BigInt/lamports, not floating-point
3. **Timing-safe comparisons**: All secret comparisons use `timingSafeEqual` with padding
4. **Nonce replay protection**: Atomic Redis SET NX prevents replay attacks
5. **Input validation with Zod**: Upload schema uses Zod for structured validation
6. **Admin double-gate**: Admin endpoints require both ADMIN_SECRET AND session isAdmin
7. **On-chain admin frontrunning protection**: `EXPECTED_ADMIN` constant prevents initialization attacks
8. **Fee caps on-chain**: `MAX_PLATFORM_FEE_BPS` prevents malicious fee rug
9. **Rate limiting fails closed in production**: Throws instead of falling back to in-memory

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 2 (encryption degradation, webhook secret validation) |
| LOW | 4 (wallet prefix check, CSRF key reuse, stringly-typed states, keypair JSON parsing) |
| INFORMATIONAL | 2 (partner remainder, constant duplication) |
| **Total** | **8** |
