# Property-Based Testing (PBT) Security Report

**Date:** 2026-02-27
**Codebase:** App-Market (Next.js + TypeScript + Solana)
**Methodology:** Trail of Bits "property-based-testing" skill
**Recommended Library:** [fast-check](https://github.com/dubzzz/fast-check) for TypeScript

---

## Executive Summary

This report identifies **18 property-based testing candidates** across the App-Market codebase, organized by security criticality. The codebase handles financial transactions (SOL/USDC/APP tokens), wallet-based authentication, encrypted keypair storage, and auction mechanics -- all areas where subtle bugs can cause direct monetary loss or security bypasses.

**Priority breakdown:**
- **HIGH** (8 candidates): Direct financial or authentication impact
- **MEDIUM** (7 candidates): Data integrity, injection, or bypass potential
- **LOW** (3 candidates): Correctness and robustness

---

## Table of Contents

1. [Serialization Roundtrip Candidates](#1-serialization-roundtrip-candidates)
2. [Mathematical / Financial Invariant Candidates](#2-mathematical--financial-invariant-candidates)
3. [Validator and Parser Candidates](#3-validator-and-parser-candidates)
4. [Normalization / Idempotence Candidates](#4-normalization--idempotence-candidates)
5. [Security-Critical Pattern Candidates](#5-security-critical-pattern-candidates)
6. [Implementation Recommendations](#6-implementation-recommendations)

---

## 1. Serialization Roundtrip Candidates

### 1.1 Keypair Serialize/Deserialize Roundtrip

- **Location:** `/home/user/App-Market/lib/vanity-keygen.ts` (lines 85-94)
- **Pattern:** Roundtrip
- **Priority:** HIGH
- **Functions:** `serializeKeypair()` / `deserializeKeypair()`
- **Security context:** These functions handle Solana keypairs containing private keys. They are used in the token launch flow (`/app/api/token-launch/route.ts` line 137, `/app/api/token-launch/deploy/route.ts` line 82). A roundtrip failure means lost funds (keypair destroyed) or wrong keypair deployed (funds sent to wrong address).

**Property:** For any valid Solana Keypair, `deserializeKeypair(serializeKeypair(kp)).publicKey` must equal `kp.publicKey` AND the secret key bytes must be identical.

```typescript
import fc from 'fast-check';
import { Keypair } from '@solana/web3.js';
import { serializeKeypair, deserializeKeypair } from '@/lib/vanity-keygen';

describe('Keypair serialization roundtrip', () => {
  it('should perfectly roundtrip any Keypair', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 64, maxLength: 64 }),
        (secretKeyBytes) => {
          try {
            const original = Keypair.fromSecretKey(secretKeyBytes);
            const roundtripped = deserializeKeypair(serializeKeypair(original));
            // Public key must match
            expect(roundtripped.publicKey.toBase58()).toBe(original.publicKey.toBase58());
            // Secret key must match byte-for-byte
            expect(Buffer.from(roundtripped.secretKey)).toEqual(Buffer.from(original.secretKey));
          } catch {
            // Invalid keypair bytes -- skip
          }
        }
      ),
      { numRuns: 1000 }
    );
  });
});
```

---

### 1.2 Encryption Encrypt/Decrypt Roundtrip

- **Location:** `/home/user/App-Market/lib/encryption.ts` (lines 48-103)
- **Pattern:** Roundtrip
- **Priority:** HIGH
- **Functions:** `encrypt()` / `decrypt()`
- **Security context:** Used to encrypt webhook secrets and vanity keypairs at rest. A roundtrip failure means permanent data loss or security breach via corrupted ciphertext.

**Property:** For any string `plaintext` and optional AAD string, `decrypt(encrypt(plaintext, aad), aad) === plaintext`.

**Additional invariant:** `decrypt(encrypt(plaintext, "aad1"), "aad2")` must throw (AAD mismatch must fail).

```typescript
import fc from 'fast-check';

describe('Encryption roundtrip', () => {
  beforeAll(() => {
    process.env.ENCRYPTION_SECRET = 'a'.repeat(64); // 256-bit hex
  });

  it('should roundtrip any plaintext', () => {
    fc.assert(
      fc.property(fc.string(), (plaintext) => {
        const encrypted = encrypt(plaintext);
        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe(plaintext);
      }),
      { numRuns: 500 }
    );
  });

  it('should roundtrip with AAD binding', () => {
    fc.assert(
      fc.property(fc.string(), fc.string({ minLength: 1 }), (plaintext, aad) => {
        const encrypted = encrypt(plaintext, aad);
        const decrypted = decrypt(encrypted, aad);
        expect(decrypted).toBe(plaintext);
      }),
      { numRuns: 500 }
    );
  });

  it('should reject mismatched AAD', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (plaintext, aad1, aad2) => {
          fc.pre(aad1 !== aad2);
          const encrypted = encrypt(plaintext, aad1);
          expect(() => decrypt(encrypted, aad2)).toThrow();
        }
      ),
      { numRuns: 200 }
    );
  });
});
```

---

### 1.3 Base64 Encode/Decode Roundtrip (SDK)

- **Location:** `/home/user/App-Market/lib/sdk/utils.ts` (lines 14-40)
- **Pattern:** Roundtrip
- **Priority:** MEDIUM
- **Functions:** `encodeBase64()` / `decodeBase64()`
- **Security context:** Used in webhook signature generation for the agent SDK. Incorrect encoding could cause signature verification failures, enabling unauthorized webhook payloads.

**Property:** For any `Uint8Array` input, `decodeBase64(encodeBase64(bytes))` must produce identical bytes.

```typescript
import fc from 'fast-check';
import { encodeBase64, decodeBase64 } from '@/lib/sdk/utils';

describe('Base64 roundtrip', () => {
  it('should roundtrip any byte array', () => {
    fc.assert(
      fc.property(fc.uint8Array(), (bytes) => {
        const roundtripped = decodeBase64(encodeBase64(bytes));
        expect(Buffer.from(roundtripped)).toEqual(Buffer.from(bytes));
      }),
      { numRuns: 1000 }
    );
  });
});
```

---

### 1.4 SOL/Lamports Conversion Roundtrip

- **Location:** `/home/user/App-Market/lib/solana.ts` (lines 117-128)
- **Pattern:** Roundtrip (approximate)
- **Priority:** HIGH
- **Functions:** `solToLamports()` / `lamportsToSol()`
- **Security context:** Price conversions in financial transactions. Precision loss could mean funds leak or overpayment.

**Property:** For any non-negative SOL amount with up to 9 decimal places, `lamportsToSol(solToLamports(sol))` should equal `sol` (within precision). For any non-negative integer lamport value, `solToLamports(lamportsToSol(lamports))` should equal `lamports`.

**Bug risk:** The `solToLamports` function uses string splitting to avoid floating-point issues, but `lamportsToSol` uses plain division which introduces floating-point imprecision on the reverse path.

```typescript
import fc from 'fast-check';
import { solToLamports, lamportsToSol } from '@/lib/solana';

describe('SOL/Lamports conversion', () => {
  it('lamports -> SOL -> lamports should be identity for integers', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
        (lamports) => {
          const sol = lamportsToSol(lamports);
          const backToLamports = solToLamports(sol);
          // Must not lose funds
          expect(backToLamports.toNumber()).toBe(lamports);
        }
      ),
      { numRuns: 5000 }
    );
  });

  it('SOL -> lamports -> SOL should preserve value', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1000000, noNaN: true }),
        (sol) => {
          const lamports = solToLamports(sol);
          const backToSol = lamportsToSol(lamports);
          // Allow for precision loss at 9 decimals
          expect(Math.abs(backToSol - sol)).toBeLessThan(1e-9);
        }
      ),
      { numRuns: 5000 }
    );
  });
});
```

---

## 2. Mathematical / Financial Invariant Candidates

### 2.1 Platform Fee Calculation Invariants

- **Location:** `/home/user/App-Market/lib/solana.ts` (lines 136-155), `/home/user/App-Market/lib/config.ts` (lines 288-312)
- **Pattern:** Invariant
- **Priority:** HIGH
- **Functions:** `calculatePlatformFee()`, `calculateSellerProceeds()`, `calculateDisputeFee()`

**Properties:**
1. `fee + proceeds === salePrice` (conservation of funds)
2. `fee >= 0` (no negative fees)
3. `proceeds <= salePrice` (seller never gets more than sale price)
4. APP token fee < standard fee for same amount (discount invariant)
5. Fee is monotonically increasing with sale price

```typescript
import fc from 'fast-check';
import { calculatePlatformFee, calculateSellerProceeds } from '@/lib/solana';

describe('Fee calculation invariants', () => {
  it('fee + proceeds === salePrice (conservation of funds)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.001, max: 1_000_000, noNaN: true }),
        fc.constantFrom(undefined, 'SOL', 'APP', 'USDC'),
        (price, currency) => {
          const { fee, proceeds } = calculateSellerProceeds(price, currency);
          // Conservation: no funds created or destroyed
          expect(Math.abs((fee + proceeds) - price)).toBeLessThan(1e-10);
          // Non-negativity
          expect(fee).toBeGreaterThanOrEqual(0);
          expect(proceeds).toBeGreaterThanOrEqual(0);
          expect(proceeds).toBeLessThanOrEqual(price);
        }
      ),
      { numRuns: 10000 }
    );
  });

  it('APP fee is always <= standard fee', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.001, max: 1_000_000, noNaN: true }),
        (price) => {
          const standardFee = calculatePlatformFee(price, 'SOL');
          const appFee = calculatePlatformFee(price, 'APP');
          expect(appFee).toBeLessThanOrEqual(standardFee);
        }
      ),
      { numRuns: 5000 }
    );
  });

  it('fee is monotonically increasing with price', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.001, max: 500_000, noNaN: true }),
        fc.double({ min: 0.001, max: 500_000, noNaN: true }),
        (price1, price2) => {
          if (price1 <= price2) {
            expect(calculatePlatformFee(price1)).toBeLessThanOrEqual(
              calculatePlatformFee(price2)
            );
          }
        }
      ),
      { numRuns: 5000 }
    );
  });
});
```

---

### 2.2 Partner Payment Distribution Invariant

- **Location:** `/home/user/App-Market/lib/validation.ts` (lines 180-205)
- **Pattern:** Invariant (conservation)
- **Priority:** HIGH
- **Function:** `calculatePartnerPayments()`
- **Security context:** Distributes funds among purchase partners. Uses BigInt/lamport math to avoid rounding errors. A bug here means partners get too much or too little.

**Properties:**
1. Sum of all partner lamports === total lamports (no funds lost or created)
2. Each partner's amount is non-negative
3. Each partner's amount is proportional to their percentage (within 1 lamport)

```typescript
import fc from 'fast-check';
import { calculatePartnerPayments } from '@/lib/validation';

describe('Partner payment distribution', () => {
  it('sum of payments equals total (conservation)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 100_000, noNaN: true }),
        fc.array(
          fc.record({
            walletAddress: fc.hexaString({ minLength: 32, maxLength: 44 }),
            percentage: fc.double({ min: 1, max: 100, noNaN: true }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (totalAmount, rawPartners) => {
          // Normalize percentages to sum to 100
          const totalPct = rawPartners.reduce((s, p) => s + p.percentage, 0);
          const partners = rawPartners.map(p => ({
            ...p,
            percentage: (p.percentage / totalPct) * 100,
          }));

          const payments = calculatePartnerPayments(totalAmount, partners);

          // Conservation: sum of lamports === expected total
          const LAMPORTS_PER_SOL = BigInt(1_000_000_000);
          const expectedTotal = BigInt(Math.round(totalAmount * Number(LAMPORTS_PER_SOL)));
          const actualTotal = payments.reduce(
            (sum, p) => sum + p.amountLamports,
            BigInt(0)
          );
          expect(actualTotal).toBe(expectedTotal);

          // Non-negativity
          payments.forEach(p => {
            expect(p.amountLamports).toBeGreaterThanOrEqual(BigInt(0));
          });
        }
      ),
      { numRuns: 2000 }
    );
  });
});
```

---

### 2.3 Token Launch Allocation Invariant

- **Location:** `/home/user/App-Market/lib/config.ts` (lines 314-316)
- **Pattern:** Invariant
- **Priority:** MEDIUM
- **Function:** `calculateTokenLaunchAllocation()`

**Property:** Allocation is always less than total supply, and is exactly `totalSupply * bps / 10000`.

```typescript
import fc from 'fast-check';
import { calculateTokenLaunchAllocation } from '@/lib/config';

describe('Token launch allocation', () => {
  it('allocation < totalSupply', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: BigInt(1), max: BigInt(10) ** BigInt(18) }),
        (totalSupply) => {
          const allocation = calculateTokenLaunchAllocation(totalSupply);
          expect(allocation).toBeLessThan(totalSupply);
          expect(allocation).toBeGreaterThanOrEqual(BigInt(0));
        }
      ),
      { numRuns: 5000 }
    );
  });
});
```

---

### 2.4 Revenue Distribution Invariant

- **Location:** `/home/user/App-Market/lib/config.ts` (lines 323-344)
- **Pattern:** Invariant (conservation)
- **Priority:** MEDIUM
- **Function:** `getRevenueDistribution()`

**Property:** `operations + treasury + buyback === totalRevenue` (conservation of funds).

```typescript
import fc from 'fast-check';
import { getRevenueDistribution } from '@/lib/config';

describe('Revenue distribution', () => {
  it('components sum to total revenue (conservation)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1_000_000, noNaN: true }),
        (totalRevenue) => {
          const dist = getRevenueDistribution(totalRevenue);
          const sum = dist.operations + dist.treasury + dist.buyback;
          expect(Math.abs(sum - totalRevenue)).toBeLessThan(1e-6);
        }
      ),
      { numRuns: 5000 }
    );
  });
});
```

---

### 2.5 Token Unit Conversion Roundtrip

- **Location:** `/home/user/App-Market/lib/solana.ts` (lines 252-262)
- **Pattern:** Roundtrip
- **Priority:** MEDIUM
- **Functions:** `toTokenUnits()` / `fromTokenUnits()`
- **Security context:** `toTokenUnits` uses `Math.floor(amount * Math.pow(10, decimals))` which is vulnerable to floating-point precision issues, especially for USDC (6 decimals) vs SOL/APP (9 decimals).

**Property:** For integer token amounts, `fromTokenUnits(toTokenUnits(amount, currency), currency)` should equal `amount`.

```typescript
import fc from 'fast-check';
import { toTokenUnits, fromTokenUnits } from '@/lib/solana';

describe('Token unit conversion', () => {
  it('roundtrip preserves integer amounts', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.constantFrom('SOL' as const, 'APP' as const, 'USDC' as const),
        (intAmount, currency) => {
          const units = toTokenUnits(intAmount, currency);
          const back = fromTokenUnits(units, currency);
          expect(back).toBe(intAmount);
        }
      ),
      { numRuns: 5000 }
    );
  });
});
```

---

## 3. Validator and Parser Candidates

### 3.1 Solana Address Validator

- **Location:** `/home/user/App-Market/lib/validation.ts` (lines 102-109)
- **Pattern:** Oracle / Invariant
- **Priority:** HIGH
- **Function:** `isValidSolanaAddress()`
- **Security context:** Used in listing creation to validate reserved buyer wallets, and elsewhere for wallet verification. A bypass means operations against invalid or injected addresses.

**Properties:**
1. All valid Base58-encoded 32-byte keys should pass
2. Strings with invalid Base58 characters (0, O, I, l) should fail
3. Strings shorter than 32 or longer than 44 characters should fail
4. Known valid Solana addresses should always pass
5. Cross-validation: if `isValidSolanaAddress(addr)` is true, `new PublicKey(addr)` should not throw

```typescript
import fc from 'fast-check';
import { PublicKey } from '@solana/web3.js';
import { isValidSolanaAddress } from '@/lib/validation';

const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

describe('Solana address validation', () => {
  it('rejects strings with invalid base58 chars', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom('0', 'O', 'I', 'l'), { minLength: 32, maxLength: 44 }),
        (badAddr) => {
          expect(isValidSolanaAddress(badAddr)).toBe(false);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('rejects strings outside length bounds', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.stringOf(fc.constantFrom(...base58Chars.split('')), { minLength: 0, maxLength: 31 }),
          fc.stringOf(fc.constantFrom(...base58Chars.split('')), { minLength: 45, maxLength: 100 })
        ),
        (addr) => {
          expect(isValidSolanaAddress(addr)).toBe(false);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('cross-validates with PublicKey constructor', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom(...base58Chars.split('')), { minLength: 32, maxLength: 44 }),
        (addr) => {
          const ourResult = isValidSolanaAddress(addr);
          if (ourResult) {
            // If we say it's valid, PublicKey should accept it
            expect(() => new PublicKey(addr)).not.toThrow();
          }
        }
      ),
      { numRuns: 5000 }
    );
  });
});
```

---

### 3.2 URL Validation (Protocol Bypass)

- **Location:** `/home/user/App-Market/lib/validation.ts` (lines 89-97), `/home/user/App-Market/lib/utils.ts` (lines 96-103)
- **Pattern:** Invariant / Oracle
- **Priority:** MEDIUM
- **Functions:** `isValidUrl()` (two versions -- one checks protocol, one does not)
- **Security context:** The `validation.ts` version checks for http/https protocol to prevent `javascript:` and `data:` URL injection. The `utils.ts` version does NOT check protocol. This inconsistency could lead to XSS if the wrong version is used.

**Properties:**
1. `javascript:` URLs must be rejected by the security-aware validator
2. `data:` URLs must be rejected
3. `file:` URLs must be rejected
4. All valid `https://` URLs should be accepted

```typescript
import fc from 'fast-check';
import { isValidUrl } from '@/lib/validation';

describe('URL validation - protocol safety', () => {
  it('rejects dangerous protocols', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('javascript:', 'data:', 'file:', 'vbscript:', 'ftp:'),
        fc.webUrl().map(u => new URL(u).pathname),
        (protocol, path) => {
          const maliciousUrl = `${protocol}${path}`;
          expect(isValidUrl(maliciousUrl)).toBe(false);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('accepts valid HTTPS URLs', () => {
    fc.assert(
      fc.property(fc.webUrl(), (url) => {
        // fast-check webUrl generates https URLs
        expect(isValidUrl(url)).toBe(true);
      }),
      { numRuns: 1000 }
    );
  });
});
```

---

### 3.3 GitHub URL Parser

- **Location:** `/home/user/App-Market/lib/utils.ts` (lines 112-119)
- **Pattern:** Roundtrip / Oracle
- **Priority:** MEDIUM
- **Functions:** `isValidGitHubUrl()`, `parseGitHubUrl()`

**Properties:**
1. If `isValidGitHubUrl(url)` is true, `parseGitHubUrl(url)` must return non-null
2. Parsed owner/repo should not contain path traversal characters
3. URLs with extra path segments should be handled correctly

```typescript
import fc from 'fast-check';
import { isValidGitHubUrl, parseGitHubUrl } from '@/lib/utils';

describe('GitHub URL parsing', () => {
  it('parseGitHubUrl returns non-null when isValidGitHubUrl is true', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')), { minLength: 1, maxLength: 20 }),
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-.'.split('')), { minLength: 1, maxLength: 30 }),
        (owner, repo) => {
          const url = `https://github.com/${owner}/${repo}`;
          if (isValidGitHubUrl(url)) {
            const parsed = parseGitHubUrl(url);
            expect(parsed).not.toBeNull();
            expect(parsed!.owner).toBe(owner);
          }
        }
      ),
      { numRuns: 2000 }
    );
  });
});
```

---

### 3.4 Webhook Payload Parser

- **Location:** `/home/user/App-Market/lib/sdk/utils.ts` (lines 125-154)
- **Pattern:** Invariant
- **Priority:** LOW
- **Function:** `parseWebhookPayload()`

**Property:** Any well-formed payload object should parse successfully, and any malformed object should throw a descriptive error (no silent corruption).

---

## 4. Normalization / Idempotence Candidates

### 4.1 Slug Generation (Idempotence + Injection Safety)

- **Location:** `/home/user/App-Market/lib/utils.ts` (lines 63-69), `/home/user/App-Market/app/api/listings/route.ts` (lines 410-422)
- **Pattern:** Idempotence + Invariant
- **Priority:** HIGH
- **Function:** `generateSlug()`
- **Security context:** Slugs are used in URLs like `/listing/[slug]`. If slug generation produces empty strings, strings with special characters, or collisions, it could cause routing issues, injection, or listing overwrites.

**Properties:**
1. **Idempotence:** `generateSlug(generateSlug(s)) === generateSlug(s)`
2. **Character safety:** Output contains only `[a-z0-9-]`
3. **No leading/trailing hyphens:** Output never starts or ends with `-`
4. **Non-empty for non-empty input:** If input contains any alphanumeric chars, output is non-empty
5. **Injection resistance:** Input with HTML/JS/SQL should produce safe slug

```typescript
import fc from 'fast-check';
import { generateSlug } from '@/lib/utils';

