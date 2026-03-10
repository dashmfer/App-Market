# Property-Based Testing Opportunities Report

**Project:** App-Market
**Date:** 2026-03-06
**Scope:** Analysis of `lib/`, `middleware.ts`, `hooks/`, `app/api/` for property-based testing candidates

---

## 1. Serialization / Roundtrip Pairs

### 1.1 encrypt / decrypt (AES-256-GCM)

- **Location:** `lib/encryption.ts:48` (`encrypt`) and `lib/encryption.ts:86` (`decrypt`)
- **Pattern type:** Roundtrip
- **Priority:** HIGH
- **Property:** For all UTF-8 strings `s` and optional AAD `aad`, `decrypt(encrypt(s, aad), aad) === s`.
- **Additional properties:**
  - Ciphertexts are always prefixed with `"enc:v1:"`.
  - Two encryptions of the same plaintext produce different ciphertexts (randomized IV/salt).
  - Decryption with wrong AAD throws (authenticated encryption integrity).
  - Decryption of tampered ciphertext throws.
- **Test sketch:**
  ```ts
  fc.assert(
    fc.property(fc.fullUnicodeString(), fc.option(fc.string()), (plaintext, aad) => {
      process.env.ENCRYPTION_SECRET = "a".repeat(32);
      const ct = encrypt(plaintext, aad ?? undefined);
      expect(ct.startsWith("enc:v1:")).toBe(true);
      expect(decrypt(ct, aad ?? undefined)).toBe(plaintext);
    })
  );
  // Non-determinism property:
  fc.assert(
    fc.property(fc.fullUnicodeString(), (plaintext) => {
      process.env.ENCRYPTION_SECRET = "a".repeat(32);
      expect(encrypt(plaintext)).not.toBe(encrypt(plaintext));
    })
  );
  ```

### 1.2 encryptAccountTokens / decryptAccountTokens

- **Location:** `lib/account-token-encryption.ts:16` and `lib/account-token-encryption.ts:41`
- **Pattern type:** Roundtrip
- **Priority:** HIGH
- **Property:** For any record `data` with string fields `refresh_token`, `access_token`, `id_token`, and AAD `aad`: `decryptAccountTokens(encryptAccountTokens(data, aad), aad)` recovers the original token values.
- **Additional properties:**
  - Idempotence of encrypt: calling `encryptAccountTokens` twice does not double-encrypt (the `looksEncrypted` guard).
  - Non-token fields are passed through unchanged.
- **Test sketch:**
  ```ts
  fc.assert(
    fc.property(
      fc.record({
        refresh_token: fc.string(),
        access_token: fc.string(),
        id_token: fc.string(),
        otherField: fc.string(),
      }),
      fc.string(),
      (data, aad) => {
        process.env.ENCRYPTION_SECRET = "a".repeat(32);
        const encrypted = encryptAccountTokens(data, aad);
        const decrypted = decryptAccountTokens(encrypted, aad);
        expect(decrypted.refresh_token).toBe(data.refresh_token);
        expect(decrypted.access_token).toBe(data.access_token);
        expect(decrypted.id_token).toBe(data.id_token);
        expect(decrypted.otherField).toBe(data.otherField);
        // Idempotence:
        const doubleEncrypted = encryptAccountTokens(encrypted, aad);
        expect(decryptAccountTokens(doubleEncrypted, aad).refresh_token).toBe(data.refresh_token);
      }
    )
  );
  ```

### 1.3 serializeKeypair / deserializeKeypair

- **Location:** `lib/vanity-keygen.ts:85` and `lib/vanity-keygen.ts:92`
- **Pattern type:** Roundtrip
- **Priority:** MEDIUM
- **Property:** For any Solana `Keypair` `kp`, `deserializeKeypair(serializeKeypair(kp)).publicKey` equals `kp.publicKey` and the secret keys match byte-for-byte.
- **Test sketch:**
  ```ts
  fc.assert(
    fc.property(fc.constant(null), () => {
      const kp = Keypair.generate();
      const roundtripped = deserializeKeypair(serializeKeypair(kp));
      expect(roundtripped.publicKey.toBase58()).toBe(kp.publicKey.toBase58());
      expect(Buffer.from(roundtripped.secretKey)).toEqual(Buffer.from(kp.secretKey));
    })
  );
  ```

