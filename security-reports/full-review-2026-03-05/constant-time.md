# Constant-Time Comparison & Timing Side-Channel Review

**Date:** 2026-03-05
**Scope:** All cryptographic comparisons, secret verification, and signature checks
**Verdict:** No critical timing vulnerabilities found. One medium-severity issue and several informational notes.

---

## Summary Table

| File | Mechanism | Constant-Time? | Severity | Verdict |
|------|-----------|----------------|----------|---------|
| `lib/csrf.ts` | `timingSafeEqual` with padEnd | Yes | -- | PASS |
| `lib/csrf.ts` | `cookieToken !== headerToken` (double-submit) | No (see note) | Info | ACCEPTABLE |
| `lib/cron-auth.ts` | `timingSafeEqual` with Buffer.alloc padding | Yes | -- | PASS |
| `middleware.ts` | `timingSafeEqual` with Buffer.alloc padding | Yes | -- | PASS |
| `app/api/admin/reset-listings/route.ts` | `timingSafeEqual` with Buffer.alloc padding | Yes | -- | PASS |
| `app/api/webhooks/pool-graduation/route.ts` | `timingSafeEqual` with Buffer.alloc padding | Yes | -- | PASS |
| `app/api/auth/twitter/callback/route.ts` | `timingSafeEqual` with Buffer.alloc padding | Yes | -- | PASS |
| `lib/agent-auth.ts` (API key) | `bcrypt.compare` | Yes | -- | PASS |
| `lib/agent-auth.ts` (wallet sig) | `nacl.sign.detached.verify` | Yes | -- | PASS |
| `lib/agent-auth.ts` (webhook sig) | `timingSafeEqual` **without** length padding | **No** | **Medium** | FAIL |
| `lib/wallet-verification.ts` | `nacl.sign.detached.verify` | Yes | -- | PASS |
| `lib/validation.ts` | No secret comparisons | N/A | -- | N/A |

---

## Detailed Findings

### 1. `lib/csrf.ts` -- PASS

**HMAC signature verification (line 65):**
```typescript
const maxLen = Math.max(providedSignature.length, expectedSignature.length, 1);
const isValid = crypto.timingSafeEqual(
  Buffer.from(providedSignature.padEnd(maxLen, "\0")),
  Buffer.from(expectedSignature.padEnd(maxLen, "\0"))
);
```

- Uses `timingSafeEqual` correctly.
- Pads both buffers to equal length with `padEnd`, preventing `timingSafeEqual` from throwing on length mismatch.
- The `Math.max(..., 1)` guard handles the edge case of two empty strings.
- No early return before the comparison that could leak information.
- The timestamp check happens *after* the HMAC verification, which is correct (expiry is not secret information).

**Double-submit cookie check (line 99):**
```typescript
if (cookieToken !== headerToken) {
  return { valid: false, error: "CSRF token mismatch" };
}
```

- This uses a non-constant-time `!==` comparison. However, this is **acceptable** because:
  - Both values are attacker-controlled (cookie and header). The attacker already knows both values they sent.
  - The real security gate is the HMAC verification on line 65, which IS constant-time.
  - No secret material is being compared here.

**Error messages:** Return distinct error strings ("Missing CSRF cookie", "Missing CSRF header", "CSRF token mismatch", "Invalid or expired CSRF token"). These leak *which* check failed. For CSRF double-submit this is acceptable -- the attacker controls both values, and distinguishing failures aids debugging without security cost.

---

### 2. `lib/cron-auth.ts` -- PASS

```typescript
const maxLen = Math.max(authHeader.length, expected.length);
const paddedAuth = Buffer.alloc(maxLen);
const paddedExpected = Buffer.alloc(maxLen);
Buffer.from(authHeader).copy(paddedAuth);
Buffer.from(expected).copy(paddedExpected);
const match = timingSafeEqual(paddedAuth, paddedExpected);
return match && authHeader.length === expected.length;
```