describe('Slug generation', () => {
  it('is idempotent', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const once = generateSlug(input);
        const twice = generateSlug(once);
        expect(twice).toBe(once);
      }),
      { numRuns: 10000 }
    );
  });

  it('output contains only safe characters', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const slug = generateSlug(input);
        expect(slug).toMatch(/^[a-z0-9-]*$/);
      }),
      { numRuns: 10000 }
    );
  });

  it('no leading or trailing hyphens', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const slug = generateSlug(input);
        if (slug.length > 0) {
          expect(slug[0]).not.toBe('-');
          expect(slug[slug.length - 1]).not.toBe('-');
        }
      }),
      { numRuns: 10000 }
    );
  });

  it('is non-empty when input has alphanumeric chars', () => {
    fc.assert(
      fc.property(
        fc.string().filter(s => /[a-zA-Z0-9]/.test(s)),
        (input) => {
          expect(generateSlug(input).length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 5000 }
    );
  });

  it('resists XSS/injection payloads', () => {
    const payloads = [
      '<script>alert(1)</script>',
      '"; DROP TABLE listings; --',
      '../../../etc/passwd',
      'javascript:alert(1)',
      '{{constructor.constructor("return this")()}}',
    ];
    payloads.forEach(payload => {
      const slug = generateSlug(payload);
      expect(slug).toMatch(/^[a-z0-9-]*$/);
      expect(slug).not.toContain('<');
      expect(slug).not.toContain('>');
      expect(slug).not.toContain("'");
      expect(slug).not.toContain('"');
    });
  });
});
```

---

### 4.2 Search Query Sanitization (Idempotence)

- **Location:** `/home/user/App-Market/lib/validation.ts` (lines 131-134)
- **Pattern:** Idempotence
- **Priority:** MEDIUM
- **Function:** `sanitizeSearchQuery()`

**Property:** `sanitizeSearchQuery(sanitizeSearchQuery(q)) === sanitizeSearchQuery(q)` (applying twice has same effect as once).

```typescript
import fc from 'fast-check';
import { sanitizeSearchQuery } from '@/lib/validation';

