# Constant-Time Analysis Security Report

**Audit Date:** 2026-02-27
**Auditor:** Trail of Bits -- Constant-Time Analysis Skill
**Scope:** `/home/user/App-Market` (Next.js TypeScript application)
**Focus:** Timing side-channel vulnerabilities in cryptographic and authentication code

---

## Executive Summary

This audit analyzed the App Market codebase for timing side-channel vulnerabilities in cryptographic operations, secret comparisons, and authentication flows. The codebase demonstrates **strong security hygiene** for constant-time operations overall, with `crypto.timingSafeEqual` used consistently across critical authentication paths. However, **four findings** were identified, including two true positive vulnerabilities related to `Math.random()` usage in security-adjacent contexts, one informational finding about a length pre-check that leaks timing information, and one about a non-constant-time OAuth state comparison.

**Severity Breakdown:**
- Critical: 0
- High: 0
- Medium: 2
- Low: 2
- Informational / False Positives: 5

---

## Files Analyzed

| File | Purpose | Timing-Sensitive? |
|------|---------|-------------------|
| `middleware.ts` | Route protection, cron secret validation | Yes |
| `lib/auth.ts` | NextAuth config, session management | Yes |
| `lib/csrf.ts` | CSRF token generation & verification | Yes |
| `lib/agent-auth.ts` | API key auth, wallet signature auth, webhook HMAC | Yes |
| `lib/cron-auth.ts` | Cron job secret verification | Yes |
| `lib/wallet-verification.ts` | Solana wallet signature verification | Yes |
| `lib/encryption.ts` | AES-256-GCM encryption/decryption | Yes |
| `lib/account-token-encryption.ts` | OAuth token encryption at rest | Yes |
| `lib/webhooks.ts` | Webhook dispatch and event ID generation | Yes |
| `lib/store.ts` | Zustand client-side state | No |
| `lib/validation.ts` | Input validation, nonce tracking | Yes |
| `lib/sdk/client.ts` | SDK client authentication | Yes |
| `lib/sdk/utils.ts` | SDK webhook signature verification | Yes |
| `app/api/auth/register/route.ts` | User registration | Yes |
| `app/api/auth/wallet/verify/route.ts` | Wallet verification endpoint | Yes |
| `app/api/auth/twitter/connect/route.ts` | Twitter OAuth initiation | Yes |
| `app/api/auth/twitter/callback/route.ts` | Twitter OAuth callback | Yes |
| `app/api/webhooks/pool-graduation/route.ts` | Webhook secret verification | Yes |
| `app/api/admin/reset-listings/route.ts` | Admin secret verification | Yes |
| `app/api/cron/check-graduations/route.ts` | Cron secret verification | Yes |
| `app/api/cron/*.ts` (all cron routes) | Cron secret verification | Yes |
| `app/api/csrf/route.ts` | CSRF token endpoint | No |
| `app/api/github/verify/route.ts` | GitHub repo verification | No |
| `lib/rate-limit.ts` | Rate limiting | No |
| `lib/file-security.ts` | File type validation | No |

---

## Findings

### Finding 1: `Math.random()` Used for Webhook Event IDs (TRUE POSITIVE)

**Severity:** Medium
**Location:** `/home/user/App-Market/lib/webhooks.ts`, line 221

**Vulnerable Code:**
```typescript
function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
```

**Analysis:**
`Math.random()` is not cryptographically secure. It uses a PRNG (xorshift128+ in V8) seeded from a low-entropy source. While webhook event IDs are not directly used as secrets, predictable event IDs could enable:
- Event replay attacks if an attacker can predict the next event ID
- Event spoofing if IDs are used for deduplication

The `Date.now()` component further reduces entropy since timestamps are observable.

**Data Flow:**
`generateEventId()` -> `dispatchWebhookEvent()` -> webhook payload `id` field -> sent to external webhook endpoints.

**Recommended Fix:**
```typescript
import crypto from "crypto";

function generateEventId(): string {
  return `evt_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
}
```

---

### Finding 2: `Math.random()` Used for Username Deduplication Suffix (TRUE POSITIVE)

**Severity:** Low
**Location:** Multiple files:
- `/home/user/App-Market/lib/wallet-verification.ts`, line 143
- `/home/user/App-Market/app/api/auth/register/route.ts`, line 69

**Vulnerable Code (wallet-verification.ts):**
```typescript
const username = existingUser
  ? `${baseUsername}_${Math.random().toString(36).slice(2, 6)}`
  : baseUsername;
