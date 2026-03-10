# Property-Based Testing Analysis

**Date:** 2026-03-05
**Scope:** `/home/user/App-Market/lib/` -- config.ts, solana.ts, encryption.ts, csrf.ts, agent-auth.ts, validation.ts, wallet-verification.ts, vanity-keygen.ts, cron-helpers.ts
**Goal:** Identify functions and invariants that would benefit from property-based testing (e.g., fast-check), enumerate concrete properties, and highlight edge cases that random input generation would expose.

---

## Table of Contents

1. [Financial Calculations](#1-financial-calculations)
2. [Cryptographic Operations](#2-cryptographic-operations)
3. [Input Validation](#3-input-validation)
4. [State Machine Transitions](#4-state-machine-transitions)
5. [Serialization and Parsing](#5-serialization-and-parsing)
6. [Wallet Verification](#6-wallet-verification)
7. [Summary of Highest-Priority Properties](#7-summary)

---

## 1. Financial Calculations

**Files:** `lib/config.ts` (lines 293-371), `lib/solana.ts` (lines 117-179), `lib/validation.ts` (lines 186-211)

### 1.1 Lamport Conversion Roundtrip

Both `config.ts` and `solana.ts` contain independent `solToLamports` / `lamportsToSol` implementations. These use string-splitting to avoid floating-point multiplication errors.

**Property: SOL -> lamports -> SOL is identity for valid inputs**

```pseudo
forAll(sol: float where sol >= 0 and sol <= 1_000_000 and has_at_most_9_decimals(sol)):
  lamportsToSolNumber(solToLamportsBigInt(sol)) == sol
```

**Property: Lamports value is always a non-negative integer**

```pseudo
forAll(sol: float where sol >= 0):
  solToLamportsBigInt(sol) >= 0n
```

**Edge cases property testing would catch:**
- Negative SOL values: `solToLamportsBigInt(-1.5)` -- the string-split approach produces `BigInt("-1" + "500000000")` which is `BigInt("-1500000000")`. This is a correct negative value but the function does not guard against negatives. Property tests would reveal whether negative inputs are intentionally supported or silently produce wrong results.
- Zero: `solToLamportsBigInt(0)` should yield `0n`.
- Very large values: `solToLamportsBigInt(Number.MAX_SAFE_INTEGER)` -- the `.toString()` call is safe for integers but `Number.MAX_SAFE_INTEGER` is 9007199254740991 which as SOL is astronomically large. Property tests verify no overflow in bigint.
- Values with more than 9 decimal places: `solToLamportsBigInt(1.1234567891)` -- the `.slice(0, 9)` truncates, which is correct but silently loses precision. Tests would document this truncation behavior.
- Scientific notation: `solToLamportsBigInt(1e-10)` -- `(1e-10).toString()` produces `"1e-10"`, which the `.split(".")` approach cannot parse correctly. **This is a bug that property testing would catch.**

**Property: No precision loss in fee arithmetic**

```pseudo
forAll(sol: float where sol >= 0.000000001 and sol <= 1_000_000):
  result = calculateSellerProceeds(sol)
  result.fee + result.proceeds == sol
  // i.e., fee_lamports + proceeds_lamports == price_lamports exactly
```

This is the most important financial invariant: the platform must not create or destroy value during fee calculation.

**Implementation note:** In `config.ts:332`, `proceedsLamports = priceLamports - feeLamports`, so the invariant `feeLamports + proceedsLamports == priceLamports` holds in bigint. But the invariant can break after `lamportsToSolNumber()` converts back to `number`, because `Number(whole) + Number(remainder) / Number(LAMPORTS_PER_SOL_BI)` introduces floating-point error. Property testing would quantify this discrepancy.

### 1.2 Fee Rate Consistency

```pseudo
forAll(amount: posFloat, currency: oneOf("SOL", "APP", "USDC", undefined)):
  fee_config = config_calculatePlatformFee(amount, currency)
  fee_solana = solana_calculatePlatformFee(amount, currency)
  fee_config == fee_solana
  // Both files must agree
```

Both `config.ts` and `solana.ts` export `calculatePlatformFee` with duplicated logic. Property tests would catch any drift between them.

### 1.3 Partner Payment Distribution

**File:** `lib/validation.ts:186-211`

```pseudo
forAll(
  totalSol: posFloat,
  percentages: array(posFloat) where sum(percentages) == 100
):
  payments = calculatePartnerPayments(totalSol, partners_from(percentages))
  sum(payments.map(p => p.amountLamports)) == BigInt(Math.round(totalSol * 1e9))
  // Total distributed equals total available
```

**Property: No partner receives negative payment**

```pseudo
forAll(totalSol: posFloat, percentages: array(posFloat) where sum == 100):
  payments = calculatePartnerPayments(totalSol, partners)
  payments.every(p => p.amountLamports >= 0n)
```

**Edge cases:**
- Single partner with 100%: should receive the full amount.
- Many partners with tiny percentages: rounding accumulation could cause the last partner (who gets the remainder) to receive a negative amount if rounding inflated earlier payments. The current code at line 197 gives the last partner `totalLamports - distributedLamports`, which could go negative.
- **Bug potential:** `BigInt(Math.round(totalAmountSol * Number(LAMPORTS_PER_SOL)))` at line 191 uses floating-point multiplication before `Math.round`, while the other conversion functions use string-splitting. This inconsistency means `calculatePartnerPayments` can produce a different total than `solToLamportsBigInt(totalAmountSol)`. Property tests would catch this discrepancy.
- Percentages that don't sum to exactly 100 (e.g., 33.33, 33.33, 33.34): the code does not validate this.
- Zero total amount.
- Zero percentage for a partner.

### 1.4 Revenue Distribution

```pseudo
forAll(revenue: posFloat):
  dist = getRevenueDistribution(revenue)
  dist.operations + dist.treasury + dist.buyback == revenue
  // (approximately -- floating-point)
```

**Note:** `getRevenueDistribution` uses plain floating-point division (`revenue * 50 / 100`), NOT the bigint approach used for fees. Property tests would reveal floating-point precision loss here for values like `revenue = 0.1` where `0.1 * 50 / 100 + 0.1 * 30 / 100 + 0.1 * 20 / 100` should equal `0.1` but may not.

### 1.5 Buyback Amount

```pseudo
forAll(revenue: posFloat):
  buyback = calculateBuybackAmount(revenue)
  buyback >= 0
  buyback <= revenue
```

### 1.6 Token Unit Conversion Roundtrip

**File:** `lib/solana.ts:277-289`

```pseudo
forAll(amount: posFloat, currency: oneOf("SOL", "APP", "USDC")):
  fromTokenUnits(toTokenUnits(amount, currency).toNumber(), currency) ~= amount
  // Within rounding tolerance for the currency's decimal count
```

**Edge case:** `toTokenUnits` uses the same string-split approach with variable `decimals` (9 for SOL/APP, 6 for USDC). Scientific notation inputs like `1e-7` for USDC would break parsing.

### 1.7 Token Launch Allocation

```pseudo
forAll(supply: bigint where supply > 0):
  allocation = calculateTokenLaunchAllocation(supply)
  allocation >= 0n
  allocation <= supply
  allocation == (supply * 100n) / 10000n  // 1% exactly
```

---

## 2. Cryptographic Operations

### 2.1 Encryption Roundtrip (AES-256-GCM)

**File:** `lib/encryption.ts`

**Property: encrypt then decrypt is identity**

```pseudo
forAll(plaintext: string, aad: option(string)):
  decrypt(encrypt(plaintext, aad), aad) == plaintext
```

**Property: Different plaintexts produce different ciphertexts (with overwhelming probability)**

```pseudo
forAll(a: string, b: string where a != b):
  encrypt(a) != encrypt(b)
  // Due to random salt and IV, even encrypt(a) != encrypt(a)
```

**Property: Ciphertext is not malleable -- any bit flip causes decryption failure**

```pseudo
forAll(plaintext: string):
  ciphertext = encrypt(plaintext)
  forAll(bitPosition: nat where bitPosition < ciphertext.length):
    tampered = flipBit(ciphertext, bitPosition)
    decrypt(tampered) throws Error
```

**Property: AAD mismatch causes decryption failure**

```pseudo
forAll(plaintext: string, aad1: string, aad2: string where aad1 != aad2):
  ciphertext = encrypt(plaintext, aad1)
  decrypt(ciphertext, aad2) throws Error
```

**Property: Encrypted output always starts with "enc:v1:" prefix**

```pseudo
forAll(plaintext: string):
  encrypt(plaintext).startsWith("enc:v1:")
```

**Property: looksEncrypted correctly identifies encrypted data**

```pseudo
forAll(plaintext: string):
  looksEncrypted(encrypt(plaintext)) == true

forAll(plaintext: string where !plaintext.startsWith("enc:v1:")):
  // May or may not return true for legacy format heuristic
  // But never false-positive identifies short random strings
```

**Edge cases:**
- Empty string: `encrypt("")` should roundtrip correctly.
- Very long strings (megabytes): tests verify no buffer size issues.
- Binary-like content (null bytes, high unicode): the `utf8` encoding in `cipher.update` handles this, but property tests would verify.
- Plaintext that looks like base64 or starts with "enc:v1:": roundtrip must still work.

### 2.2 CSRF Token Generation and Verification

**File:** `lib/csrf.ts`

**Property: Generated token always verifies**

```pseudo
forAll(_ : unit):  // no input needed, just random generation
  token = generateCsrfToken()
  verifyCsrfToken(token) == true
```

**Property: Token format is three dot-separated parts**

```pseudo
forAll(_ : unit):
  token = generateCsrfToken()
  token.split(".").length == 3
```

**Property: Mutated tokens fail verification**

```pseudo
forAll(_ : unit):
  token = generateCsrfToken()
  forAll(mutation: stringMutation):
    verifyCsrfToken(mutation(token)) == false
    // (with overwhelming probability)
```

**Property: Expired tokens fail verification**

```pseudo
forAll(timestamp: int where Date.now() - timestamp > 8 * 60 * 60 * 1000):
  // Construct a token with old timestamp
  token = buildTokenWithTimestamp(timestamp)
  verifyCsrfToken(token) == false
```

**Edge cases:**
- Empty string: `verifyCsrfToken("")` should return false (line 46 handles this).
- Token with more than 3 dots: `parts.length !== 3` catches this.
- Token with timestamp at exactly the 8-hour boundary: off-by-one potential.
- Token with timestamp of `0` (epoch): the `parseInt(timestamp, 36)` at line 73 would produce a very old timestamp, correctly failing.
- Very long random value: the HMAC still works but could there be a length-extension issue? (No, HMAC is not vulnerable, but property tests document this.)
- **Timing-safe comparison padding:** The padding approach at lines 64-68 pads with null bytes. If `providedSignature` is longer than `expectedSignature`, the padded expected signature will have trailing `\0` bytes that won't match the extra characters. This is correct behavior but property tests would verify that no false positives occur with signatures of varying lengths.

### 2.3 Webhook Signature

**File:** `lib/agent-auth.ts:375-393`

**Property: sign then verify is identity**

```pseudo
forAll(payload: string, secret: string where secret.length > 0):
  sig = signWebhookPayload(payload, secret)
  verifyWebhookSignature(payload, sig, secret) == true
```

**Property: Wrong secret fails verification**

```pseudo
forAll(payload: string, secret1: string, secret2: string where secret1 != secret2):
  sig = signWebhookPayload(payload, secret1)
  verifyWebhookSignature(payload, sig, secret2) == false
```

**Property: Tampered payload fails verification**

```pseudo
forAll(payload: string, secret: string, tampered: string where payload != tampered):
  sig = signWebhookPayload(payload, secret)
  verifyWebhookSignature(tampered, sig, secret) == false
```

**Edge case:** `verifyWebhookSignature` at line 389 uses `timingSafeEqual` which throws if buffers differ in length. The `catch` on line 391 returns `false`, which is correct but masks the length-mismatch case. Property tests would verify this branch is exercised.

---

## 3. Input Validation

**File:** `lib/validation.ts`

### 3.1 URL Validation

```pseudo
forAll(url: string):
  if isValidUrl(url):
    new URL(url).protocol in ["http:", "https:"]

forAll(url: string with protocol not in ["http:", "https:"]):
  isValidUrl(url) == false

// Null/undefined are valid (optional fields)
isValidUrl(null) == true
isValidUrl(undefined) == true
isValidUrl("") == true  // falsy
```

**Edge cases:**
- `javascript:alert(1)` -- must return false.
- `data:text/html,...` -- must return false.
- `//evil.com` -- `new URL("//evil.com")` throws, so returns false. Good.
- `http://` (empty host) -- `new URL("http://")` throws in most runtimes.
- URLs with unicode domains, IDN homographs.
- `file:///etc/passwd` -- must return false.
- Very long URLs (megabytes): performance concern.
- `ftp://example.com` -- must return false.

### 3.2 Solana Address Validation

```pseudo
forAll(address: validBase58String where 32 <= address.length <= 44):
  isValidSolanaAddress(address) == true

forAll(address: string containing 0, O, I, or l):
  isValidSolanaAddress(address) == false

forAll(address: string where address.length < 32 or address.length > 44):
  isValidSolanaAddress(address) == false
```

**Property: All actual Solana public keys pass validation**

```pseudo
forAll(_ : unit):
  keypair = Keypair.generate()
  isValidSolanaAddress(keypair.publicKey.toBase58()) == true
```

**Edge cases:**
- Empty string: returns false (line 109).
- String of exactly 32 `1`s: valid base58, should pass. (`1` is valid base58 representing zero bytes.)
- String of exactly 44 valid base58 chars: should pass.
- String of 45 chars: should fail.
- String of 31 chars: should fail.
- Addresses with leading/trailing whitespace: no `.trim()` is called, so `" abc..."` fails. Is this intentional?

### 3.3 UUID Validation

```pseudo
forAll(uuid: validUUIDv4):
  isValidUUID(uuid) == true

forAll(s: string where !matchesUUIDPattern(s)):
  isValidUUID(s) == false
```

**Edge cases:**
- Uppercase UUIDs: the regex uses `/i` flag, so both cases pass.
- UUID v6/v7/v8: the regex restricts version digit to `[1-5]`, so v6+ would fail. This may be intentional but should be documented.
- Nil UUID `00000000-0000-0000-0000-000000000000`: fails because version digit is `0` (not in `[1-5]`) and variant nibble is `0` (not in `[89ab]`).

### 3.4 Pagination Sanitization

```pseudo
forAll(page: string | null, limit: string | null):
  result = sanitizePagination(page, limit)
  result.page >= 1
  result.limit >= 1
  result.limit <= 100
```

**Property: Non-numeric strings default safely**

```pseudo
forAll(garbage: string where parseInt(garbage) is NaN):
  sanitizePagination(garbage, garbage) == { page: 1, limit: 20 }
```

**Edge cases:**
- `sanitizePagination("0", "0")`: page becomes `max(1, 0) = 1`, limit becomes `min(100, max(1, 0))`. `parseInt("0") = 0`, then `max(1, 0) = 1`. So `{ page: 1, limit: 1 }`. The `|| 20` fallback only triggers for `NaN`, not `0`. But `max(1, 0) = 1` anyway. Correct.
- `sanitizePagination("-5", "999")`: page becomes `max(1, -5) = 1`, limit becomes `min(100, max(1, 999)) = 100`. Correct.
- `sanitizePagination("1.5", "10.9")`: `parseInt("1.5") = 1`, `parseInt("10.9") = 10`. Correct.
- `sanitizePagination("Infinity", "NaN")`: `parseInt("Infinity") = NaN`, fallback to `|| 1` = 1. Correct.

### 3.5 Message Validation

```pseudo
forAll(content: string where [...content].length <= 5000 and content.trim().length > 0):
  validateMessageContent(content).valid == true

forAll(content: string where [...content].length > 5000):
  validateMessageContent(content).valid == false
```

**Property: Grapheme-aware length counting**

```pseudo
forAll(emoji: singleEmoji):
  // A single emoji should count as 1 character regardless of UTF-16 code units
  validateMessageContent(emoji.repeat(5000)).valid == true
  validateMessageContent(emoji.repeat(5001)).valid == false
```

**Edge cases:**
- Content of only whitespace: `"   ".trim().length === 0`, so returns `{ valid: false }`. Correct.
- Content with null bytes: `"\0"` -- `trim()` does not remove null bytes, so this passes as valid. Is this intended?
- Very long single grapheme clusters (e.g., combining diacritical marks): `[..."a\u0300\u0301"]` counts as 3 elements, not 1 visual character. The spread operator does NOT do true grapheme segmentation; it splits on code points. This is a known limitation that property tests would document.
- Zero-width joiners in emoji sequences: `[..."👨‍👩‍👧‍👦"]` produces multiple code points, so an emoji family counts as 7 elements, not 1. Property tests would reveal this discrepancy.

### 3.6 Password Complexity Validation

```pseudo
forAll(password: string):
  result = validatePasswordComplexity(password)
  if result.valid:
    password.length >= 8
    password.length <= 128
    /[A-Z]/.test(password)
    /[a-z]/.test(password)
    /[0-9]/.test(password)
    /[^A-Za-z0-9\s]/.test(password)
```

**Property: Converse -- if all criteria met, result is valid**

```pseudo
forAll(password: string
  where password.length >= 8 and password.length <= 128
  and /[A-Z]/.test(password)
  and /[a-z]/.test(password)
  and /[0-9]/.test(password)
  and /[^A-Za-z0-9\s]/.test(password)
):
  validatePasswordComplexity(password).valid == true
```

**Edge cases:**
- Unicode letters: `"Abcdefg1!"` passes. But `"\u00C9bcdefg1!"` (E-acute as uppercase) -- does `/[A-Z]/` match it? No, `/[A-Z]/` only matches ASCII uppercase. So a password with only non-ASCII uppercase letters would fail the uppercase check. Property tests with unicode generators would catch this.
- Emoji as special character: `/[^A-Za-z0-9\s]/.test("Abcdefg1\u{1F600}")` is true. So emoji counts as a special character. Is this intended?

---

## 4. State Machine Transitions

**File:** `lib/validation.ts:77-90`

### 4.1 Terminal States Have No Outgoing Transitions

```pseudo
for state in ["COMPLETED", "REFUNDED", "CANCELLED"]:
  VALID_TRANSACTION_TRANSITIONS[state].length == 0
```

### 4.2 No State Transitions to Itself

```pseudo
forAll(state: key of VALID_TRANSACTION_TRANSITIONS):
  !VALID_TRANSACTION_TRANSITIONS[state].includes(state)
```

This property holds for the current definition. Property tests would guard against regressions.

### 4.3 All Target States Are Valid States

```pseudo
forAll(state: key of VALID_TRANSACTION_TRANSITIONS):
  forAll(target: VALID_TRANSACTION_TRANSITIONS[state]):
    target in keys(VALID_TRANSACTION_TRANSITIONS)
```

### 4.4 Every Non-Terminal State Has a Path to a Terminal State

```pseudo
forAll(state: key of VALID_TRANSACTION_TRANSITIONS where state not in terminals):
  reachable(state) intersect {"COMPLETED", "REFUNDED", "CANCELLED"} is non-empty
```

This is a critical safety property: no transaction should get stuck in a non-terminal state with no path forward. A BFS/DFS from each state verifies reachability.

**Analysis of current transitions:**

- `TRANSFER_PENDING -> [TRANSFER_IN_PROGRESS, CANCELLED, DISPUTED]`: Can reach CANCELLED directly. Can reach COMPLETED via TRANSFER_IN_PROGRESS. Can reach REFUNDED via DISPUTED. OK.
- `AWAITING_CONFIRMATION -> [COMPLETED, DISPUTED]`: Can reach COMPLETED directly. DISPUTED -> [COMPLETED, REFUNDED]. OK.
- All other states have direct paths to CANCELLED or REFUNDED.

### 4.5 isValidTransactionTransition Rejects Unknown States

```pseudo
forAll(fromState: string not in keys(VALID_TRANSACTION_TRANSITIONS),
       toState: arbitrary string):
  isValidTransactionTransition(fromState, toState) == false
```

The implementation at line 153 returns `false` if `validNextStates` is undefined. Correct.

### 4.6 Transition Asymmetry

```pseudo
// If A -> B is valid, B -> A should generally NOT be valid
// (no backward transitions in a pipeline)
forAll(a, b: states where isValidTransactionTransition(a, b)):
  !isValidTransactionTransition(b, a)
  // Exception: none in current definition (verify this holds)
```

**Analysis:** Checking for any symmetric pairs in the current definition:
- PENDING -> CANCELLED and CANCELLED -> nothing. OK.
- IN_ESCROW -> DISPUTED and DISPUTED -> COMPLETED/REFUNDED (no back-edge to IN_ESCROW). OK.

No symmetric pairs exist. Property tests would catch if one is accidentally introduced.

---

## 5. Serialization and Parsing

### 5.1 Base58 Encode/Decode Roundtrip

**Files:** `lib/agent-auth.ts`, `lib/wallet-verification.ts`, `lib/vanity-keygen.ts`

```pseudo
forAll(bytes: Uint8Array of length 32):
  bs58.decode(bs58.encode(bytes)) deepEquals bytes
```

```pseudo
forAll(keypair: Keypair):
  deserializeKeypair(serializeKeypair(keypair)).secretKey deepEquals keypair.secretKey
  deserializeKeypair(serializeKeypair(keypair)).publicKey deepEquals keypair.publicKey
```

**Edge cases:**
- All-zero bytes: `bs58.encode(new Uint8Array(32))` produces a string of `1`s (base58 leading-zero encoding). Roundtrip must preserve leading zeros.
- Maximum value bytes (all 0xFF): produces a long base58 string. Must roundtrip.
- Invalid base58 strings (containing `0`, `O`, `I`, `l`): `bs58.decode` should throw.

### 5.2 JSON.parse of Secret Key

**File:** `lib/cron-helpers.ts:48`

```pseudo
forAll(keypairBytes: array of 64 integers in 0..255):
  json = JSON.stringify(keypairBytes)
  parsed = JSON.parse(json)
  Keypair.fromSecretKey(Uint8Array.from(parsed)).secretKey deepEquals new Uint8Array(keypairBytes)
```

**Edge cases:**
- Malformed JSON: `getBackendAuthority()` catches parse errors and returns `null`. Property tests would verify this.
- Array of wrong length (not 64): `Keypair.fromSecretKey` will throw, caught by try/catch.
- Array containing non-integers, floats, negative numbers: `Uint8Array.from` will clamp/truncate. Property tests with adversarial arrays would reveal whether this silently produces wrong keys.
- Excessively large JSON string: performance/DoS concern.

### 5.3 Timestamp Base36 Encoding in CSRF

**File:** `lib/csrf.ts:33, 73`

```pseudo
forAll(timestamp: int where timestamp > 0):
  parseInt(timestamp.toString(36), 36) == timestamp
```

**Edge cases:**
- `Date.now()` returns milliseconds since epoch, currently ~1.7 trillion. `(1700000000000).toString(36)` = a valid base36 string. Roundtrip must be exact.
- Negative timestamps: `(-1).toString(36)` = `"-1"`, and `parseInt("-1", 36)` = `-1`. Should work but is meaningless for CSRF.

---

## 6. Wallet Verification

**Files:** `lib/wallet-verification.ts`, `lib/agent-auth.ts`

### 6.1 Valid Signature Verification

```pseudo
forAll(keypair: Keypair, message: string with valid format):
  signature = nacl.sign.detached(encode(message), keypair.secretKey)
  signatureB58 = bs58.encode(signature)
  publicKeyB58 = keypair.publicKey.toBase58()

  result = verifyWalletOwnership(publicKeyB58, signatureB58, message)
  result.valid == true
```

**Property: Wrong keypair fails**

```pseudo
forAll(keypair1: Keypair, keypair2: Keypair where keypair1 != keypair2, message: string):
  signature = nacl.sign.detached(encode(message), keypair1.secretKey)
  result = verifyWalletOwnership(keypair2.publicKey.toBase58(), bs58.encode(signature), message)
  result.valid == false
```

**Property: Tampered message fails**

```pseudo
forAll(keypair: Keypair, message: validMessage, tampered: string where tampered != message):
  signature = nacl.sign.detached(encode(message), keypair.secretKey)
  result = verifyWalletOwnership(keypair.publicKey.toBase58(), bs58.encode(signature), tampered)
  result.valid == false
```

### 6.2 Message Format Validation

`verifyWalletOwnership` (lines 34-38) requires messages to start with specific prefixes. Property tests should verify:

```pseudo
forAll(message: string not starting with valid prefixes):
  verifyWalletOwnership(validPubKey, validSig, message).valid == false
  verifyWalletOwnership(validPubKey, validSig, message).error contains "Invalid message format"
```

**Edge case:** The code checks `message.startsWith(prefix) || message.includes(\`\n${prefix}\`)`. An attacker could craft a message like `"Innocent text\nAccept collaboration for \"evil\""`. Property tests should verify whether this is exploitable -- it would pass the format check but might bind the wrong listing context.

### 6.3 Agent Auth Message Generation and Verification

```pseudo
forAll(timestamp: int, nonce: string):
  message = generateAuthMessage(timestamp, nonce)
  message.includes(timestamp.toString())
  message.includes(nonce)
  message.startsWith("AppMarket Agent Auth")
```

**Property: Nonce replay detection**

```pseudo
forAll(wallet: validAddress, nonce: string):
  // First use succeeds
  result1 = verifyWalletSignature(wallet, validSig, timestamp, nonce)
  // Second use with same nonce fails
  result2 = verifyWalletSignature(wallet, validSig, timestamp, nonce)
  result2.success == false
  result2.error contains "replay"
```

### 6.4 Timestamp Window Validation

**File:** `lib/agent-auth.ts:192`

```pseudo
forAll(skew: int where abs(skew) > 30000):
  timestamp = (Date.now() + skew).toString()
  result = verifyWalletSignature(wallet, sig, timestamp, nonce)
  result.success == false
  result.error contains "expired"

forAll(skew: int where abs(skew) <= 30000):
  // Should not fail due to timestamp
```

**Edge case:** Clock skew exactly at the 30-second boundary: `Math.abs(now - timestampNum) > 30000`. At exactly 30000ms, the check passes. At 30001ms, it fails. Property tests with boundary values would verify this.

### 6.5 Vanity Address Generation

**File:** `lib/vanity-keygen.ts`

```pseudo
forAll(suffix: validBase58String where suffix.length <= 3):
  keypair = grindVanityKeypair(suffix)
  keypair.publicKey.toBase58().endsWith(suffix)
  verifyVanitySuffix(keypair, suffix) == true
```

**Property: Invalid base58 characters in suffix cause error**

```pseudo
forAll(suffix: string containing 0, O, I, or l):
  grindVanityKeypair(suffix) throws Error
```

**Property: Serialize/deserialize preserves vanity property**

```pseudo
forAll(suffix: short validBase58String):
  keypair = grindVanityKeypair(suffix)
  restored = deserializeKeypair(serializeKeypair(keypair))
  verifyVanitySuffix(restored, suffix) == true
```

### 6.6 Referral Code Generation

**File:** `lib/wallet-verification.ts:86-88`

```pseudo
forAll(_ : unit):
  code = generateReferralCode()
  code.length == 16  // 8 bytes * 2 hex chars
  /^[0-9a-f]{16}$/.test(code)
```

**Property: Uniqueness (statistical)**

```pseudo
codes = Array.from({length: 10000}, generateReferralCode)
new Set(codes).size == 10000  // No collisions in 10k samples
```

---

## 7. Summary

### Highest-Priority Properties (Ranked by Financial/Security Impact)

| Priority | Area | Property | Risk if Violated |
|----------|------|----------|------------------|
| **P0** | Financial | `fee + proceeds == salePrice` (in lamports) | Money creation/destruction on every transaction |
| **P0** | Financial | Partner payments sum to total | Under/over-payment to partners |
| **P0** | Crypto | `decrypt(encrypt(x)) == x` for all x | Data loss of sensitive fields |
| **P0** | Crypto | AAD mismatch causes decryption failure | Cross-record ciphertext swapping |
| **P0** | Auth | Valid signatures verify; invalid signatures reject | Authentication bypass |
| **P1** | Financial | Revenue distribution sums to total | Accounting discrepancies |
| **P1** | State machine | All non-terminal states reach a terminal | Stuck transactions |
| **P1** | CSRF | Generated tokens always verify | Legitimate users blocked |
| **P1** | CSRF | Tampered tokens never verify | CSRF bypass |
| **P1** | Validation | Solana address validator accepts all real addresses | Users unable to register |
| **P2** | Serialization | Keypair serialize/deserialize roundtrip | Key loss |
| **P2** | Validation | Pagination always in bounds [1, 100] | DoS via large page sizes |
| **P2** | Validation | Message length uses grapheme-aware counting | Inconsistent limits |

### Critical Bugs That Property Testing Would Likely Discover

1. **Scientific notation in `solToLamportsBigInt`**: Passing `1e-10` (or any number that `toString()` renders in scientific notation) would cause `BigInt("1e-10")` to throw a `SyntaxError`. This affects `config.ts:295-299`, `solana.ts:119-122`, and `solana.ts:141-144`. The same bug exists in `toTokenUnits` at `solana.ts:279`.

2. **Inconsistent lamport conversion in `calculatePartnerPayments`**: Uses `BigInt(Math.round(totalAmountSol * 1e9))` (floating-point multiplication) instead of the string-splitting approach used everywhere else. For `totalAmountSol = 0.1`, `Math.round(0.1 * 1e9)` = `100000000` (correct), but for `totalAmountSol = 0.3`, `Math.round(0.3 * 1e9)` = `300000000` (correct by luck). Property tests with adversarial floats like `0.1 + 0.2` would expose cases where the two approaches diverge.

3. **Negative remainder for last partner**: In `calculatePartnerPayments`, if rounding causes `distributedLamports > totalLamports` before reaching the last partner, the last partner's `amountLamports` goes negative. This happens when individual percentage-based calculations round up. For example, 3 partners at 33.33% each: each gets `ceil(total * 0.3333)`, and the sum could exceed `total`.

4. **`getRevenueDistribution` floating-point drift**: When `autoBuyback.enabled` is true, the three percentages are 50+30+20=100, but `(revenue * 50) / 100 + (revenue * 30) / 100 + (revenue * 20) / 100` may not equal `revenue` for all float values. This is unlike the fee calculations which use bigint.

5. **`lamportsToSol` in solana.ts (line 125-128)**: Uses `value / LAMPORTS_PER_SOL` which is standard floating-point division, unlike `lamportsToSolNumber` which splits into whole + remainder. For large lamport values near `Number.MAX_SAFE_INTEGER`, this loses precision.

### Recommended Testing Framework

Use **fast-check** (TypeScript property-based testing library) with these generators:

- `fc.float({ min: 0, max: 1_000_000, noNaN: true })` for SOL amounts
- `fc.uint8Array({ minLength: 32, maxLength: 32 })` for keypair seed material
- `fc.unicodeString()` for message content and encryption plaintext
- `fc.array(fc.record({ percentage: fc.float({ min: 0, max: 100 }) }))` for partner splits
- `fc.constantFrom(...Object.keys(VALID_TRANSACTION_TRANSITIONS))` for state machine states
- Custom arbitraries for base58 strings (restricted character set)

---

*Report generated as part of full security review. No source code was modified.*