describe('Search query sanitization', () => {
  it('is idempotent', () => {
    fc.assert(
      fc.property(fc.string(), (query) => {
        const once = sanitizeSearchQuery(query);
        const twice = sanitizeSearchQuery(once);
        expect(twice).toBe(once);
      }),
      { numRuns: 5000 }
    );
  });

  it('output length <= MAX_SEARCH_QUERY_LENGTH', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 1000 }), (query) => {
        const result = sanitizeSearchQuery(query);
        if (result !== null) {
          expect(result.length).toBeLessThanOrEqual(200);
        }
      }),
      { numRuns: 5000 }
    );
  });
});
```

---

### 4.3 Pagination Sanitization (Idempotence + Bounds)

- **Location:** `/home/user/App-Market/lib/validation.ts` (lines 122-126)
- **Pattern:** Invariant
- **Priority:** LOW
- **Function:** `sanitizePagination()`

**Properties:**
1. `page >= 1` always
2. `1 <= limit <= 100` always
3. Applying sanitization to already-sanitized values produces the same result

```typescript
import fc from 'fast-check';
import { sanitizePagination } from '@/lib/validation';

describe('Pagination sanitization', () => {
  it('page is always >= 1 and limit in [1, 100]', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.string(), fc.constant(null)),
        fc.oneof(fc.string(), fc.constant(null)),
        (page, limit) => {
          const result = sanitizePagination(page, limit);
          expect(result.page).toBeGreaterThanOrEqual(1);
          expect(result.limit).toBeGreaterThanOrEqual(1);
          expect(result.limit).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 5000 }
    );
  });
});
```

---

## 5. Security-Critical Pattern Candidates

### 5.1 CSRF Token Generate/Verify Roundtrip

- **Location:** `/home/user/App-Market/lib/csrf.ts` (lines 31-78)
- **Pattern:** Roundtrip
- **Priority:** HIGH
- **Functions:** `generateCsrfToken()` / `verifyCsrfToken()`
- **Security context:** CSRF tokens protect all state-changing API operations. A failure here means either all tokens are rejected (denial of service) or forged tokens are accepted (CSRF attack).

**Properties:**
1. A freshly generated token must always verify successfully
2. A modified token must fail verification
3. Token format must be `randomValue.timestamp.signature` (3 parts)

```typescript
import fc from 'fast-check';

