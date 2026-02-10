# App-Market Full-Stack Security Review — Executive Summary

**Date:** 2026-02-10
**Scope:** Full codebase — Next.js frontend/API, Prisma ORM, Solana smart contract integration, authentication, middleware, business logic
**Methodology:** Automated static analysis + manual code review across 5 audit domains

---

## Aggregate Findings

| Severity | Count | Description |
|----------|-------|-------------|
| **CRITICAL** | 5 | Immediate exploitation risk — data loss, fund theft, or full compromise |
| **HIGH** | 13 | Significant risk requiring prompt remediation |
| **MEDIUM** | 29 | Moderate risk — defense-in-depth gaps |
| **LOW** | 16 | Minor issues or hardening opportunities |
| **Total** | **63** | |

---

## Top 10 Critical & High-Priority Findings

### CRITICAL

| # | Finding | File | Impact |
|---|---------|------|--------|
| 1 | **Mint keypair secret key leaked to client** | `app/api/token-launch/deploy/route.ts:176` | Full 64-byte secret key returned in JSON response. Any interceptor (XSS, browser extension, proxy) can steal mint authority. |
| 2 | **Escrow auto-release never executes on-chain** | `app/api/cron/escrow-auto-release/route.ts` | Cron marks transactions COMPLETED in DB without calling escrow release on-chain — funds permanently locked in PDA. |
| 3 | **On-chain payment verification silently swallowed** | `app/api/purchases/route.ts:87-90` | RPC errors during tx verification are caught and ignored, allowing purchases to be recorded without actual payment. |
| 4 | **Offers created without on-chain escrow** | `app/api/offers/route.ts:89-91` | Offers are DB-only with no fund lockup, enabling costless spam that locks seller listings. |
| 5 | **Transactions recorded without verified payment** | `app/api/transactions/route.ts:258-276` | Listings marked SOLD and transaction records created before on-chain payment is verified. |

### HIGH (Top 5)

| # | Finding | File | Impact |
|---|---------|------|--------|
| 6 | **26 route files bypass session revocation** | Multiple routes using `getServerSession()` | Financial endpoints (offer acceptance, withdrawal, token deploy) never check the session blacklist. |
| 7 | **CSRF protection on only 4 of 20+ state-changing endpoints** | `lib/csrf.ts` + routes | Transaction confirm, transfer complete, withdrawal claim, dispute resolution, and more lack CSRF. |
| 8 | **Buy-now sends SOL to treasury, not escrow PDA** | Purchase flow routes | Bypasses all smart contract protections — no escrow, no refund path. |
| 9 | **Zero slippage protection on PATO initial buys** | Token launch routes | `minimumAmountOut: new BN(0)` enables sandwich attacks. |
| 10 | **In-memory rate limiting fallback in serverless** | `lib/rate-limit.ts:126-133` | If Upstash is misconfigured, rate limiting silently fails — each serverless invocation has isolated memory. |

---

## Findings by Domain

### 1. Authentication & Authorization (01-auth.md) — 20 findings
- 1 CRITICAL, 4 HIGH, 6 MEDIUM, 4 LOW, 5 positive observations
- **Key theme:** Strong auth infrastructure (CSRF HMAC, bcrypt, Ed25519 nonce verification) but inconsistent application — 26 routes bypass session revocation, debug page exposed.

### 2. API & Input Validation (02-api-validation.md) — 19 findings
- 1 CRITICAL, 4 HIGH, 8 MEDIUM, 6 LOW
- **Key theme:** Prisma ORM prevents SQL injection, Zod validation on uploads, but unsanitized query params in listing filters, mass assignment risk in profile updates, and debug endpoint exposure.

### 3. Blockchain / Solana (03-blockchain.md) — 18 findings
- 3 CRITICAL, 5 HIGH, 5 MEDIUM, 5 LOW
- **Key theme:** Rust smart contract is well-written (overflow-safe, anti-sniping, timelocks), but the TypeScript integration layer has critical gaps — leaked keys, missing on-chain verification, DB/chain state divergence.

### 4. Middleware, CSRF & Transport (04-middleware.md) — 20 findings
- 0 CRITICAL, 3 HIGH, 10 MEDIUM, 4 LOW, 1 INFO
- **Key theme:** Security headers and cookie config are solid. The CSRF and rate-limiting libraries are well-implemented but applied to only a fraction of endpoints.

### 5. Business Logic & Secrets (05-business-logic.md) — 27 findings
- 3 CRITICAL, 5 HIGH, 11 MEDIUM, 6 LOW, 13 positive observations
- **Key theme:** Serializable DB transactions prevent many race conditions. Main risks are DB/on-chain state divergence and missing escrow enforcement on offers.

---

## Positive Security Observations

The codebase demonstrates strong security engineering in many areas:

- **Cryptography:** AES-256-GCM encryption at rest, bcrypt (12 rounds) for API keys, Ed25519 signature verification with Redis-backed nonces
- **Timing safety:** Constant-time comparisons (`timingSafeEqual`) used consistently across webhook verification, API key checks, and CSRF validation
- **Database safety:** Prisma parameterized queries eliminate SQL injection; serializable isolation level transactions prevent race conditions on bids/purchases
- **Smart contract:** Checks-Effects-Interactions pattern, overflow-safe BN arithmetic, anti-sniping protection, 48-hour admin timelocks, fee locking at listing time
- **Session management:** Database-backed session revocation system, secure cookie flags (httpOnly, secure, sameSite)
- **Upload security:** Magic byte validation, Zod schema validation, SSRF protection
- **Headers:** Comprehensive CSP, HSTS, X-Frame-Options, X-Content-Type-Options in next.config.js

---

## Recommended Remediation Priority

### Immediate (Week 1)
1. Remove secret key from token-launch deploy response — sign server-side
2. Fix escrow auto-release to execute on-chain release before marking DB complete
3. Make on-chain payment verification mandatory (don't swallow RPC errors)
4. Require on-chain escrow for offers, or at minimum validate wallet balance

### Short-term (Weeks 2-3)
5. Migrate all 26 routes from `getServerSession()` to `getAuthToken()` for revocation support
6. Apply CSRF middleware to all state-changing endpoints
7. Add rate limiting to all financial endpoints
8. Fix buy-now flow to route through escrow PDA
9. Set proper slippage on PATO buys
10. Block in-memory rate-limit fallback in production (fail closed)

### Medium-term (Month 2)
11. Remove debug session page or gate behind admin auth
12. Clean up orphaned registration endpoint
13. Add input validation/sanitization to listing query parameters
14. Implement on-chain verification for transfer completion and withdrawal claims
15. Add dispute resolution atomicity guarantees

---

## Detailed Reports

| Report | File | Findings |
|--------|------|----------|
| Authentication & Authorization | [01-auth.md](./01-auth.md) | 20 |
| API & Input Validation | [02-api-validation.md](./02-api-validation.md) | 19 |
| Blockchain / Solana | [03-blockchain.md](./03-blockchain.md) | 18 |
| Middleware, CSRF & Transport | [04-middleware.md](./04-middleware.md) | 20 |
| Business Logic & Secrets | [05-business-logic.md](./05-business-logic.md) | 27 |
