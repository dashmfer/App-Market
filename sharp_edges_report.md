# Sharp Edges Analysis: App-Market

**Codebase**: Next.js marketplace with Solana blockchain integration, Privy auth, and escrow functionality
**Analysis Date**: 2026-03-01
**Scope**: lib/ utilities, API routes, configuration, cryptographic APIs, financial calculations

---

## Table of Contents

1. [Critical: Financial & Security](#1-critical-financial--security)
2. [API Design Footguns in lib/ Files](#2-api-design-footguns-in-lib-files)
3. [Configuration Cliffs](#3-configuration-cliffs)
4. [Dangerous Defaults](#4-dangerous-defaults)
5. [Cryptographic API Misuse Potential](#5-cryptographic-api-misuse-potential)
6. [Silent Failure Patterns in API Routes](#6-silent-failure-patterns-in-api-routes)
7. [Type Confusion Risks in Financial Calculations](#7-type-confusion-risks-in-financial-calculations)
8. [Auth Inconsistency Pattern](#8-auth-inconsistency-pattern)
9. [Summary & Severity Matrix](#9-summary--severity-matrix)

---

## 1. Critical: Financial & Security

### 1.1 Missing CSRF Protection on Financial Endpoints

**Severity**: CRITICAL
**Files**:
- `/home/user/App-Market/app/api/purchases/route.ts`
- `/home/user/App-Market/app/api/transactions/[id]/confirm/route.ts`
- `/home/user/App-Market/app/api/transactions/[id]/buyer-info/route.ts`
- `/home/user/App-Market/app/api/collaborators/[id]/respond/route.ts`
- `/home/user/App-Market/app/api/listings/[slug]/nda/route.ts`
- `/home/user/App-Market/app/api/listings/[slug]/collaborators/route.ts`

The `purchases/route.ts` POST endpoint handles Buy Now purchases (moving real money into escrow) but has **zero CSRF protection**. A malicious site could trigger a purchase on behalf of an authenticated user:

```typescript
// purchases/route.ts - POST handler
// No validateCsrfRequest call anywhere in the function
export async function POST(request: NextRequest) {
  const rateLimitResult = await (withRateLimitAsync('write', 'purchases'))(request);
  // ... proceeds directly to financial operations
```

Similarly, `transactions/[id]/confirm/route.ts` (which confirms asset transfer and moves the escrow state machine) has no CSRF check. This is arguably worse because it advances a transaction toward fund release.

**Impact**: An attacker could craft a page that auto-submits a purchase or transfer confirmation while a user is authenticated, causing unintended financial transactions.

### 1.2 Missing Upper Bound on Purchase Amounts

**Severity**: HIGH
**File**: `/home/user/App-Market/app/api/purchases/route.ts` (line 57)

The bids route validates `amount > MAX_BID_AMOUNT` (1M SOL cap), and the offers route uses a Zod schema with `.max(MAX_OFFER_AMOUNT)`, but the purchases route only checks:

```typescript
if (typeof amount !== 'number' || amount <= 0) {
```

There is no upper-bound check. An extremely large `amount` value (e.g., `Number.MAX_SAFE_INTEGER`) could flow into `calculatePlatformFee()` and `calculateSellerProceeds()`, potentially producing `Infinity` or corrupted financial records in the database.

### 1.3 Collaborator Percentage Validated After Listing Creation

**Severity**: HIGH
**File**: `/home/user/App-Market/app/api/listings/route.ts` (lines 538-548)

The listing is **created first** (line 456), and the collaborator percentage sum is validated **after**:

```typescript
const listing = await prisma.listing.create({ ... });  // Line 456 - listing exists now

if (hasCollaborators) {
  const totalCollaboratorPercentage = collaborators.reduce(...);
  if (totalCollaboratorPercentage > 100) {
    return NextResponse.json(
      { error: `Total collaborator percentage exceeds 100%` },
      { status: 400 }  // Returns error, but listing already exists in DB!
    );
  }
```

If the percentage exceeds 100%, the listing is left orphaned in the database with `PENDING_COLLABORATORS` status and no collaborators. This is not wrapped in a database transaction.

---

## 2. API Design Footguns in lib/ Files

### 2.1 Dual Fee Calculation Functions (config.ts vs solana.ts)

**Severity**: HIGH
**Files**: `/home/user/App-Market/lib/config.ts`, `/home/user/App-Market/lib/solana.ts`

Both files export identically-named functions that compute the same thing but with subtly different implementations:

| Function | `config.ts` | `solana.ts` |
|---|---|---|
| `getFeeRateBps()` | Exported at line 282 | Exported at line 131 |
| `calculatePlatformFee()` | Exported at line 309 | Exported at line 154 |
| `calculateSellerProceeds()` | Exported at line 323 | Exported at line 169 |
| `calculateDisputeFee()` | Exported at line 316 | Exported at line 162 |

The `config.ts` version of `calculateSellerProceeds` returns `{ fee, proceeds, feeBps, feePercent }` (4 fields), while the `solana.ts` version returns `{ fee, proceeds, feeBps }` (3 fields). A developer importing from the wrong module will get silently different behavior. Some routes import from `solana.ts`:

```typescript
// app/api/bids/route.ts
import { calculatePlatformFee } from "@/lib/solana";

// app/api/offers/[offerId]/accept/route.ts
import { calculatePlatformFee } from "@/lib/solana";
```

While config.ts says it is the "single source of truth." This is a classic footgun where the wrong import silently works but could produce divergent fee calculations if the two implementations ever drift.

### 2.2 `lamportsToSol` Precision Loss for Large Values

**Severity**: MEDIUM
**File**: `/home/user/App-Market/lib/solana.ts` (lines 125-128)

```typescript
export const lamportsToSol = (lamports: number | BN): number => {
  const value = typeof lamports === "number" ? lamports : lamports.toNumber();
  return value / LAMPORTS_PER_SOL;
};
```

`BN.toNumber()` silently loses precision for values exceeding `Number.MAX_SAFE_INTEGER` (2^53 - 1). For a Solana BN representing more than ~9,007,199 SOL in lamports, `toNumber()` will return an approximate value, making the resulting SOL amount incorrect. The newer `fromTokenUnits` function (line 285-289) has the same issue. While 9M SOL is a large amount, this is a marketplace handling real assets and escrow -- the precision boundary should be documented or enforced.

### 2.3 `encrypt()` AAD Parameter is Optional and Caller-Dependent

**Severity**: MEDIUM
**File**: `/home/user/App-Market/lib/encryption.ts` (line 48)

```typescript
export function encrypt(plaintext: string, aad?: string): string {
```

The `aad` (Additional Authenticated Data) parameter is optional. The comments correctly explain that AAD prevents cross-record ciphertext swaps, but nothing forces callers to use it. In `account-token-encryption.ts`, the `encryptAccountTokens` function calls `encrypt()` **without AAD**:

```typescript
// account-token-encryption.ts line 19
encrypted[field] = encrypt(encrypted[field]);  // No AAD!
```

This means encrypted OAuth tokens from one user account can be transplanted to another account record without detection. A database compromise that allows record modification could swap tokens between users undetected by the encryption layer.

### 2.4 `verifyWebhookSignature` Timing Side-Channel on Length Mismatch

**Severity**: LOW
**File**: `/home/user/App-Market/lib/agent-auth.ts` (lines 382-393)

```typescript
export function verifyWebhookSignature(
  payload: string, signature: string, secret: string
): boolean {
  const expected = signWebhookPayload(payload, secret);
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;  // Length mismatch throws, caught silently
  }
}
```

If `signature` and `expected` have different lengths, `timingSafeEqual` throws and the function returns `false` immediately. This leaks the exact length of the expected signature via timing. The CSRF module (`csrf.ts` line 65) correctly pads to equal length before comparison; this function does not. For HMAC-SHA256 hex output the expected length is always 64 chars, so this is low severity but is inconsistent with the security posture elsewhere.

---

## 3. Configuration Cliffs

### 3.1 Environment Validation Only Throws in Production

**Severity**: HIGH
**File**: `/home/user/App-Market/lib/env-validation.ts` (lines 136-141)

```typescript
if (process.env.NODE_ENV === "production") {
  throw new Error(
    `Environment validation failed with ${result.errors.length} error(s).`
  );
}
```

In development, missing required environment variables (including `ENCRYPTION_SECRET`, `CRON_SECRET`, `DATABASE_URL`) are logged to stderr but execution continues. This means a developer can run the entire application with broken encryption and auth, writing unencrypted tokens to the database. When this database is later accessed by a correctly-configured instance, decryption will fail silently (see section 5.2).

### 3.2 Solana Program ID Fallback to Hardcoded Devnet Address

**Severity**: HIGH
**File**: `/home/user/App-Market/lib/solana.ts` (lines 8-9)

```typescript
export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || "9udUgupraga6dj92zfLec8bAdXUZsU3FGNN3Lf8XGzog"
);
```

Similarly for `TREASURY_WALLET` (line 13) and `PLATFORM_TOKEN_MINT` (line 18). While `env-validation.ts` marks these as required in production, the code in `solana.ts` **always** provides a fallback. If the env validation is bypassed (e.g., imported after solana.ts), production code will silently use a devnet program ID, sending real transactions to the wrong program.

### 3.3 Privy Client Silently Null When Credentials Missing

**Severity**: MEDIUM
**File**: `/home/user/App-Market/lib/auth.ts` (lines 13-15)

```typescript
const privyClient = process.env.PRIVY_APP_ID && process.env.PRIVY_APP_SECRET
  ? new PrivyClient(process.env.PRIVY_APP_ID, process.env.PRIVY_APP_SECRET)
  : null;
```

If Privy credentials are missing, `privyClient` is `null`. The Privy authorize handler throws `"Privy is not configured on the server"` at line 239, but this is a runtime error. Neither `PRIVY_APP_ID` nor `PRIVY_APP_SECRET` appear in `env-validation.ts`, so the startup check will not catch this misconfiguration. Deploying without Privy credentials silently disables email/Twitter authentication with a confusing runtime error.

### 3.4 `PATO_DBC_CONFIG_KEY` and `PATO_FEE_CLAIMER_WALLET` Silent Null

**Severity**: LOW
**File**: `/home/user/App-Market/lib/config.ts` (lines 106-109)

```typescript
configKey: process.env.PATO_DBC_CONFIG_KEY || null,
feeClaimerWallet: process.env.PATO_FEE_CLAIMER_WALLET || null,
```

These are used for token launch functionality. If missing, they default to `null`, but there is no validation or warning. A token launch attempt with `null` configKey would fail at the blockchain level with an opaque error, far from where the misconfiguration actually is.

---

## 4. Dangerous Defaults

### 4.1 In-Memory Rate Limiting Silently Active in Non-Production

**Severity**: HIGH
**File**: `/home/user/App-Market/lib/rate-limit.ts`

The rate limiter falls back to in-memory storage when Upstash Redis is not configured. While it correctly refuses to fall back in production (line 127-129), the in-memory fallback in staging or preview environments provides **false security**: each serverless function instance has its own counter, so an attacker can bypass rate limits by distributing requests across instances.

The `checkAgentRateLimit` in `agent-auth.ts` has a different fallback that does NOT throw in production:

```typescript
// agent-auth.ts lines 348-365
const now = new Date();
const windowMs = 60 * 1000;
// Falls back to in-memory silently
```

This function uses the distributed check only if `isRateLimitingDistributed()` returns true, but otherwise falls back to an in-memory `Map` with no production guard.

### 4.2 Escrow Auto-Release Enabled by Default

**Severity**: MEDIUM
**File**: `/home/user/App-Market/lib/config.ts` (line 224)

```typescript
autoReleaseEnabled: true,
```

The auto-release feature is enabled by default with no environment variable override. If a buyer cannot access the platform (e.g., regional outage, account lockout), the 7-day auto-release timer will release funds to the seller without buyer confirmation. There is no configuration to disable this globally in an emergency without a code deployment.

### 4.3 Twitter Username Trusted from Client in Privy Auth

**Severity**: MEDIUM
**File**: `/home/user/App-Market/lib/auth.ts` (lines 410-419, 350, 366)

The Privy auth flow correctly extracts verified wallet addresses and emails from Privy's server-side claims (lines 266-278). However, the Twitter username is taken directly from the client-supplied `credentials.twitterUsername`:

```typescript
// Line 350 - New user creation
let username = credentials.twitterUsername  // Client-supplied, not verified by Privy
  || credentials.email?.split("@")[0]
  || `user_${Date.now().toString(36)}`;

// Line 366
twitterVerified: !!credentials.twitterUsername,  // Auto-verified based on existence!
```

A client can supply any Twitter username and it will be marked as `twitterVerified: true`. The update path (lines 410-419) at least checks for existing users with that Twitter handle, but the creation path (line 366) blindly trusts it.

---

## 5. Cryptographic API Misuse Potential

### 5.1 Legacy `looksEncrypted` Heuristic Allows False Positives

**Severity**: HIGH
**File**: `/home/user/App-Market/lib/encryption.ts` (lines 115-127)

```typescript
export function looksEncrypted(data: string): boolean {
  if (data.startsWith("enc:v1:")) {
    return true;
  }
  // Legacy format: heuristic check (will be removed after migration)
  try {
    const decoded = Buffer.from(data, "base64");
    return decoded.length > SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH;
    // = decoded.length > 32 + 16 + 16 = 64 bytes
  } catch {
    return false;
  }
}
```

Any base64 string that decodes to more than 64 bytes will be identified as "encrypted" by the legacy heuristic. This includes:
- Long JWT tokens
- Base64-encoded images
- Any sufficiently long base64 string

When `decryptAccountTokens` encounters such data, it will attempt to decrypt it, fail, log a warning, and **return the raw value**. But when `encryptAccountTokens` encounters it, it will skip encryption (thinking it's already encrypted), leaving the token stored in plaintext forever. The comment says "will be removed after migration" but until then, this is a data corruption vector.

### 5.2 Encryption Failure Falls Through to Plaintext Storage

**Severity**: HIGH
**File**: `/home/user/App-Market/lib/account-token-encryption.ts` (lines 17-29)

```typescript
try {
  if (!looksEncrypted(encrypted[field])) {
    encrypted[field] = encrypt(encrypted[field]);
  }
} catch (error) {
  // SECURITY: Log structured warning — token will be stored in plaintext
  console.error(`[Token Encryption] SECURITY WARNING: Failed to encrypt ${field}:`, error);
  if (process.env.NODE_ENV === "production") {
    console.error(`[Token Encryption] ALERT: ${field} stored UNENCRYPTED`);
  }
  // Falls through: token stored in PLAINTEXT
}
```

If `ENCRYPTION_SECRET` is misconfigured, rotated, or missing, the catch block logs a warning but **still stores the token in plaintext**. This fail-open behavior means:
1. A key rotation without re-encryption of existing data will result in new tokens stored plaintext.
2. Any transient encryption failure (e.g., Node.js crypto module issue) silently degrades to plaintext.
3. The only detection is a log line that may not trigger an alert.

### 5.3 No Key Rotation Support in encryption.ts

**Severity**: MEDIUM
**File**: `/home/user/App-Market/lib/encryption.ts`

The encryption module uses a single `ENCRYPTION_SECRET` for both encryption and decryption. There is no mechanism for key rotation: no version tag embedded in the ciphertext (beyond the `enc:v1:` prefix), no support for trying multiple keys, and no migration tooling. A key compromise requires:
1. Decrypt all existing data with old key
2. Re-encrypt with new key
3. Atomic deployment with new `ENCRYPTION_SECRET`

During the window between steps 2 and 3, any running instance with the old key will fail to decrypt new data and vice versa. The `decryptAccountTokens` function handles this by falling through to raw values, which compounds the problem.

### 5.4 scryptSync Called on Every Encrypt/Decrypt Operation

**Severity**: LOW (performance, not security)
**File**: `/home/user/App-Market/lib/encryption.ts` (line 18)

```typescript
function deriveKey(secret: string, salt: Buffer): Buffer {
  return scryptSync(secret, salt, KEY_LENGTH);
}
```

`scryptSync` is intentionally CPU-expensive (that's the point for password hashing). It is called synchronously on every encrypt and decrypt operation. For a high-traffic route that decrypts OAuth tokens on every request, this blocks the Node.js event loop. Combined with a fresh random salt per encryption, key derivation cannot be cached. Consider pre-deriving the key at startup if the salt were fixed, or using a KDF designed for key derivation from high-entropy secrets (HKDF) instead.

---

## 6. Silent Failure Patterns in API Routes

### 6.1 Fire-and-Forget Database Updates in agent-auth.ts

**Severity**: MEDIUM
**File**: `/home/user/App-Market/lib/agent-auth.ts` (lines 142-148)

```typescript
// Update last used timestamp (fire and forget)
prisma.apiKey.update({
  where: { id: matchedKey.id },
  data: {
    lastUsedAt: new Date(),
    totalRequests: { increment: 1 },
  },
}).catch(console.error);
```

The promise is not awaited and errors are swallowed by `console.error`. If the database is down or the query fails, the API key usage tracking silently stops working. More critically, if `matchedKey.id` is invalid (e.g., deleted between the find and update), the error is invisible.

### 6.2 Notification Failures Silently Swallowed

**Severity**: MEDIUM
**Files**: Multiple API routes

```typescript
// bids/route.ts line 208
await prisma.notification.create({ ... }).catch(console.error);

// purchases/route.ts line 266
}).catch(console.error);
```

Notification failures are caught and logged but not propagated. A buyer could place a winning bid and the seller never gets notified. While notifications are non-critical, a persistent database failure would silently break all notifications with no user-visible error.

### 6.3 Referral Record Creation Fails Silently

**Severity**: MEDIUM
**File**: `/home/user/App-Market/lib/wallet-verification.ts` (lines 196-209)

```typescript
if (referrerId) {
  try {
    await prisma.referral.create({ ... });
  } catch (error) {
    console.error("[Wallet Verification] Failed to create referral record:", error);
    // Don't fail the signup if referral creation fails
  }
}
```

If the referral record fails to create (e.g., unique constraint violation from a race condition), the user is created without the referral link. The referrer loses their commission permanently with no recourse. The user will not know their referral was not tracked.

### 6.4 Empty Catch Blocks in Multiple Routes

**Severity**: LOW
**Files**: Multiple files

Several routes use bare `catch {}` or `catch { return false; }` patterns:

```typescript
// webhooks/pool-graduation/route.ts lines 61, 116
} catch {

// token-launch/route.ts line 136
} catch {

// auth/twitter/callback/route.ts lines 55, 71
} catch { return false; }
```

These completely swallow errors including stack traces, making debugging impossible. Any error in these blocks (database failures, network issues, serialization errors) vanishes without a trace.

---

## 7. Type Confusion Risks in Financial Calculations

### 7.1 Prisma Decimal Fields Auto-Coerced Through Number()

**Severity**: HIGH
**Files**: Multiple API routes

Prisma stores monetary values as `Decimal` type, but throughout the codebase they are coerced to JavaScript `number` via `Number()`:

```typescript
// disputes/route.ts line 168
const disputeFee = calculateDisputeFee(Number(transaction.salePrice));

// disputes/[id]/route.ts lines 89-94
const disputeFeeAmount = Number(dispute.disputeFee || 0);
buyerRefund = Number(transaction.salePrice);
sellerPayout = Number(transaction.salePrice) * 0.5 - Number(transaction.platformFee) * 0.5;

// agent/offers/[id]/accept/route.ts lines 69-70
const platformFee = calculatePlatformFee(Number(offer.amount), offer.listing.currency);
const sellerProceeds = Number(offer.amount) - platformFee;
```

The dispute resolution path (disputes/[id]/route.ts) performs `Number(transaction.salePrice) * 0.5` -- floating-point multiplication on financial data. The fee calculation functions in both `config.ts` and `solana.ts` carefully use `BigInt` arithmetic to avoid this, but the dispute resolution bypasses these helpers entirely and performs raw floating-point math.

For a sale price of `0.3 SOL`:
```javascript
Number(0.3) * 0.5 = 0.15  // OK
Number(0.3) * 0.5 - Number(0.01) * 0.5 = 0.14500000000000002  // Precision loss
```

### 7.2 `calculatePartnerPayments` Uses `Math.round` for Lamport Conversion

**Severity**: MEDIUM
**File**: `/home/user/App-Market/lib/validation.ts` (line 191)

```typescript
const totalLamports = BigInt(Math.round(totalAmountSol * Number(LAMPORTS_PER_SOL)));
```

This converts SOL to lamports via `Math.round(sol * 1e9)`, reintroducing the exact floating-point issue the `solToLamportsBigInt` functions in both `config.ts` and `solana.ts` were designed to avoid. Those functions use string splitting to avoid multiplication. For example:

```javascript
Math.round(0.1 + 0.2) * 1e9 = 300000000  // Correct by luck
Math.round(1.005 * 1e9) = 1005000000     // Correct
Math.round(0.0000000001 * 1e9) = 0        // Truncated to zero!
```

Small partner percentage payments could round to zero lamports.

### 7.3 SOL-Denominated Functions Used for USDC Calculations

**Severity**: MEDIUM
**File**: `/home/user/App-Market/lib/solana.ts`

The `solToLamports` and `_solToLamportsBigInt` functions hardcode 9 decimal places (SOL precision). But USDC has 6 decimals. Both `calculatePlatformFee` and `calculateSellerProceeds` use `_solToLamportsBigInt`:

```typescript
export const calculatePlatformFee = (amount: number, currency?: string): number => {
  const feeBps = getFeeRateBps(currency);
  const amountLamports = _solToLamportsBigInt(amount);  // Always 9 decimals!
```

When `currency` is "USDC", the fee calculation pads to 9 decimals instead of 6, effectively multiplying the input by 10^9 instead of 10^6. The final division by 10^9 (`_lamportsToSolNumber`) corrects this for the **ratio** (fee percentage), so the output fee amount will be correct in SOL-equivalent units. However, this is semantically wrong and confusing: a USDC amount of `100.00` is internally represented as `100000000000` (100 billion) "lamports" even though USDC only has 6 decimal places. If any code path ever uses these intermediate lamport values for an on-chain USDC transfer, the amount will be 1000x too large.

The `toTokenUnits` function (line 277) correctly handles per-currency decimals, but the fee calculation functions do not use it.

---

## 8. Auth Inconsistency Pattern

### 8.1 Mixed Use of getServerSession vs getAuthToken

**Severity**: HIGH
**Files**: Multiple API routes

The codebase uses two different authentication methods across API routes:

**Routes using `getAuthToken`** (JWT + revocation check):
- `bids/route.ts`
- `listings/route.ts`
- `purchases/route.ts`
- `offers/route.ts`
- `offers/[offerId]/accept/route.ts`
- `messages/route.ts`
- `withdrawals/route.ts`
- `transfers/[id]/complete/route.ts`

**Routes using `getServerSession`** (no revocation check):
- `disputes/route.ts`
- `disputes/[id]/route.ts`
- `transactions/[id]/confirm/route.ts`
- `referrals/route.ts`
- `token-launch/route.ts`
- `admin/audit-logs/route.ts`
- `withdrawals/[withdrawalId]/claim/route.ts`
- `profile/upload-picture/route.ts`

The `getAuthToken` function in `auth.ts` (line 156) checks the session revocation blacklist:

```typescript
if (token?.sessionId && !(await isSessionNotRevoked(token.sessionId as string))) {
  return null;
}
```

But `getServerSession` does **not** check revocations. This means if an admin revokes a user's session (e.g., after account compromise), the user can still:
- Open and respond to disputes (financial resolution)
- Confirm asset transfers (advancing escrow state)
- Claim withdrawals (extracting funds)
- Launch tokens
- File reports

This defeats the purpose of the session revocation system for some of the most security-sensitive operations.

---

## 9. Summary & Severity Matrix

| # | Finding | Severity | Category |
|---|---------|----------|----------|
| 1.1 | Missing CSRF on purchases and transfer confirm | CRITICAL | Security |
| 1.2 | No upper bound on purchase amounts | HIGH | Financial |
| 1.3 | Collaborator % validated after listing created | HIGH | Data Integrity |
| 2.1 | Duplicate fee functions in config.ts vs solana.ts | HIGH | API Design |
| 2.2 | BN.toNumber() precision loss for large values | MEDIUM | Financial |
| 2.3 | encrypt() AAD parameter optional, unused for tokens | MEDIUM | Crypto |
| 2.4 | Webhook signature timing leak on length mismatch | LOW | Crypto |
| 3.1 | Env validation only throws in production | HIGH | Config |
| 3.2 | Solana program ID hardcoded devnet fallback | HIGH | Config |
| 3.3 | Privy client silently null | MEDIUM | Config |
| 3.4 | PATO config keys silently null | LOW | Config |
| 4.1 | Agent rate limit falls back to in-memory in prod | HIGH | Security |
| 4.2 | Auto-release enabled by default, no env override | MEDIUM | Design |
| 4.3 | Twitter username trusted from client claims | MEDIUM | Auth |
| 5.1 | Legacy looksEncrypted heuristic false positives | HIGH | Crypto |
| 5.2 | Encryption failure silently stores plaintext | HIGH | Crypto |
| 5.3 | No key rotation support | MEDIUM | Crypto |
| 5.4 | scryptSync blocks event loop per operation | LOW | Performance |
| 6.1 | Fire-and-forget API key usage tracking | MEDIUM | Reliability |
| 6.2 | Notification failures silently swallowed | MEDIUM | Reliability |
| 6.3 | Referral creation fails silently | MEDIUM | Financial |
| 6.4 | Empty catch blocks in multiple routes | LOW | Debugging |
| 7.1 | Dispute resolution uses raw floating-point math | HIGH | Financial |
| 7.2 | Partner payments use Math.round for lamports | MEDIUM | Financial |
| 7.3 | SOL-denominated functions used for USDC | MEDIUM | Financial |
| 8.1 | Mixed getServerSession vs getAuthToken | HIGH | Auth |

**Critical**: 1 finding
**High**: 10 findings
**Medium**: 11 findings
**Low**: 4 findings

### Recommended Priority Order

1. **Immediate**: Add CSRF to `purchases/route.ts` and `transactions/[id]/confirm/route.ts`
2. **Immediate**: Standardize all routes on `getAuthToken` (with revocation checks)
3. **This sprint**: Add upper-bound validation on purchase amounts
4. **This sprint**: Make `encryptAccountTokens` fail-closed in production (throw instead of storing plaintext)
5. **This sprint**: Remove legacy `looksEncrypted` heuristic or add `enc:v1:` prefix to all existing encrypted data
6. **This sprint**: Fix dispute resolution to use `BigInt`-based fee helpers instead of raw `Number() * 0.5`
7. **Next sprint**: Consolidate fee calculation functions to a single module
8. **Next sprint**: Add AAD to token encryption (requires data migration)
9. **Next sprint**: Fix `calculatePartnerPayments` to use string-based lamport conversion
10. **Backlog**: Add key rotation support to encryption module