describe('CSRF token roundtrip', () => {
  beforeAll(() => {
    process.env.CSRF_SECRET = 'test-secret-at-least-32-characters-long!!';
  });

  it('freshly generated tokens always verify', () => {
    // Generate many tokens in parallel (tests uniqueness)
    for (let i = 0; i < 1000; i++) {
      const token = generateCsrfToken();
      expect(verifyCsrfToken(token)).toBe(true);
    }
  });

  it('tampered tokens are rejected', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (tamperIndex) => {
          const token = generateCsrfToken();
          const chars = token.split('');
          const idx = tamperIndex % chars.length;
          // Flip one character
          chars[idx] = chars[idx] === 'a' ? 'b' : 'a';
          const tampered = chars.join('');
          if (tampered !== token) {
            expect(verifyCsrfToken(tampered)).toBe(false);
          }
        }
      ),
      { numRuns: 500 }
    );
  });
});
```

---

### 5.2 Webhook Signature Sign/Verify Roundtrip

- **Location:** `/home/user/App-Market/lib/agent-auth.ts` (lines 346-364)
- **Pattern:** Roundtrip
- **Priority:** MEDIUM
- **Functions:** `signWebhookPayload()` / `verifyWebhookSignature()`

**Properties:**
1. `verifyWebhookSignature(payload, signWebhookPayload(payload, secret), secret)` must be true
2. Verification with wrong secret must fail
3. Verification with tampered payload must fail

```typescript
import fc from 'fast-check';
import { signWebhookPayload, verifyWebhookSignature } from '@/lib/agent-auth';