```

**Vulnerable Code (register/route.ts):**
```typescript
const username = existingUsername
  ? `${baseUsername}_${Math.random().toString(36).slice(2, 6)}`
  : baseUsername;
```

**Analysis:**
`Math.random()` produces only ~4 characters of base-36 entropy (~20.7 bits), generated from a predictable PRNG. While usernames are not secrets, the predictability could lead to:
- Username collision attacks (registering a username that a concurrent user will be assigned)
- Enumeration of user registration patterns

This is lower severity since usernames are public values, but using a CSPRNG is best practice.

**Recommended Fix:**
```typescript
import crypto from "crypto";

const username = existingUser
  ? `${baseUsername}_${crypto.randomBytes(3).toString("hex")}`
  : baseUsername;
```

---

### Finding 3: `Math.random()` for Client-Side Notification IDs (FALSE POSITIVE)

**Severity:** N/A (False Positive)
**Location:** `/home/user/App-Market/lib/store.ts`, line 78

**Code:**
```typescript
id: Math.random().toString(36).substring(7),
```

**Analysis:**
This is a client-side Zustand store generating IDs for local UI notifications. These IDs never leave the client, are never used for authentication or authorization, and have no security implications. **No fix needed.**

---

### Finding 4: Length Pre-Check Before `timingSafeEqual` in `cron-auth.ts` (TRUE POSITIVE -- Low)

**Severity:** Low
**Location:** `/home/user/App-Market/lib/cron-auth.ts`, lines 23-25

**Vulnerable Code:**
```typescript
if (authHeader.length !== expected.length) {
  return false;
}

try {
  return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
} catch {
  return false;
}
```

**Analysis:**
The length check on line 23 occurs before the constant-time comparison. This leaks the **exact length** of the `CRON_SECRET` through timing. An attacker can:
1. Send headers of varying lengths
2. Measure response times to determine the exact length of `Bearer {CRON_SECRET}`
3. Reduce the brute-force search space

Note: `crypto.timingSafeEqual` requires equal-length buffers, which is why the length check exists. But the mitigation should pad to equal length rather than reject early.

The same pattern occurs at `/home/user/App-Market/middleware.ts` line 113 and `/home/user/App-Market/app/api/admin/reset-listings/route.ts` line 27, and `/home/user/App-Market/app/api/webhooks/pool-graduation/route.ts` line 107.

**Contrast with the correct approach in `lib/csrf.ts` (lines 63-68):**
```typescript
// SECURITY: Pad both buffers to equal length before timing-safe comparison.
// A length pre-check would leak signature length info via timing side-channel.
const maxLen = Math.max(providedSignature.length, expectedSignature.length, 1);
const isValid = crypto.timingSafeEqual(
  Buffer.from(providedSignature.padEnd(maxLen, "\0")),
  Buffer.from(expectedSignature.padEnd(maxLen, "\0"))
);
```

**Recommended Fix (for cron-auth.ts):**
```typescript
export function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !authHeader) {
    return false;
  }

  const expected = `Bearer ${cronSecret}`;
  const maxLen = Math.max(authHeader.length, expected.length, 1);

  try {
    return timingSafeEqual(
      Buffer.from(authHeader.padEnd(maxLen, "\0")),
      Buffer.from(expected.padEnd(maxLen, "\0"))
    );
  } catch {
    return false;
  }
}
```

**Apply the same fix to:**
- `middleware.ts` lines 113-121
- `app/api/admin/reset-listings/route.ts` lines 27-38
- `app/api/webhooks/pool-graduation/route.ts` lines 107-108

**Practical Impact Note:** In practice, leaking the length of `Bearer {CRON_SECRET}` is low-severity because:
- The `Bearer ` prefix (7 chars) is already known, so only the secret's length is leaked
- Network jitter makes sub-millisecond timing differences hard to measure remotely
- These endpoints are rate-limited and behind middleware
- The cron secret is still required for authentication

Nevertheless, following the padding pattern already used in `csrf.ts` would close this gap entirely.

---

### Finding 5: Non-Constant-Time OAuth State Comparison (TRUE POSITIVE -- Medium)

**Severity:** Medium
**Location:** `/home/user/App-Market/app/api/auth/twitter/callback/route.ts`, line 61

**Vulnerable Code:**
```typescript
if (state !== oauthData.state) {
  return NextResponse.redirect(
    `${SITE_URL}/dashboard/settings?twitter_error=state_mismatch`
  );
}
```

**Analysis:**
The OAuth `state` parameter is compared with `!==` (JavaScript's standard string equality operator), which performs byte-by-byte comparison with early termination. The `state` value is a 16-byte (32 hex character) CSRF protection token generated by `crypto.randomBytes(16).toString("hex")`.

An attacker who can measure response timing with sufficient precision could theoretically determine matching prefix bytes of the `state` value, enabling a character-by-character brute-force of the CSRF state token.

**Data Flow:**
`crypto.randomBytes(16)` -> stored in encrypted cookie -> URL query parameter `state` -> compared with `!==`.

**Mitigating Factors:**
- The state is stored in an AES-256-GCM encrypted httpOnly cookie, which the attacker cannot read
- The state has a 10-minute expiry
- The state is single-use (cookie is deleted after callback)
- Network latency makes remote timing measurement difficult
- This is an OAuth flow requiring user interaction

Despite mitigations, using constant-time comparison is a defense-in-depth best practice.

**Recommended Fix:**
```typescript
import { timingSafeEqual } from "crypto";