### 1.4 encodeBase64 / decodeBase64

- **Location:** `lib/sdk/utils.ts:14` and `lib/sdk/utils.ts:29`
- **Pattern type:** Roundtrip
- **Priority:** MEDIUM
- **Property:** For any `Uint8Array` `bytes`, `decodeBase64(encodeBase64(bytes))` produces a byte-identical array.
- **Test sketch:**
  ```ts
  fc.assert(
    fc.property(fc.uint8Array({ minLength: 0, maxLength: 1024 }), (bytes) => {
      const roundtripped = decodeBase64(encodeBase64(bytes));
      expect(roundtripped).toEqual(bytes);
    })
  );
  ```

### 1.5 looksEncrypted correctness

- **Location:** `lib/encryption.ts:121`
- **Pattern type:** Invariant (post-condition of encrypt)
- **Priority:** HIGH
- **Property:** `looksEncrypted(encrypt(s))` is always `true` for any string `s`. Conversely, `looksEncrypted` returns `false` for arbitrary short strings, JWTs (contain dots), URLs, etc.
- **Test sketch:**
  ```ts
  fc.assert(
    fc.property(fc.fullUnicodeString(), (s) => {
      process.env.ENCRYPTION_SECRET = "a".repeat(32);
      expect(looksEncrypted(encrypt(s))).toBe(true);
    })
  );
  // Negative:
  fc.assert(
    fc.property(fc.string({ minLength: 1, maxLength: 20 }), (s) => {
      // Short random strings should not look encrypted
      expect(looksEncrypted(s)).toBe(false);
    })
  );
  ```

---

## 2. Parsers

### 2.1 parseGitHubUrl (URL parser)