describe('Webhook signature roundtrip', () => {
  it('sign then verify succeeds', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (payload, secret) => {
          const sig = signWebhookPayload(payload, secret);
          expect(verifyWebhookSignature(payload, sig, secret)).toBe(true);
        }
      ),
      { numRuns: 2000 }
    );
  });

  it('wrong secret fails verification', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (payload, secret1, secret2) => {
          fc.pre(secret1 !== secret2);
          const sig = signWebhookPayload(payload, secret1);
          expect(verifyWebhookSignature(payload, sig, secret2)).toBe(false);
        }
      ),
      { numRuns: 2000 }
    );
  });
});
```

---

### 5.3 File Extension Validation Consistency

- **Location:** `/home/user/App-Market/lib/file-security.ts` (lines 61-91)
- **Pattern:** Invariant / Oracle
- **Priority:** MEDIUM
- **Function:** `validateFile()`

**Properties:**
1. Every file classified as "blocked" has `allowed: false`
2. Every file classified as "safe" has `allowed: true` and `warning: false`
3. Double-extension attacks (e.g., `file.exe.jpg`) should be safe (extension is `.jpg`)
4. Case insensitivity: `FILE.EXE` should be blocked just like `file.exe`
5. `validateFile(filename).extension === getExtension(filename).toLowerCase()`

```typescript
import fc from 'fast-check';
import { validateFile, BLOCKED_EXTENSIONS, SAFE_EXTENSIONS } from '@/lib/file-security';