// Replace:
// if (state !== oauthData.state) {
// With:
const stateMatch = state.length === oauthData.state.length &&
  timingSafeEqual(Buffer.from(state), Buffer.from(oauthData.state));

if (!stateMatch) {
  return NextResponse.redirect(
    `${SITE_URL}/dashboard/settings?twitter_error=state_mismatch`
  );
}
```

---

### Finding 6: CSRF Double-Submit Cookie Comparison Uses `!==` (FALSE POSITIVE)

**Severity:** N/A (False Positive)
**Location:** `/home/user/App-Market/lib/csrf.ts`, line 100

**Code:**
```typescript
if (cookieToken !== headerToken) {
  return { valid: false, error: "CSRF token mismatch" };
}
```

**Analysis:**
The CSRF double-submit pattern compares the cookie value with the header value. Both values are controlled by the client. The actual cryptographic validation (HMAC signature check) happens on the next line using `timingSafeEqual`. The `!==` check here is merely verifying that the client sent the same token in both places (cookie and header) -- if they don't match, no secret information is leaked since both values are already known to the attacker. **No fix needed.**

---

### Finding 7: Webhook Signature Verification in `agent-auth.ts` (POSITIVE -- Well-Protected)

**Location:** `/home/user/App-Market/lib/agent-auth.ts`, lines 353-364

**Code:**
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

**Analysis:**
This correctly uses `timingSafeEqual` for HMAC comparison. However, the `try/catch` will trigger if `signature` and `expected` have different byte lengths (since `timingSafeEqual` requires equal-length buffers). The differing-length rejection is non-constant-time, but since `expected` is always a SHA-256 hex digest (64 chars), an attacker learning that their signature was the wrong length reveals no useful information about the secret. **Acceptable as-is**, though the padding approach used in `csrf.ts` would be more rigorous.

---

### Finding 8: SDK Client-Side Webhook Verification (POSITIVE -- Custom Constant-Time)

**Location:** `/home/user/App-Market/lib/sdk/utils.ts`, lines 90-100

**Code:**
```typescript
// Constant-time comparison
if (signature.length !== expectedSignature.length) {
  return false;
}

let result = 0;
for (let i = 0; i < signature.length; i++) {
  result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
}