- **Location:** `lib/utils.ts:112`
- **Pattern type:** Roundtrip / invariant
- **Priority:** MEDIUM
- **Property:** For any valid GitHub URL of the form `https://github.com/{owner}/{repo}`, `parseGitHubUrl` returns non-null with the correct `owner` and `repo`. For any non-GitHub URL, it returns `null`.
- **Additional property:** If `parseGitHubUrl(url)` returns `{ owner, repo }`, then `isValidGitHubUrl(url)` should also be `true` (consistency between validator and parser).
- **Test sketch:**
  ```ts
  fc.assert(
    fc.property(
      fc.stringMatching(/^[a-zA-Z0-9_-]+$/),
      fc.stringMatching(/^[a-zA-Z0-9_.-]+$/),
      (owner, repo) => {
        const url = `https://github.com/${owner}/${repo}`;
        const result = parseGitHubUrl(url);
        expect(result).not.toBeNull();
        expect(result!.owner).toBe(owner);
        expect(result!.repo).toBe(repo.replace(/\.git$/, ""));
      }
    )
  );
  ```

### 2.2 parseWebhookPayload (structured parser)

- **Location:** `lib/sdk/utils.ts:125`
- **Pattern type:** Invariant (valid input accepted, invalid input rejected)
- **Priority:** MEDIUM
- **Property:** Any object with `id: string, type: string, timestamp: number, data: object` is accepted. Any object missing any of those fields throws. `null`, non-objects, and primitives throw.
- **Test sketch:**
  ```ts
  fc.assert(
    fc.property(
      fc.record({
        id: fc.string({ minLength: 1 }),
        type: fc.string({ minLength: 1 }),
        timestamp: fc.integer(),
        data: fc.object(),
      }),
      (payload) => {
        expect(() => parseWebhookPayload(payload)).not.toThrow();
        const parsed = parseWebhookPayload(payload);
        expect(parsed.id).toBe(payload.id);
        expect(parsed.timestamp).toBe(payload.timestamp);
      }
    )
  );
  ```

### 2.3 validateWalletSignatureMessage (message parser)

- **Location:** `lib/validation.ts:245`
- **Pattern type:** Invariant (format + temporal constraints)
- **Priority:** MEDIUM
- **Property:** Messages containing the expected prefix, a valid base58 wallet, and a recent timestamp pass validation. Messages with timestamps in the future or older than `maxAgeSeconds` are rejected. Messages with wallet mismatches are rejected.
- **Note:** Requires mocking Redis / in-memory nonce store for testability.

---

## 3. Normalization / Idempotence

### 3.1 sanitizePagination

- **Location:** `lib/validation.ts:128`
- **Pattern type:** Idempotence + bounds invariant
- **Priority:** MEDIUM
- **Property:** For any input strings `page` and `limit`:
  - `result.page >= 1` (always positive)
  - `1 <= result.limit <= 100` (clamped to MAX_PAGINATION_LIMIT)
  - Idempotent: `sanitizePagination(String(result.page), String(result.limit))` returns the same result.
- **Test sketch:**
  ```ts
  fc.assert(
    fc.property(fc.option(fc.string()), fc.option(fc.string()), (page, limit) => {
      const result = sanitizePagination(page ?? null, limit ?? null);
      expect(result.page).toBeGreaterThanOrEqual(1);
      expect(result.limit).toBeGreaterThanOrEqual(1);
      expect(result.limit).toBeLessThanOrEqual(100);
      // Idempotence:
      const again = sanitizePagination(String(result.page), String(result.limit));
      expect(again).toEqual(result);
    })
  );
  ```

### 3.2 sanitizeSearchQuery

- **Location:** `lib/validation.ts:137`
- **Pattern type:** Idempotence + length invariant
- **Priority:** LOW
- **Property:** Output length never exceeds `MAX_SEARCH_QUERY_LENGTH` (200). Applying sanitization twice gives the same result (idempotent after first trim+slice). `null` input returns `null`.
- **Test sketch:**
  ```ts
  fc.assert(
    fc.property(fc.option(fc.fullUnicodeString()), (query) => {
      const result = sanitizeSearchQuery(query ?? null);
      if (query === null || query === undefined) {
        expect(result).toBeNull();
      } else {
        expect(result!.length).toBeLessThanOrEqual(200);
        // Idempotence:
        expect(sanitizeSearchQuery(result)).toBe(result);
      }
    })
  );
  ```

### 3.3 generateSlug (string normalization)

- **Location:** `lib/utils.ts:63`
- **Pattern type:** Idempotence + invariant
- **Priority:** MEDIUM
- **Property:**
  - Output contains only `[a-z0-9-]`.
  - No leading or trailing hyphens.
  - Idempotent: `generateSlug(generateSlug(s)) === generateSlug(s)`.
- **Test sketch:**
  ```ts
  fc.assert(
    fc.property(fc.string(), (s) => {
      const slug = generateSlug(s);
      expect(slug).toMatch(/^[a-z0-9-]*$/);
      expect(slug).not.toMatch(/^-|-$/);
      expect(generateSlug(slug)).toBe(slug); // idempotent
    })
  );
  ```

### 3.4 getExtension + validateFile (file classification is total)

- **Location:** `lib/file-security.ts:61`
- **Pattern type:** Invariant (total function / partition)
- **Priority:** MEDIUM
- **Property:** For any filename string, `validateFile` returns a result where exactly one of: `allowed=false` (blocked), `allowed=true && warning=true` (warning), `allowed=true && warning=false` (safe). These three categories form a complete partition.
- **Test sketch:**
  ```ts
  fc.assert(
    fc.property(fc.string(), (filename) => {
      const result = validateFile(filename);
      // Must be a valid partition
      const isBlocked = !result.allowed && !result.warning;
      const isWarning = result.allowed && result.warning;
      const isSafe = result.allowed && !result.warning;
      expect([isBlocked, isWarning, isSafe].filter(Boolean).length).toBe(1);
    })
  );
  ```

---

## 4. Validators

### 4.1 isValidSolanaAddress

- **Location:** `lib/validation.ts:108`
- **Pattern type:** Invariant (accepted domain)
- **Priority:** HIGH
- **Property:** Only strings of length 32-44 matching base58 charset `[1-9A-HJ-NP-Za-km-z]` return `true`. All others return `false`. Never throws.
- **Test sketch:**
  ```ts
  fc.assert(
    fc.property(fc.string(), (addr) => {
      const result = isValidSolanaAddress(addr);
      expect(typeof result).toBe("boolean");
      if (result) {
        expect(addr.length).toBeGreaterThanOrEqual(32);
        expect(addr.length).toBeLessThanOrEqual(44);
        expect(addr).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
      }
    })
  );
  ```

### 4.2 isValidUUID

- **Location:** `lib/validation.ts:120`
- **Pattern type:** Invariant
- **Priority:** LOW
- **Property:** Only strings matching the UUID v1-v5 regex return `true`. Generated UUIDs (from `crypto.randomUUID()`) always pass.
- **Test sketch:**
  ```ts
  fc.assert(
    fc.property(fc.uuid(), (uuid) => {
      expect(isValidUUID(uuid)).toBe(true);
    })
  );
  fc.assert(
    fc.property(fc.string(), (s) => {
      // If it passes, it matches the pattern
      if (isValidUUID(s)) {
        expect(s).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      }
    })
  );
  ```

### 4.3 isValidUrl (safe protocol)

- **Location:** `lib/validation.ts:95`
- **Pattern type:** Invariant (safety constraint)
- **Priority:** HIGH
- **Property:** Only URLs with `http:` or `https:` protocol return `true`. `null`/`undefined` returns `true` (optional field). `javascript:`, `data:`, `ftp:` URLs return `false`. Never throws.
- **Test sketch:**
  ```ts
  fc.assert(
    fc.property(fc.webUrl(), (url) => {
      expect(isValidUrl(url)).toBe(true);
    })
  );
  fc.assert(
    fc.property(fc.string(), (s) => {
      const result = isValidUrl(s);
      expect(typeof result).toBe("boolean"); // never throws
    })
  );
  // Dangerous protocols rejected:
  expect(isValidUrl("javascript:alert(1)")).toBe(false);
  expect(isValidUrl("data:text/html,<h1>Hi</h1>")).toBe(false);
  ```

### 4.4 validatePasswordComplexity

- **Location:** `lib/validation.ts:216`
- **Pattern type:** Invariant
- **Priority:** MEDIUM
- **Property:** Any password that is `valid: true` has length 8-128, contains uppercase, lowercase, digit, and special character. Passwords shorter than 8 are always invalid.
- **Test sketch:**
  ```ts
  fc.assert(
    fc.property(fc.string({ minLength: 0, maxLength: 200 }), (pwd) => {
      const result = validatePasswordComplexity(pwd);
      if (result.valid) {
        expect(pwd.length).toBeGreaterThanOrEqual(8);
        expect(pwd.length).toBeLessThanOrEqual(128);
        expect(pwd).toMatch(/[A-Z]/);
        expect(pwd).toMatch(/[a-z]/);
        expect(pwd).toMatch(/[0-9]/);
        expect(pwd).toMatch(/[^A-Za-z0-9\s]/);
      }
      if (pwd.length < 8) {
        expect(result.valid).toBe(false);
      }
    })
  );
  ```

### 4.5 validateMessageContent

- **Location:** `lib/validation.ts:169`
- **Pattern type:** Invariant (length constraint)
- **Priority:** LOW
- **Property:** Empty or whitespace-only content is invalid. Content with grapheme count > 5000 is invalid. Valid messages have trimmed content with grapheme count in [1, 5000].
- **Test sketch:**
  ```ts
  fc.assert(
    fc.property(fc.fullUnicodeString({ maxLength: 10000 }), (content) => {
      const result = validateMessageContent(content);
      if (result.valid) {
        expect([...content].length).toBeLessThanOrEqual(5000);
        expect(content.trim().length).toBeGreaterThan(0);
      }
    })
  );
  ```

### 4.6 isValidTransactionTransition (state machine)

- **Location:** `lib/validation.ts:152`
- **Pattern type:** Invariant (DAG / no cycles through terminal states)
- **Priority:** HIGH
- **Property:**
  - Terminal states (`COMPLETED`, `REFUNDED`, `CANCELLED`) have no valid transitions out.
  - All transitions are one-way (no transition from X to Y implies transition from Y to X, except via different paths).
  - Every state mentioned as a target also exists as a source (closed set).
- **Test sketch:**
  ```ts
  // Terminal states have no successors
  for (const terminal of ["COMPLETED", "REFUNDED", "CANCELLED"]) {
    expect(VALID_TRANSACTION_TRANSITIONS[terminal]).toEqual([]);
  }
  // All target states are known
  for (const [from, targets] of Object.entries(VALID_TRANSACTION_TRANSITIONS)) {
    for (const target of targets) {
      expect(VALID_TRANSACTION_TRANSITIONS).toHaveProperty(target);
    }
  }
  // Property: random walks eventually reach a terminal state (no infinite loops)
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 100 }), (seed) => {
      let state = "PENDING";
      let steps = 0;
      while (VALID_TRANSACTION_TRANSITIONS[state]?.length > 0 && steps < 50) {
        const next = VALID_TRANSACTION_TRANSITIONS[state];
        state = next[seed % next.length];
        steps++;
      }
      expect(["COMPLETED", "REFUNDED", "CANCELLED"]).toContain(state);
    })
  );
  ```

### 4.7 validateMagicBytes

- **Location:** `lib/file-security.ts:181`
- **Pattern type:** Invariant (correct identification)
- **Priority:** MEDIUM
- **Property:** For known extensions with defined magic bytes, a buffer starting with the correct signature always returns `valid: true`. A buffer starting with wrong bytes always returns `valid: false`. Extensions without defined signatures always return `valid: true`.
- **Test sketch:**
  ```ts
  // Correct magic bytes always pass
  const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, ...new Array(8).fill(0)]);
  expect(validateMagicBytes(pngHeader, ".png").valid).toBe(true);

  // Wrong bytes fail
  fc.assert(
    fc.property(fc.uint8Array({ minLength: 16, maxLength: 16 }), (randomBytes) => {
      const result = validateMagicBytes(Buffer.from(randomBytes), ".png");
      // Only valid if first 8 bytes happen to match PNG signature (extremely unlikely)
      if (!result.valid) {
        expect(result.message).toContain("spoofing");
      }
    })
  );
  ```

---

## 5. Cryptographic / HMAC Invariants

### 5.1 CSRF generate / verify roundtrip

- **Location:** `lib/csrf.ts:30` (`generateCsrfToken`) and `lib/csrf.ts:45` (`verifyCsrfToken`)
- **Pattern type:** Roundtrip
- **Priority:** HIGH
- **Property:** `verifyCsrfToken(generateCsrfToken())` always returns `true` (within expiry window). Tampered tokens return `false`. Tokens older than 8 hours return `false`.
- **Test sketch:**
  ```ts
  fc.assert(
    fc.property(fc.constant(null), () => {
      process.env.CSRF_SECRET = "test-secret-at-least-32-chars!!";
      const token = generateCsrfToken();
      expect(verifyCsrfToken(token)).toBe(true);
    })
  );
  // Tamper detection:
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 200 }), (pos) => {
      process.env.CSRF_SECRET = "test-secret-at-least-32-chars!!";
      const token = generateCsrfToken();
      if (pos < token.length) {
        const tampered = token.slice(0, pos) + "X" + token.slice(pos + 1);
        expect(verifyCsrfToken(tampered)).toBe(false);
      }
    })
  );
  ```

### 5.2 signWebhookPayload / verifyWebhookSignature

- **Location:** `lib/agent-auth.ts:386` and `lib/agent-auth.ts:393`
- **Pattern type:** Roundtrip
- **Priority:** HIGH
- **Property:** For any payload string and secret, `verifyWebhookSignature(payload, signWebhookPayload(payload, secret), secret)` returns `true`. Using a different secret returns `false`.
- **Test sketch:**
  ```ts
  fc.assert(
    fc.property(fc.string(), fc.string({ minLength: 1 }), (payload, secret) => {
      const sig = signWebhookPayload(payload, secret);
      expect(verifyWebhookSignature(payload, sig, secret)).toBe(true);
      expect(verifyWebhookSignature(payload, sig, secret + "x")).toBe(false);
      expect(verifyWebhookSignature(payload + "x", sig, secret)).toBe(false);
    })
  );
  ```

### 5.3 SDK verifyWebhookSignature (SubtleCrypto version)

- **Location:** `lib/sdk/utils.ts:65`
- **Pattern type:** Roundtrip (must agree with server-side signer)
- **Priority:** MEDIUM
- **Property:** The SDK's `verifyWebhookSignature` should accept signatures produced by the server-side `signWebhookPayload` for the same payload and secret. This tests cross-implementation consistency.
- **Test sketch:**
  ```ts
  fc.assert(
    fc.asyncProperty(fc.string(), fc.string({ minLength: 1 }), async (payload, secret) => {
      const serverSig = signWebhookPayload(payload, secret); // from agent-auth.ts
      const sdkValid = await sdkVerifyWebhookSignature(payload, serverSig, secret); // from sdk/utils.ts
      expect(sdkValid).toBe(true);
    })
  );
  ```

---

## 6. Similarity / Metric Invariants

### 6.1 calculateTextSimilarity (Jaccard index)

- **Location:** `lib/similarity-detection.ts:15`
- **Pattern type:** Mathematical invariant
- **Priority:** MEDIUM
- **Properties:**
  - Symmetry: `similarity(a, b) === similarity(b, a)`
  - Range: `0 <= result <= 1`
  - Identity: `similarity(a, a) === 1` (for non-empty strings with tokens of length > 2)
  - Empty string: `similarity("", x) === 0`
- **Test sketch:**
  ```ts
  fc.assert(
    fc.property(fc.string(), fc.string(), (a, b) => {
      const sim = calculateTextSimilarity(a, b);
      expect(sim).toBeGreaterThanOrEqual(0);
      expect(sim).toBeLessThanOrEqual(1);
      expect(sim).toBe(calculateTextSimilarity(b, a)); // symmetric
    })
  );
  ```

### 6.2 calculateNGramSimilarity

- **Location:** `lib/similarity-detection.ts:39`
- **Pattern type:** Mathematical invariant
- **Priority:** MEDIUM
- **Properties:** Same as 6.1 (symmetry, range [0,1], identity, zero for empty).
- **Test sketch:**
  ```ts
  fc.assert(
    fc.property(fc.string({ minLength: 3 }), (s) => {
      expect(calculateNGramSimilarity(s, s)).toBe(1); // self-similarity
    })
  );
  ```

### 6.3 hammingDistance

- **Location:** `lib/similarity-detection.ts:102`
- **Pattern type:** Metric space invariant
- **Priority:** LOW
- **Properties:**
  - `hammingDistance(a, a) === 0` (identity)
  - `hammingDistance(a, b) === hammingDistance(b, a)` (symmetry)
  - `hammingDistance(a, b) >= 0` (non-negative)
  - `hammingDistance(a, b) <= max(a.length, b.length)` (bounded)

### 6.4 calculateTechStackSimilarity

- **Location:** `lib/similarity-detection.ts:126`
- **Pattern type:** Mathematical invariant
- **Priority:** LOW
- **Properties:** Symmetry, range [0,1], self-similarity = 1 for non-empty arrays, case-insensitive.

---

## 7. Data Transformation / Financial Invariants

### 7.1 calculatePartnerPayments (conservation of value)

- **Location:** `lib/validation.ts:186`
- **Pattern type:** Invariant (sum conservation)
- **Priority:** HIGH
- **Property:** The sum of all partner `amountLamports` equals the total lamports derived from `totalAmountSol`. No lamport is created or destroyed.
- **Additional property:** Each partner's amount is non-negative.
- **Test sketch:**
  ```ts
  fc.assert(
    fc.property(
      fc.double({ min: 0.001, max: 1000, noNaN: true }),
      fc.array(
        fc.record({
          walletAddress: fc.string(),
          percentage: fc.double({ min: 1, max: 100, noNaN: true }),
        }),
        { minLength: 1, maxLength: 10 }
      ),
      (total, partners) => {
        // Normalize percentages to sum to 100
        const sum = partners.reduce((s, p) => s + p.percentage, 0);
        const normalized = partners.map(p => ({ ...p, percentage: (p.percentage / sum) * 100 }));

        const payments = calculatePartnerPayments(total, normalized);
        const totalLamports = BigInt(Math.round(total * 1_000_000_000));
        const distributedLamports = payments.reduce((s, p) => s + p.amountLamports, BigInt(0));

        expect(distributedLamports).toBe(totalLamports); // conservation
        payments.forEach(p => expect(p.amountLamports).toBeGreaterThanOrEqual(BigInt(0)));
      }
    )
  );
  ```

---

## 8. Formatting Invariants

### 8.1 formatAddress (wallet address truncation)

- **Location:** `lib/utils.ts:78`
- **Pattern type:** Invariant (structure preserved)
- **Priority:** LOW
- **Property:** Output always contains "..." in the middle. First `chars` characters match input prefix. Last `chars` characters match input suffix. For empty input, returns empty string.
- **Test sketch:**
  ```ts
  fc.assert(
    fc.property(
      fc.string({ minLength: 10, maxLength: 44 }),
      fc.integer({ min: 1, max: 8 }),
      (addr, chars) => {
        const result = formatAddress(addr, chars);
        expect(result).toContain("...");
        expect(result.startsWith(addr.slice(0, chars))).toBe(true);
        expect(result.endsWith(addr.slice(-chars))).toBe(true);
      }
    )
  );
  ```

### 8.2 truncate

- **Location:** `lib/utils.ts:72`
- **Pattern type:** Invariant (length bound)
- **Priority:** LOW
- **Property:** `truncate(s, n).length <= n + 3` (accounting for "..."). If `s.length <= n`, output equals `s` (no modification).

---

## Priority Summary

| Priority | Count | Opportunities |
|----------|-------|---------------|
| HIGH     | 7     | encrypt/decrypt roundtrip, encryptAccountTokens roundtrip, looksEncrypted post-condition, isValidSolanaAddress, isValidUrl, CSRF generate/verify, signWebhook/verifyWebhook, calculatePartnerPayments conservation, transaction state machine |
| MEDIUM   | 10    | serializeKeypair, encodeBase64, parseGitHubUrl, parseWebhookPayload, sanitizePagination, generateSlug, validatePasswordComplexity, validateMagicBytes, text/ngram similarity, SDK webhook cross-impl |
| LOW      | 5     | sanitizeSearchQuery, isValidUUID, validateMessageContent, hammingDistance, formatAddress, truncate |

## Recommendations

1. **Start with HIGH-priority roundtrip tests** for `encrypt`/`decrypt` and `encryptAccountTokens`/`decryptAccountTokens`. These are security-critical and a roundtrip failure means data loss or corruption.

2. **CSRF and HMAC roundtrips** are the next highest-value targets -- these protect against cross-site and webhook spoofing attacks.

3. **`calculatePartnerPayments` conservation** is critical for financial correctness -- a lamport leak means real money lost.

4. **Transaction state machine** properties can catch unreachable states or unintended cycles introduced by future changes.

5. **Similarity metric invariants** are lower risk but easy to implement and catch normalization regressions.

6. Consider using [fast-check](https://github.com/dubzzz/fast-check) for TypeScript property-based testing. All sketches above use its API.