describe('File validation', () => {
  it('all blocked extensions are rejected regardless of case', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...BLOCKED_EXTENSIONS),
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 1, maxLength: 20 }),
        (ext, name) => {
          const upper = validateFile(`${name}${ext.toUpperCase()}`);
          const lower = validateFile(`${name}${ext.toLowerCase()}`);
          expect(upper.allowed).toBe(false);
          expect(lower.allowed).toBe(false);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('no file is both blocked and warning', () => {
    fc.assert(
      fc.property(fc.string(), (filename) => {
        const result = validateFile(filename);
        // Can't be both not-allowed AND warning
        if (!result.allowed) {
          expect(result.warning).toBe(false);
        }
      }),
      { numRuns: 5000 }
    );
  });
});
```

---

### 5.4 Text Similarity Symmetry and Bounds

- **Location:** `/home/user/App-Market/lib/similarity-detection.ts`
- **Pattern:** Invariant
- **Priority:** LOW
- **Functions:** `calculateTextSimilarity()`, `calculateNGramSimilarity()`, `calculateTitleSimilarity()`, `hammingDistance()`

**Properties:**
1. **Symmetry:** `similarity(a, b) === similarity(b, a)`
2. **Bounds:** `0 <= similarity(a, b) <= 1`
3. **Identity:** `similarity(a, a) === 1` (for non-empty strings)
4. **Hamming distance symmetry:** `hammingDistance(a, b) === hammingDistance(b, a)`

```typescript
import fc from 'fast-check';
import {
  calculateTextSimilarity,
  calculateNGramSimilarity,
  hammingDistance,
} from '@/lib/similarity-detection';