return result === 0;
```

**Analysis:**
This is a client-side SDK utility that implements a manual constant-time comparison using XOR accumulation. The approach is correct in principle -- it XORs all characters and checks the accumulated result. The length pre-check on line 91 leaks length information, but since `expectedSignature` is always 64 hex characters (SHA-256 output), this only confirms whether the attacker's signature is 64 chars, which is public knowledge. **Acceptable.**

Note: Since this runs in the SDK (client-side / consumer's environment), it cannot use Node.js `crypto.timingSafeEqual`. The implementation is correct for its context.

---

### Finding 9: API Key Verification via bcrypt (POSITIVE -- Well-Protected)

**Location:** `/home/user/App-Market/lib/agent-auth.ts`, lines 84-86, 120-127

**Code:**
```typescript
export async function verifyApiKeyHash(key: string, hash: string): Promise<boolean> {
  return bcrypt.compare(key, hash);
}
```

**Analysis:**
API key verification uses `bcrypt.compare()`, which is inherently constant-time (bcrypt always processes the full hash regardless of input). Combined with the bcrypt cost factor of 12, this provides strong protection against both timing and brute-force attacks. **No vulnerability.**

---

## Positive Findings (Well-Implemented Security)

The following areas demonstrate proper constant-time practices:

1. **CSRF Token Verification** (`lib/csrf.ts`): Uses `timingSafeEqual` with **buffer padding** to avoid length leakage -- the best implementation in the codebase.

2. **Cron Secret in Middleware** (`middleware.ts`): Uses `timingSafeEqual` (though with a length pre-check -- see Finding 4).

3. **Agent Webhook HMAC** (`lib/agent-auth.ts`): Uses `timingSafeEqual` for signature verification.

4. **API Key Hashing**: Uses bcrypt with cost factor 12, which is inherently constant-time and brute-force resistant.

5. **Session ID Generation** (`lib/auth.ts`): Uses `crypto.randomBytes(32)` -- 256 bits of CSPRNG entropy.

6. **CSRF Token Generation** (`lib/csrf.ts`): Uses `crypto.randomBytes(32)` for token randomness.

7. **Referral Code Generation**: Uses `crypto.randomBytes(8)` with 64 bits of entropy.

8. **Twitter PKCE**: Uses `crypto.randomBytes(32)` for code verifier and `crypto.randomBytes(16)` for state.

9. **Wallet Signature Verification**: Uses `nacl.sign.detached.verify()` which is constant-time by design (Ed25519).

10. **Encryption**: AES-256-GCM with `scryptSync` key derivation, random salts, and random IVs.

11. **Nonce Replay Protection** (`lib/validation.ts`): Uses atomic Redis `SET NX` to prevent nonce reuse across instances.

---

## Overall Risk Assessment

| Category | Assessment |
|----------|------------|
| **Secret Comparisons** | Strong. All critical paths use `timingSafeEqual` or bcrypt. |
| **HMAC Verification** | Strong. All HMAC checks use `timingSafeEqual`. |
| **Random Number Generation** | Good. All security-critical RNG uses `crypto.randomBytes()`. Minor `Math.random()` usage in non-critical paths. |
| **Key/Token Storage** | Strong. API keys use bcrypt, OAuth tokens use AES-256-GCM encryption at rest. |
| **Replay Protection** | Strong. Nonces tracked atomically via Redis, timestamps validated. |
| **Length Leakage** | Minor. Four locations use length pre-checks before `timingSafeEqual`, leaking secret length. |

**Overall Grade: B+**

The codebase shows strong awareness of timing side-channel attacks. The CSRF implementation in `lib/csrf.ts` is exemplary and should be used as the template for the remaining length-pre-check locations. The `Math.random()` usages in webhook event IDs should be upgraded to `crypto.randomBytes()`.

---

## Recommended Actions (Priority Order)

1. **[Medium]** Replace `Math.random()` with `crypto.randomBytes()` in `lib/webhooks.ts` `generateEventId()`.
2. **[Medium]** Add `timingSafeEqual` for OAuth state comparison in `app/api/auth/twitter/callback/route.ts`.
3. **[Low]** Apply buffer-padding pattern (from `lib/csrf.ts`) to `lib/cron-auth.ts`, `middleware.ts`, `app/api/admin/reset-listings/route.ts`, and `app/api/webhooks/pool-graduation/route.ts` to eliminate length leakage.
4. **[Low]** Replace `Math.random()` with `crypto.randomBytes()` in username generation in `lib/wallet-verification.ts` and `app/api/auth/register/route.ts`.

---

*Report generated by Trail of Bits Constant-Time Analysis Skill*
