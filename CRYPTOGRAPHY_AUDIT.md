# Cryptography Audit Report

**Project:** App Market
**Audit Date:** 2026-01-31
**Auditor:** Claude Opus 4.5
**Scope:** Cryptographic implementation review

---

## Executive Summary

This audit examines the cryptographic implementations in the App Market codebase, focusing on wallet signature verification, JWT/token handling, random number generation, hash functions, key management, and encryption practices.

### Risk Summary

| Category | Risk Level | Critical Issues |
|----------|------------|-----------------|
| Wallet Signature Verification | **MEDIUM** | Missing replay protection |
| JWT/Token Handling | **LOW** | Secure defaults via NextAuth |
| Random Number Generation | **LOW** | Proper CSPRNG usage |
| Hash Functions | **LOW** | Modern algorithms in use |
| Key Management | **MEDIUM** | Hardcoded fallback secrets |
| Encryption | **LOW** | Delegated to third-party services |

---

## 1. Wallet Signature Verification

### 1.1 Implementation Overview

**Location:** `/Users/dasherxd/Desktop/App-Market/lib/wallet-verification.ts`

The codebase uses TweetNaCl (`tweetnacl`) for Ed25519 signature verification of Solana wallet signatures.

```typescript
// lib/wallet-verification.ts (lines 44-54)
const verified = nacl.sign.detached.verify(
  messageUint8,
  signatureUint8,
  publicKeyUint8
);
```

**Strengths:**
- Uses `nacl.sign.detached.verify()` - a well-audited implementation of Ed25519
- Proper encoding: Base58 for signatures, UTF-8 for messages
- Validates public key format using `@solana/web3.js` PublicKey class

### 1.2 Message Construction

**Location:** `/Users/dasherxd/Desktop/App-Market/hooks/useAutoWalletAuth.ts`

```typescript
// hooks/useAutoWalletAuth.ts (lines 70-72)
const message = `Sign this message to authenticate with App Market.\n\nWallet: ${publicKey.toBase58()}\nTimestamp: ${new Date().toISOString()}`;
```

**Analysis:**
- **POSITIVE:** Includes timestamp in the signed message
- **POSITIVE:** Includes wallet address, binding signature to specific wallet
- **POSITIVE:** Human-readable message format

### 1.3 Replay Attack Prevention

**CRITICAL FINDING:** The current implementation has **weak replay protection**.

**Issues Identified:**
1. **No server-side nonce/challenge:** The timestamp is generated client-side, not by the server
2. **No timestamp validation:** Server does not verify that the timestamp is within an acceptable window
3. **No signature storage:** Previously used signatures are not tracked to prevent reuse
4. **No chain binding:** No domain or chain-specific data included in the signed message

**Vulnerable Code Path:**
```typescript
// app/api/auth/wallet/verify/route.ts - No replay validation
const result = await verifyWalletSignature(publicKey, signature, message);
// Message content is not validated against server-issued nonces
```

**Risk:** An attacker who intercepts a valid signature could replay it to authenticate as the victim within an undefined time window.

**Recommendations:**
1. Implement server-issued nonces (challenges) that expire after use
2. Add server-side timestamp validation (e.g., signature valid for 5 minutes)
3. Store used signatures/nonces in a cache (Redis) or database to prevent replay
4. Include domain binding (e.g., `"Domain: appmrkt.xyz"`) in the signed message

---

## 2. JWT/Token Handling

### 2.1 JWT Algorithm Configuration

**Location:** `/Users/dasherxd/Desktop/App-Market/lib/auth.ts`

The application uses NextAuth.js v4 with JWT sessions:

```typescript
// lib/auth.ts (lines 107-109)
session: {
  strategy: "jwt",
  maxAge: 30 * 24 * 60 * 60, // 30 days
},
```

**Configuration Analysis:**
- NextAuth.js handles JWT signing internally
- Uses `NEXTAUTH_SECRET` for HMAC-based token signing
- Default algorithm: HS256 (via jose library)

**Strengths:**
- Algorithm is not configurable by the client (prevents algorithm confusion attacks)
- Secret validation enforced in production
- 30-day token expiration is reasonable for user experience

### 2.2 Token Expiration

| Token Type | Expiration | Location |
|------------|------------|----------|
| NextAuth Session JWT | 30 days | `lib/auth.ts:109` |
| Twitter OAuth Cookie | 10 minutes | `app/api/auth/twitter/connect/route.ts:72` |
| Privy Access Token | Managed by Privy | External service |

**Finding:** Session tokens have a 30-day lifespan. Consider implementing sliding window refresh or shorter expiration with refresh tokens for high-security actions.

### 2.3 Refresh Token Handling

**Analysis:** The codebase does not implement custom refresh token logic. Token refresh is handled by:
- NextAuth.js internal mechanisms
- Privy SDK for Privy-authenticated users