describe('Similarity functions', () => {
  it('text similarity is symmetric', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (a, b) => {
        expect(calculateTextSimilarity(a, b)).toBeCloseTo(
          calculateTextSimilarity(b, a),
          10
        );
      }),
      { numRuns: 5000 }
    );
  });

  it('similarity is bounded [0, 1]', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (a, b) => {
        const sim = calculateNGramSimilarity(a, b);
        expect(sim).toBeGreaterThanOrEqual(0);
        expect(sim).toBeLessThanOrEqual(1);
      }),
      { numRuns: 5000 }
    );
  });

  it('similarity with self is 1 for non-trivial strings', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5 }).filter(s => /[a-z]/i.test(s)),
        (s) => {
          expect(calculateNGramSimilarity(s, s)).toBe(1);
        }
      ),
      { numRuns: 2000 }
    );
  });

  it('hamming distance is symmetric', () => {
    fc.assert(
      fc.property(fc.hexaString(), fc.hexaString(), (a, b) => {
        expect(hammingDistance(a, b)).toBe(hammingDistance(b, a));
      }),
      { numRuns: 5000 }
    );
  });
});
```

---

### 5.5 Transaction State Machine Invariants

- **Location:** `/home/user/App-Market/lib/validation.ts` (lines 71-84)
- **Pattern:** State machine invariant
- **Priority:** MEDIUM
- **Constant:** `VALID_TRANSACTION_TRANSITIONS`
- **Function:** `isValidTransactionTransition()`

**Properties:**
1. Terminal states (COMPLETED, REFUNDED, CANCELLED) have no valid transitions
2. No state can transition to itself
3. All states mentioned as targets exist as source states (graph completeness)
4. PENDING is the only initial state

```typescript
import fc from 'fast-check';
import {
  VALID_TRANSACTION_TRANSITIONS,
  isValidTransactionTransition,
} from '@/lib/validation';