- `Buffer.alloc` zero-fills, so shorter input is padded with `\0`.
- `timingSafeEqual` runs on equal-length buffers -- no throw.
- The final `authHeader.length === expected.length` check ensures that a padded match with different original lengths is rejected. This length check happens *after* the constant-time comparison completes, so it does not create an early-return timing leak.
- The `try/catch` around the comparison returns `false` on any unexpected error. Uniform.

---

### 3. `middleware.ts` (cron route check) -- PASS

Lines 107-112 use the identical `Buffer.alloc` + `copy` + `timingSafeEqual` + post-hoc length check pattern as `cron-auth.ts`. Same analysis applies. No issues.

Error response is uniform: always `{ error: "Unauthorized" }` with 401.

---

### 4. `app/api/admin/reset-listings/route.ts` -- PASS

`validateAdminSecret()` at lines 27-38 uses the same `Buffer.alloc` padding pattern. Correct.

**Note on error messages:** The function returns `false` uniformly. The calling code returns `{ error: "Invalid admin secret" }` with 403. This is a single error path -- no information leakage about which check failed. Good.

---

### 5. `app/api/webhooks/pool-graduation/route.ts` -- PASS

Lines 108-115 use the same `Buffer.alloc` padding pattern. Correct.

Error response is uniform: always `{ error: "Unauthorized" }` with 401 for all failure modes (missing header, missing secret, comparison failure, exception).

---

### 6. `app/api/auth/twitter/callback/route.ts` -- PASS

Lines 82-91 use the same `Buffer.alloc` padding pattern for OAuth state verification. Correct.

The state parameter is a CSRF-like nonce, so constant-time comparison is good defense-in-depth even though the state is ephemeral.

---

### 7. `lib/agent-auth.ts` -- MIXED

#### 7a. API Key Verification (bcrypt) -- PASS

```typescript
export async function verifyApiKeyHash(key: string, hash: string): Promise<boolean> {
  return bcrypt.compare(key, hash);
}
```

- `bcrypt.compare` is inherently constant-time relative to the hash. The bcrypt algorithm always processes the full hash regardless of input correctness.
- Cost factor of 12 provides strong brute-force resistance (~250ms per comparison).
- The iteration over multiple keys with `break` on match (line 126) does leak *how many* keys were checked before finding a match, but this is negligible -- it only reveals ordinal position among keys sharing the same 12-character prefix, not any secret material.

#### 7b. Wallet Signature Verification (nacl) -- PASS

```typescript
const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
```