**Database Schema Shows:**
```prisma
// prisma/schema.prisma (lines 111-117)
refresh_token     String? @db.Text
access_token      String? @db.Text
expires_at        Int?
```

Tokens are stored in the database when using OAuth providers (GitHub, Google, Twitter).

### 2.4 Cookie Security

**Location:** `/Users/dasherxd/Desktop/App-Market/lib/auth.ts`

```typescript
// lib/auth.ts (lines 111-123)
cookies: {
  sessionToken: {
    name: process.env.NODE_ENV === "production"
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token",
    options: {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    },
  },
},
```

**Strengths:**
- `httpOnly: true` - Prevents XSS token theft
- `secure: true` in production - HTTPS only
- `__Secure-` prefix in production - Additional browser enforcement
- `sameSite: "lax"` - CSRF protection

---

## 3. Random Number Generation

### 3.1 Cryptographically Secure Random (CSPRNG)

**POSITIVE FINDING:** Security-sensitive operations use proper CSPRNG.

| Usage | Implementation | Location |
|-------|----------------|----------|
| Referral Code Generation | `crypto.randomBytes(4)` | `lib/wallet-verification.ts:23` |
| Twitter OAuth State | `crypto.randomBytes(16)` | `app/api/auth/twitter/connect/route.ts:42` |
| PKCE Code Verifier | `crypto.randomBytes(32)` | `app/api/auth/twitter/connect/route.ts:14` |

```typescript
// lib/wallet-verification.ts (lines 21-24)
function generateReferralCode(): string {
  return crypto.randomBytes(4).toString("hex").toLowerCase();
}
```

```typescript
// app/api/auth/twitter/connect/route.ts (lines 13-18)
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}
```

### 3.2 Insecure Random Usage (Non-Critical)

**Math.random() Usage Found:**

| Location | Usage | Risk |
|----------|-------|------|
| `lib/wallet-verification.ts:83` | Username suffix generation | **LOW** - Not security sensitive |
| `app/api/auth/register/route.ts:57` | Username uniqueness | **LOW** - Not security sensitive |
| `lib/store.ts:78` | Notification ID generation | **LOW** - Client-side only |

**Assessment:** `Math.random()` is used only for non-security-critical operations (username uniqueness, UI identifiers). Acceptable usage.

---

## 4. Hash Functions

### 4.1 Current Hash Algorithm Usage

| Algorithm | Library | Usage | Status |
|-----------|---------|-------|--------|
| SHA-256 | Node.js `crypto` | PKCE code challenge | **Secure** |
| bcrypt | `bcryptjs` | Password hashing | **Secure** |
| Ed25519 | `tweetnacl` | Wallet signatures | **Secure** |

**PKCE Implementation:**
```typescript
// app/api/auth/twitter/connect/route.ts (lines 17-19)
function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}
```

**Password Hashing:**
```typescript
// app/api/auth/register/route.ts (line 48)
const passwordHash = await hash(password, 12);
```

**Assessment:** Cost factor of 12 is acceptable (approximately 2^12 iterations).

### 4.2 Deprecated Algorithms

**POSITIVE FINDING:** No usage of MD5 or SHA-1 for security-sensitive operations detected in the codebase.

---

## 5. Key Management

### 5.1 Key Storage

**Environment Variables Required:**
| Key | Purpose | Location |
|-----|---------|----------|
| `NEXTAUTH_SECRET` | JWT signing | `.env` |
| `PRIVY_APP_SECRET` | Privy authentication | `.env` |
| `TWITTER_CLIENT_SECRET` | OAuth | `.env` |
| `STRIPE_SECRET_KEY` | Payment processing | `.env` |

### 5.2 Hardcoded Keys - SECURITY CONCERN

**FINDING:** Hardcoded fallback secret detected.

```typescript
// lib/auth.ts (lines 24, 32)
secret: secret || "development-secret-change-in-production",
```

**Risk:**
- If `NEXTAUTH_SECRET` is not set, a well-known string is used
- Production check exists but only throws error if undefined AND in production:

```typescript
// lib/auth.ts (lines 12-14)
if (!secret && process.env.NODE_ENV === "production") {
  throw new Error("NEXTAUTH_SECRET must be set in production");
}
```

**Additional Hardcoded Values Found:**

```typescript
// app/api/admin/reset-listings/route.ts (lines 7-8)
const ADMIN_SECRET = process.env.ADMIN_SECRET || "devnet-reset-2024";
```

```typescript
// lib/solana.ts (lines 5-7)
export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || "9udUgupraga6dj92zfLec8bAdXUZsU3FGNN3Lf8XGzog"
);
```

**Recommendations:**
1. Remove fallback secret strings
2. Fail fast if required secrets are not configured
3. Add startup validation for all critical environment variables

### 5.3 Key Rotation Support

**FINDING:** No explicit key rotation mechanism implemented.

**Affected:**
- `NEXTAUTH_SECRET` - Rotation requires session invalidation
- `PRIVY_APP_SECRET` - Managed by Privy
- Database connection strings - Manual update required