describe('Transaction state machine', () => {
  const allStates = Object.keys(VALID_TRANSACTION_TRANSITIONS);

  it('terminal states have no outgoing transitions', () => {
    const terminalStates = ['COMPLETED', 'REFUNDED', 'CANCELLED'];
    terminalStates.forEach(state => {
      expect(VALID_TRANSACTION_TRANSITIONS[state]).toEqual([]);
    });
  });

  it('no state transitions to itself', () => {
    allStates.forEach(state => {
      expect(VALID_TRANSACTION_TRANSITIONS[state]).not.toContain(state);
    });
  });

  it('all target states exist as source states', () => {
    allStates.forEach(state => {
      VALID_TRANSACTION_TRANSITIONS[state].forEach(target => {
        expect(allStates).toContain(target);
      });
    });
  });

  it('isValidTransactionTransition agrees with lookup table', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allStates),
        fc.constantFrom(...allStates),
        (from, to) => {
          const expected = VALID_TRANSACTION_TRANSITIONS[from]?.includes(to) ?? false;
          expect(isValidTransactionTransition(from, to)).toBe(expected);
        }
      ),
      { numRuns: 5000 }
    );
  });
});
```

---

## 6. Implementation Recommendations

### Priority Order for Implementation

| Priority | Candidate | Risk | Effort |
|----------|-----------|------|--------|
| 1 | 2.1 Fee Calculation Invariants | Funds loss | Low |
| 2 | 1.1 Keypair Serialize/Deserialize | Key loss | Low |
| 3 | 2.2 Partner Payment Distribution | Funds loss | Low |
| 4 | 1.4 SOL/Lamports Conversion | Precision loss | Low |
| 5 | 1.2 Encryption Roundtrip | Data loss | Low |
| 6 | 4.1 Slug Generation | Injection/routing | Low |
| 7 | 3.1 Solana Address Validator | Auth bypass | Low |
| 8 | 5.1 CSRF Token Roundtrip | CSRF bypass | Low |
| 9 | 5.5 Transaction State Machine | Logic bypass | Medium |
| 10 | 3.2 URL Validation | XSS/injection | Low |
| 11 | 5.2 Webhook Signature Roundtrip | Auth bypass | Low |
| 12 | 2.5 Token Unit Conversion | Precision loss | Low |
| 13 | 5.3 File Extension Validation | Malware upload | Medium |
| 14 | 1.3 Base64 Encode/Decode | Signature bypass | Low |
| 15 | 4.2 Search Query Sanitization | Injection | Low |
| 16 | 2.3 Token Launch Allocation | Funds loss | Low |
| 17 | 2.4 Revenue Distribution | Funds loss | Low |
| 18 | 5.4 Similarity Detection | Logic error | Medium |

### Setup Instructions

1. **Install fast-check:**
   ```bash
   npm install --save-dev fast-check
   ```

2. **Create test directory:**
   ```bash
   mkdir -p tests/property-based
   ```

3. **Configure Jest/Vitest** to include the new test directory.

4. **Start with financial invariants** (candidates 2.1, 2.2, 1.4) as these have the highest security impact and lowest implementation effort.

### Key Findings and Concerns

1. **Duplicate `isValidUrl` functions:** `/home/user/App-Market/lib/validation.ts` and `/home/user/App-Market/lib/utils.ts` both export `isValidUrl()` with different security properties. The `validation.ts` version checks protocol; the `utils.ts` version does not. Any code importing from `utils.ts` is vulnerable to `javascript:` URL injection.

2. **`toTokenUnits` uses `Math.floor(amount * Math.pow(10, decimals))`** which is susceptible to floating-point precision errors. For example, `0.1 * Math.pow(10, 9)` may not exactly equal `100000000`. The `solToLamports` function uses a string-splitting approach to avoid this, but `toTokenUnits` does not. This inconsistency could cause discrepancies between SOL conversions and APP/USDC conversions.

3. **`lamportsToSol` uses plain division** (`value / LAMPORTS_PER_SOL`) which can introduce floating-point imprecision. Combined with the string-based `solToLamports`, the roundtrip is not guaranteed to be lossless for all values.

4. **Slug generation can produce empty strings** for inputs containing only special characters (e.g., `"!!!"` produces `""`). The listing creation code does not check for this, which could result in empty slugs in the database.

5. **The `looksEncrypted` heuristic** only checks minimum length, not actual encryption format. A sufficiently long base64 string that was not produced by `encrypt()` would pass this check, potentially causing `decrypt()` to fail with a confusing error.

---

*Report generated by Trail of Bits property-based-testing security skill analysis.*