- `nacl.sign.detached.verify` (Ed25519) is constant-time by design in TweetNaCl.
- The public key is not secret (it's the wallet address), so even if verification timing varied, no secret would be leaked.
- Timestamp and nonce checks happen *before* signature verification, which is correct -- these are cheap fail-fast checks on non-secret data.

#### 7c. Webhook Signature Verification -- FAIL (Medium Severity)

```typescript
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = signWebhookPayload(payload, secret);
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
```

**Issue:** `timingSafeEqual` throws a `RangeError` if the two buffers have different lengths. When that happens, the `catch` block returns `false` immediately -- significantly faster than a successful constant-time comparison. This creates a **length oracle**: an attacker can determine the exact length of the expected HMAC signature by measuring response times.

In practice, the expected signature is always a 64-character hex string (SHA-256 HMAC hex digest), so the attacker likely already knows the length. However, if the `signature` input is anything other than 64 hex characters, the fast `catch` path reveals that the length was wrong. This is inconsistent with the padding approach used everywhere else in the codebase.

**Recommendation:** Apply the same `Buffer.alloc` + `copy` padding pattern used in `cron-auth.ts`, `middleware.ts`, and the other files:

```typescript
const maxLen = Math.max(signature.length, expected.length);
const paddedSig = Buffer.alloc(maxLen);
const paddedExpected = Buffer.alloc(maxLen);
Buffer.from(signature).copy(paddedSig);
Buffer.from(expected).copy(paddedExpected);
return timingSafeEqual(paddedSig, paddedExpected) && signature.length === expected.length;
```

**Mitigating factors:**
- The expected output is always 64 hex chars, which is publicly known (SHA-256 produces 256 bits = 64 hex chars).
- This function is for SDK/agent webhook verification (outbound), not for incoming webhook auth (which uses the correct padded pattern in `pool-graduation/route.ts`).
- Exploiting this would require precise network timing measurements, which is hard over the internet.

---

### 8. `lib/wallet-verification.ts` -- PASS

Both `verifyWalletOwnership` (line 48) and `verifyWalletSignature` (line 113) use `nacl.sign.detached.verify`, which is constant-time by design. No issues.

Error messages are uniform: both paths return `{ valid: false, error: "Invalid signature" }` or `{ success: false, error: "Invalid signature" }` on verification failure. The catch-all returns a generic "Verification failed". Good.

---

### 9. `lib/validation.ts` -- N/A

This file contains no secret comparisons. The `checkAndSetNonce` function uses Redis `SET NX` (atomic server-side operation) and in-memory `Map.has()` -- neither involves comparing secret material. The nonce key is derived from the wallet address and timestamp, both of which are attacker-known.

---

## Cross-Cutting Observations

### Padding Pattern Consistency

The codebase uses two distinct padding approaches:

1. **`Buffer.alloc` + `copy`** (used in `cron-auth.ts`, `middleware.ts`, `reset-listings/route.ts`, `pool-graduation/route.ts`, `twitter/callback/route.ts`): Zero-fills a buffer, then copies the source into it. Clean and correct.

2. **`padEnd` with `\0`** (used in `csrf.ts`): Pads the string with null characters before creating the buffer. Also correct, but stylistically different.

Both approaches are functionally sound. The `Buffer.alloc` + `copy` approach is slightly more robust because it handles binary data correctly (not just string data). Standardizing on one pattern would improve maintainability.

### Early Returns on Non-Secret Data

Several files return early on missing headers or missing environment variables before reaching the constant-time comparison. This is **correct** -- the presence/absence of a header is not secret information, and failing fast on obviously invalid requests is good practice.

### Error Message Uniformity

| File | Error Granularity | Assessment |
|------|-------------------|------------|
| `middleware.ts` | Uniform ("Unauthorized") | Good |
| `cron-auth.ts` | Returns `false` only | Good |
| `reset-listings/route.ts` | "Invalid admin secret" | Good (single message) |
| `pool-graduation/route.ts` | Uniform ("Unauthorized") | Good |
| `csrf.ts` | Distinct per failure mode | Acceptable (see analysis above) |
| `agent-auth.ts` | Distinct per failure mode | Acceptable (different auth methods need different guidance) |

---

## Vulnerabilities Summary

### MEDIUM: `lib/agent-auth.ts` -- `verifyWebhookSignature` lacks length padding (line 388-393)

- **Type:** Timing side-channel (length oracle)
- **Impact:** Attacker can determine the expected HMAC length via response timing differences.
- **Practical risk:** Low. The expected length (64 hex chars) is publicly known from the algorithm choice.
- **Fix:** Apply the `Buffer.alloc` + `copy` padding pattern already used elsewhere in the codebase.

### INFO: `lib/csrf.ts` -- Double-submit comparison uses `!==` (line 99)

- **Type:** Non-constant-time string comparison
- **Impact:** None. Both values are attacker-controlled; no secret is compared.
- **Fix:** No fix needed.

---

## Files Reviewed

- `/home/user/App-Market/lib/csrf.ts`
- `/home/user/App-Market/lib/cron-auth.ts`
- `/home/user/App-Market/lib/agent-auth.ts`
- `/home/user/App-Market/lib/wallet-verification.ts`
- `/home/user/App-Market/lib/validation.ts`
- `/home/user/App-Market/middleware.ts`
- `/home/user/App-Market/app/api/admin/reset-listings/route.ts`
- `/home/user/App-Market/app/api/webhooks/pool-graduation/route.ts`
- `/home/user/App-Market/app/api/auth/twitter/callback/route.ts` (discovered via grep)