**Recommendation:** Consider implementing key versioning for graceful rotation.

---

## 6. Encryption

### 6.1 Data at Rest

**Analysis:** The application does not implement custom encryption at rest.

**Sensitive Data Storage:**
| Data Type | Storage | Encryption |
|-----------|---------|------------|
| Passwords | PostgreSQL | bcrypt hash (one-way) |
| OAuth Tokens | PostgreSQL | Plaintext (relies on DB access control) |
| Wallet Addresses | PostgreSQL | Plaintext (public data) |
| Session Tokens | Browser Cookie | JWT-signed (not encrypted) |

**Recommendation:** Consider encrypting OAuth tokens at rest using envelope encryption.

### 6.2 Transport Encryption

**POSITIVE FINDINGS:**
- Production cookies require `secure: true` (HTTPS only)
- Next.js configuration defaults to HTTPS for external URLs
- All API calls to third parties use HTTPS:
  - Twitter API: `https://api.twitter.com`
  - GitHub API: `https://api.github.com`

### 6.3 Sensitive Field Encryption

**Not Implemented.** The following fields are stored in plaintext and may benefit from field-level encryption:

| Field | Table | Current State |
|-------|-------|---------------|
| `passwordHash` | User | Hashed (bcrypt) - OK |
| `refresh_token` | Account | Plaintext |
| `access_token` | Account | Plaintext |

---

## 7. Third-Party Cryptographic Dependencies

### 7.1 Dependency Analysis

| Package | Version | Purpose | Security Notes |
|---------|---------|---------|----------------|
| `tweetnacl` | ^1.0.3 | Ed25519 signatures | Well-audited, maintained |
| `bcryptjs` | ^2.4.3 | Password hashing | Pure JS implementation |
| `jose` | ^5.2.2 | JWT operations | Modern, actively maintained |
| `next-auth` | ^4.24.6 | Authentication | Widely used, regular updates |
| `@privy-io/server-auth` | ^1.14.0 | Privy token verification | Vendor-managed |
| `bs58` | ^5.0.0 | Base58 encoding | Standard implementation |

### 7.2 Dependency Recommendations

1. Keep dependencies updated - especially security-sensitive packages
2. Monitor for CVEs in `jose`, `next-auth`, and `@prisma/client`
3. Consider pinning exact versions for cryptographic libraries

---

## 8. Summary of Findings

### Critical Issues (Immediate Action Required)

| ID | Issue | Location | Recommendation |
|----|-------|----------|----------------|
| CRYPTO-01 | No server-side nonce for wallet signatures | `lib/wallet-verification.ts` | Implement server-issued challenges |
| CRYPTO-02 | No timestamp validation on signatures | `lib/wallet-verification.ts` | Add 5-minute validity window |

### Medium Issues (Address Soon)

| ID | Issue | Location | Recommendation |
|----|-------|----------|----------------|
| CRYPTO-03 | Hardcoded fallback secrets | `lib/auth.ts:24`, `api/admin/reset-listings/route.ts:8` | Remove fallbacks, fail on missing config |
| CRYPTO-04 | OAuth tokens stored in plaintext | `prisma/schema.prisma` | Implement field-level encryption |
| CRYPTO-05 | No key rotation mechanism | N/A | Design key versioning system |

### Low Issues (Best Practices)

| ID | Issue | Location | Recommendation |
|----|-------|----------|----------------|
| CRYPTO-06 | 30-day session expiration | `lib/auth.ts:109` | Consider shorter expiration for sensitive actions |
| CRYPTO-07 | No signature replay cache | N/A | Store used signatures to prevent reuse |

---

## 9. Positive Security Practices Observed

1. **Proper CSPRNG usage** for security-sensitive random generation
2. **bcrypt with adequate cost factor** (12) for password hashing
3. **Secure cookie configuration** (httpOnly, secure, sameSite)
4. **Ed25519 signatures** via battle-tested TweetNaCl library
5. **PKCE implementation** for Twitter OAuth 2.0
6. **No deprecated hash algorithms** (MD5, SHA-1) in security contexts
7. **Production secret enforcement** (throws error if NEXTAUTH_SECRET missing)
8. **HTTPS-only transport** for third-party API calls

---

## 10. Remediation Priority

1. **Immediate (Week 1):**
   - Implement server-side nonce generation for wallet authentication
   - Add timestamp validation (5-minute window) for signatures
   - Remove hardcoded fallback secrets

2. **Short-term (Month 1):**
   - Implement signature replay prevention (nonce cache)
   - Add field-level encryption for OAuth tokens
   - Audit all environment variable usage

3. **Long-term (Quarter 1):**
   - Design and implement key rotation mechanism
   - Consider implementing refresh token rotation
   - Add cryptographic monitoring and alerting

---

*Report generated by Claude Opus 4.5 Security Analysis*
