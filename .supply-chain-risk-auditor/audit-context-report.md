# Security Audit Context Report: App-Market

**Generated:** 2026-03-06
**Scope:** Deep architecture and security surface analysis
**Status:** Research-only (no code modifications)

---

## 1. Architecture Overview

### Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | ^14.2.35 |
| Runtime | Node.js / Vercel Edge | - |
| Database | PostgreSQL via Prisma ORM | ^5.10.2 |
| Auth | NextAuth (Credentials + JWT) | ^4.24.6 |
| Auth (Social) | Privy (@privy-io/server-auth) | ^1.32.5 |
| Blockchain | Solana (web3.js + Anchor) | ^1.91.1 / ^0.29.0 |
| Token Platform | Meteora Dynamic Bonding Curve | ^1.5.2 |
| Cache/Rate Limit | Upstash Redis | ^1.36.2 |
| File Storage | Vercel Blob | ^2.0.1 |
| Validation | Zod + custom validators | ^3.22.3 |
| Crypto (JS) | jose, tweetnacl, bcryptjs | various |
| Encryption at rest | AES-256-GCM (node:crypto) | native |

### Application Domain

A peer-to-peer marketplace for buying/selling digital applications (SaaS, mobile apps, web apps, browser extensions). Features include:

- Auction and buy-now listings
- Solana on-chain escrow (smart contract)
- Offer/counter-offer negotiation
- Dispute resolution with on-chain arbitration
- Post-Acquisition Token Offering (PATO) via Meteora
- Auto-buyback of platform token
- Referral system with earnings
- Agent/SDK API with API keys and webhook delivery
- GitHub integration for code verification
- Twitter/X account linking
- Multi-wallet support
- Collaborator revenue sharing

### Directory Structure (Security-Relevant)

```
/
├── app/
│   ├── api/                    # ~40+ API route groups
│   │   ├── admin/              # Admin-only endpoints
│   │   ├── agent/              # SDK/Agent API (API key auth)
│   │   ├── auth/               # NextAuth + wallet + twitter + register
│   │   ├── cron/               # 9 scheduled job endpoints
│   │   ├── csrf/               # CSRF token endpoint
│   │   ├── webhooks/           # External webhook receivers
│   │   ├── token-launch/       # PATO token creation
│   │   ├── transfers/          # Asset transfer workflow
│   │   ├── transactions/       # Escrow/purchase flow
│   │   ├── disputes/           # Dispute resolution
│   │   └── ...                 # listings, bids, offers, etc.
│   └── (pages)                 # UI routes
├── lib/
│   ├── auth.ts                 # NextAuth config, session management
│   ├── agent-auth.ts           # API key + wallet sig auth for agents
│   ├── encryption.ts           # AES-256-GCM encrypt/decrypt
│   ├── account-token-encryption.ts  # OAuth token encryption at rest
│   ├── db-middleware.ts         # Prisma middleware (auto-encrypt)
│   ├── csrf.ts                 # CSRF double-submit cookie
│   ├── rate-limit.ts           # Upstash Redis rate limiting
│   ├── validation.ts           # Input validation + replay protection
│   ├── wallet-verification.ts  # Solana signature verification
│   ├── file-security.ts        # File type validation + magic bytes
│   ├── cron-auth.ts            # Cron secret verification
│   ├── audit.ts                # Audit logging to DB
│   ├── webhooks.ts             # Webhook dispatch + HMAC signing
│   ├── solana.ts               # Solana constants, PDAs, fee math
│   ├── solana-contract.ts      # On-chain transaction builders
│   ├── config.ts               # Platform config (fees, settings)
│   ├── env-validation.ts       # Startup env var validation
│   ├── meteora-dbc.ts          # Meteora bonding curve integration
│   ├── buyback.ts              # Auto-buyback service
│   └── vanity-keygen.ts        # Vanity keypair generation for tokens
├── prisma/
│   └── schema.prisma           # 30+ models, PostgreSQL
├── middleware.ts                # Edge middleware (auth + route protection)
├── programs/                   # Solana smart contract (Rust/Anchor)
└── next.config.js              # Security headers, CSP
```

---

## 2. Security-Critical Components Inventory

### 2.1 Authentication System

**File:** `/lib/auth.ts`

- **Strategy:** JWT-based sessions via NextAuth CredentialsProvider
- **Providers:**
  1. **Wallet** (Solana): User signs a message with their wallet; server verifies via `tweetnacl.sign.detached.verify`
  2. **Privy** (Social): Email/Twitter/Wallet via Privy; server verifies auth token via `privyClient.verifyAuthToken()`
- **Session Revocation:** Database-backed (`RevokedSession` table); checked on every `getAuthToken()` call
- **Session Config:** JWT strategy, 7-day max age, `HttpOnly`, `SameSite=Lax`, `Secure` in production
- **Cookie Naming:** `__Secure-next-auth.session-token` in production
- **Admin Check:** `isAdmin` re-fetched from DB on every JWT refresh (prevents stale admin status)
- **Rate Limiting:** Auth POST endpoint rate-limited to 5/min

**File:** `/lib/agent-auth.ts`

- **API Key Auth:** bcrypt-hashed keys with `ak_live_` prefix, 32 random bytes via `nacl.randomBytes`
- **Wallet Signature Auth:** For agents, with 30-second timestamp tolerance, mandatory nonce, Redis-backed replay protection
- **Permission System:** READ, WRITE, TRANSACTION, ADMIN granular permissions per API key

### 2.2 Authorization Model

**File:** `/middleware.ts` (Edge Runtime)

- **Protected Routes:** Dashboard, settings, messages, notifications, transactions, disputes
- **Protected API Routes:** ~20 route prefixes requiring auth for non-GET or non-public operations
- **Admin Routes:** `/admin`, `/api/admin` require `token.isAdmin`
- **Cron Routes:** `/api/cron/*` require `Bearer <CRON_SECRET>` with timing-safe comparison
- **Public Read:** GET on listings, reviews, stats, leaderboard, public profiles allowed without auth

**IMPORTANT NOTE:** Middleware runs in Edge Runtime (no Prisma), so it cannot check session revocation. Revocation is only enforced in route handlers via `getAuthToken()`. This is documented as defense-in-depth.

### 2.3 Cryptographic Usage

| Purpose | Algorithm | Library | Key Management |
|---------|-----------|---------|----------------|
| Session signing | HS256 JWT | next-auth/jwt | NEXTAUTH_SECRET env var |
| Data encryption at rest | AES-256-GCM | node:crypto | ENCRYPTION_SECRET + scrypt KDF |
| OAuth token encryption | AES-256-GCM | lib/encryption.ts | With AAD (providerAccountId) |
| Wallet signature verification | Ed25519 | tweetnacl | Solana public keys |
| API key hashing | bcrypt (cost=12) | bcryptjs | Hashes stored in DB |
| CSRF tokens | HMAC-SHA256 | node:crypto | CSRF_SECRET or NEXTAUTH_SECRET |
| Webhook signing | HMAC-SHA256 | node:crypto | Per-webhook secret (encrypted at rest) |
| Cron auth | Timing-safe comparison | node:crypto | CRON_SECRET env var |
| Referral codes | crypto.randomBytes(8) | node:crypto | 64 bits of entropy |
| Session IDs | crypto.randomBytes(32) | node:crypto | 256 bits of entropy |

### 2.4 External Integrations

| Integration | Purpose | Auth Method | Risk Level |
|-------------|---------|-------------|------------|
| Solana RPC | Blockchain queries/transactions | RPC URL | HIGH - financial operations |
| Solana Smart Contract | Escrow, auctions, disputes | Wallet signatures | CRITICAL - holds funds |
| Privy | Social authentication | App ID + Secret | HIGH - identity provider |
| Vercel Blob | Profile picture storage | BLOB_READ_WRITE_TOKEN | MEDIUM - file upload |
| Upstash Redis | Rate limiting, nonce tracking | REST URL + Token | HIGH - security control |
| GitHub (Octokit) | Code verification | OAuth | MEDIUM - trust signal |
| Twitter/X OAuth 2.0 | Account linking | Client ID + Secret | MEDIUM - reputation |
| Meteora DBC | Token launch (PATO) | On-chain | HIGH - financial |
| Jupiter (planned) | Token buyback swaps | On-chain | HIGH - financial |

### 2.5 Input Validation

**File:** `/lib/validation.ts`

- Pagination sanitization (max 100 items)
- Search query length limits (200 chars)
- Message length limits (5000 chars)
- UUID format validation
- Solana address validation (Base58)
- URL protocol validation (http/https only)
- Password complexity validation
- Transaction state machine validation

**File:** `/lib/file-security.ts`

- Blocked executable extensions (~40 types)
- Warning extensions for archives/documents
- Magic byte validation (file signature verification)
- MIME type validation
- Comprehensive file validation pipeline

### 2.6 CSRF Protection

**File:** `/lib/csrf.ts`

- Double-submit cookie pattern with HMAC verification
- `__Host-` prefix cookie (domain-locked, HTTPS-only)
- 8-hour token expiry
- Timing-safe signature comparison
- Applied to ~27 state-changing API route handlers

### 2.7 Rate Limiting

**File:** `/lib/rate-limit.ts`

- Upstash Redis sliding window (production)
- In-memory fallback (development only; refuses to run in production)
- Presets: auth (5/min), write (10/min), search (30/min), read (100/min), static (200/min)
- IP extraction uses rightmost x-forwarded-for (Vercel proxy-aware)
- Agent API has separate rate limiting via `checkAgentRateLimit()`

### 2.8 Audit Logging

**File:** `/lib/audit.ts`

- Database-backed audit trail (`AuditLog` model)
- Tracks: auth events, admin actions, transactions, escrow, withdrawals, profile changes, rate limit violations
- Captures: IP address, user agent, target ID, metadata
- Fire-and-forget (never blocks main flow)

---

## 3. Trust Boundaries Map

```
                                    INTERNET
                                       |
                     [Vercel Edge / CDN]
                           |
                    +--------------+
                    | MIDDLEWARE.TS |  <-- Trust Boundary 1: Edge Auth
                    |  (JWT check) |      Crosses: session tokens
                    +--------------+      Validates: JWT signature, admin flag
                           |              Risk: No session revocation check (Edge)
                           |
              +---------------------------+
              | NEXT.JS API ROUTE HANDLER |  <-- Trust Boundary 2: Server Auth
              |   getAuthToken() / CSRF   |      Crosses: user input, credentials
              +---------------------------+      Validates: JWT + revocation + CSRF
                     |            |
          +----------+    +------+--------+
          |               |               |
    +-----------+   +-----------+   +-----------+
    | PRISMA DB |   | UPSTASH   |   | SOLANA    |  <-- Trust Boundary 3: External
    | (Postgres)|   | REDIS     |   | RPC/Chain |      Services
    +-----------+   +-----------+   +-----------+
         |                                |
    +-----------+                  +-------------+
    | ENCRYPTED |                  | SMART       |  <-- Trust Boundary 4: On-chain
    | DATA REST |                  | CONTRACT    |      Crosses: SOL, escrow funds
    +-----------+                  | (Rust/      |      Validates: program logic
                                   | Anchor)     |
                                   +-------------+
                                         |
                              +--------------------+
                              | EXTERNAL WEBHOOKS  |  <-- Trust Boundary 5: Outbound
                              | (User-configured)  |      Crosses: event data, HMAC sigs
                              +--------------------+

                              +--------------------+
                              | PRIVY / TWITTER /   |  <-- Trust Boundary 6: Identity
                              | GITHUB APIs         |      Crosses: auth tokens, identity
                              +--------------------+
```

### Trust Boundary Details

#### TB1: Edge Middleware -> API Handler
- **Crosses:** JWT session token (cookie), request URL, HTTP method
- **Validates:** JWT signature via `next-auth/jwt getToken()`, `isAdmin` flag in JWT
- **Gap:** Cannot check session revocation (no Prisma in Edge Runtime)
- **Risk:** Revoked session could pass middleware but is caught by `getAuthToken()` in handler

#### TB2: API Handler -> User Input
- **Crosses:** Request body (JSON), query parameters, form data, file uploads
- **Validates:** Auth via `getAuthToken()` (includes revocation check), CSRF for mutations, Zod/custom input validation, file magic bytes
- **Risk:** Inconsistent validation across 67+ route files; some routes may miss checks

#### TB3: Server -> Database (Prisma)
- **Crosses:** SQL queries (parameterized by Prisma), encrypted tokens
- **Validates:** Prisma parameterized queries (SQL injection resistant), encryption middleware for Account tokens
- **Risk:** `passwordHash` field exists in User model but wallet-based auth doesn't use it; stale field

#### TB4: Server -> Solana Blockchain
- **Crosses:** Transaction instructions, SOL transfers, escrow deposits/withdrawals
- **Validates:** Smart contract program logic (Rust/Anchor), PDA derivation
- **Risk:** Backend authority key (`BACKEND_AUTHORITY_SECRET_KEY`) stored in env; compromise = escrow manipulation

#### TB5: Server -> External Webhooks
- **Crosses:** Event payloads (listing, bid, transaction data), HMAC-SHA256 signatures
- **Validates:** Webhook secret (encrypted at rest), HMAC signature on payload
- **Risk:** SSRF potential via user-configured webhook URLs; 10-second timeout is the only mitigation

#### TB6: Server -> Identity Providers
- **Crosses:** Auth tokens, user identity claims (wallet, email, Twitter)
- **Validates:** Privy token verification server-side, only trusts Privy-verified claims (not client-supplied)
- **Risk:** Account linking logic is complex (wallet/email/Twitter merge paths)

---

## 4. Data Flow Diagrams

### 4.1 Authentication Flow (Wallet)

```
User Browser                    Next.js Server              Solana
    |                               |                         |
    |-- Sign message (wallet) ----->|                         |
    |   {publicKey, signature,      |                         |
    |    message, referralCode}     |                         |
    |                               |-- validateWalletSignatureMessage()
    |                               |   (format, timestamp, nonce/replay)
    |                               |                         |
    |                               |-- nacl.sign.verify() ---|
    |                               |                         |
    |                               |-- prisma.user.findOrCreate()
    |                               |                         |
    |                               |-- generateSessionId() (32 bytes)
    |                               |                         |
    |<-- Set-Cookie (JWT) ---------|                         |
    |   (HttpOnly, SameSite=Lax)   |                         |
```

### 4.2 Purchase/Escrow Flow

```
Buyer              Next.js API            Solana Contract        Seller
  |                    |                       |                    |
  |-- Buy Now -------->|                       |                    |
  |   (CSRF + JWT)     |                       |                    |
  |                    |-- createTransaction --|                    |
  |                    |-- buyNow() ---------->|                    |
  |                    |   (SOL to escrow PDA) |                    |
  |                    |                       |-- Hold in escrow --|
  |                    |                       |                    |
  |                    |                       |<-- sellerConfirm --|
  |                    |                       |   (transfer start) |
  |                    |                       |                    |
  |-- verifyUploads -->|-- verifyUploads() --->|                    |
  |   (backend auth)   |   (backendAuthority)  |                    |
  |                    |                       |                    |
  |-- confirmReceipt ->|-- confirmReceipt() -->|                    |
  |                    |   (release escrow)     |-- SOL to seller --|
  |                    |                       |-- fee to treasury -|
```

### 4.3 Agent API Flow

```
Agent/SDK              Next.js API              Database
   |                       |                       |
   |-- API Key or Wallet --|                       |
   |   Signature Auth      |                       |
   |                       |-- verifyApiKey()      |
   |                       |   (bcrypt compare)    |
   |                       |                       |
   |                       |-- checkPermission()   |
   |                       |   (READ/WRITE/TX)     |
   |                       |                       |
   |                       |-- checkRateLimit()    |
   |                       |   (Upstash Redis)     |
   |                       |                       |
   |<-- Response ---------|                       |
   |                       |                       |
   |                       |==== Webhook ==========|
   |<-- HMAC-signed event -|                       |
```

---

## 5. Attack Surface Summary

### 5.1 API Endpoints (67+ route files)

| Category | Count | Auth Required | CSRF Protected | Rate Limited |
|----------|-------|--------------|----------------|-------------|
| Admin | 3 | Yes (admin) | No (admin-secret) | Via middleware |
| Agent | ~15 | Yes (API key/sig) | No (API auth) | Yes (agent RL) |
| Auth | 6 | Varies | N/A (auth flow) | Yes (5/min) |
| Cron | 9 | Yes (CRON_SECRET) | N/A | N/A |
| Listings | ~8 | Write ops | Yes | Some |
| Transactions | ~8 | Yes | Yes | Some |
| Transfers | ~10 | Yes | Yes | Some |
| Offers/Bids | ~6 | Yes | Yes | Some |
| Profile/User | ~6 | Yes | Partial | Some |
| Other | ~10 | Varies | Varies | Varies |

### 5.2 High-Value Targets

1. **Escrow funds** (Solana smart contract) - Direct financial loss
2. **Backend authority key** (`BACKEND_AUTHORITY_SECRET_KEY`) - Can call `verifyUploads` to manipulate escrow state
3. **Admin account** (`isAdmin` flag) - Full platform control
4. **API keys** (bcrypt hashes in DB) - Agent impersonation
5. **Webhook secrets** (encrypted in DB) - Webhook forgery
6. **OAuth tokens** (encrypted in DB) - Account takeover
7. **ENCRYPTION_SECRET** env var - Decrypt all encrypted data at rest

### 5.3 Client-Side Attack Surface

- Solana wallet adapter (browser extension interaction)
- Privy auth modal (iframe-based)
- File uploads (profile pictures, transaction uploads)
- WebSocket connections (Solana RPC, Privy, WalletConnect)

---

## 6. Areas Needing Deeper Review

### CRITICAL Priority

1. **Smart Contract Audit** (`/programs/`): The Rust/Anchor smart contract controls escrow funds. The on-chain program logic has not been reviewed in this audit. The IDL at `idl/app_market.json` may be incomplete (warned in code). This is the highest-risk component.

2. **Backend Authority Key Security**: The `BACKEND_AUTHORITY_SECRET_KEY` env var is a Solana keypair that can call `verifyUploads()` on-chain. Compromise of this key allows an attacker to mark transfers as verified, releasing escrow funds. Review: key rotation strategy, access controls, logging of usage.

3. **Account Linking Logic** (`/lib/auth.ts`, lines 284-424): The Privy auth flow has complex account merge logic (find by privyUserId, then by wallet, then by email). Race conditions or edge cases in account linking could lead to account takeover. Review: concurrent registration, duplicate account merge, orphaned accounts.

### HIGH Priority

4. **CSRF Coverage Gaps**: CSRF validation is present in ~27 route handlers but there are ~67 route files. Verify all state-changing endpoints enforce CSRF. The profile image upload (`/api/user/profile/image/route.ts`) does NOT appear to check CSRF.

5. **Webhook SSRF**: User-configured webhook URLs are called with `fetch()`. The only mitigation is a 10-second timeout. No URL validation, no private IP blocking, no domain allowlisting. An attacker could use webhooks to probe internal networks.

6. **Rate Limiting Consistency**: Rate limiting is applied selectively. Not all write endpoints use `withRateLimitAsync()`. A systematic review of which endpoints are rate-limited vs which should be is needed.

7. **Cron Job Authorization**: Cron routes are protected by `CRON_SECRET` in both middleware and `verifyCronSecret()` (defense-in-depth), but verify all 9 cron handlers actually call `verifyCronSecret()` as belt-and-suspenders.

8. **Token Launch (PATO)**: The `/api/token-launch/` endpoint creates tokens and interacts with Meteora bonding curves. Vanity keypair generation (`vanity-keygen.ts`) and fee calculations need review for financial correctness.

### MEDIUM Priority

9. **Session Revocation Gap in Middleware**: Middleware cannot check session revocation (Edge Runtime limitation). While route handlers catch this, any route that relies solely on middleware for auth (without calling `getAuthToken()`) would honor revoked sessions.

10. **In-Memory Fallback Paths**: Several modules have in-memory fallbacks for dev (rate limiting, nonce tracking). While they refuse to run in production, verify no code path accidentally uses the fallback.

11. **Encryption Key Rotation**: No key rotation mechanism exists for `ENCRYPTION_SECRET`. Changing the secret would break decryption of all existing encrypted data. Need a migration strategy.

12. **`looksEncrypted()` Legacy Heuristic**: The function supports both `enc:v1:` prefix (reliable) and legacy base64 heuristic. The legacy path could produce false negatives on JWTs or other base64 data, leading to double-encryption or failed decryption.

13. **File Upload Security**: Profile image upload validates MIME type, extension, magic bytes, and file size (5MB). However, SVG files are listed as safe in `file-security.ts` but could contain embedded scripts. The image upload endpoint correctly limits to JPEG/PNG/GIF/WebP.

14. **Transaction State Machine**: `/lib/validation.ts` defines valid transaction state transitions. Verify the state machine matches the on-chain program's transitions exactly to prevent desync between DB state and on-chain state.

### LOW Priority

15. **CSP `unsafe-inline`**: The Content Security Policy allows `script-src 'unsafe-inline'` (noted as needed until Next.js nonce support). This weakens XSS protection.

16. **Debug Mode in Development**: `debug: process.env.NODE_ENV === 'development'` in NextAuth config is appropriate but verify no debug endpoints are exposed in production.

17. **Dependency Overrides**: `package.json` has overrides for `lodash`, `elliptic` (shimmed), `serialize-javascript`, `axios`, `hono`. Verify the shims don't introduce vulnerabilities (especially `elliptic-shim`).

18. **Unused Auth Providers**: `GITHUB_ID`/`GITHUB_SECRET` and `GOOGLE_ID`/`GOOGLE_SECRET` exist in `.env.example` but are marked as "not yet configured". Verify no code path accepts these credentials.

---

## 7. Security Controls Summary

### Present and Well-Implemented
- AES-256-GCM encryption at rest with AAD binding
- bcrypt for API key storage (cost factor 12)
- Timing-safe comparisons throughout (padded buffer approach)
- Atomic nonce checking via Redis SET NX
- Fail-closed in production (rate limiting, nonce checking refuse in-memory fallback)
- Admin role re-checked from DB on every JWT refresh
- Session revocation with database-backed blacklist
- Comprehensive security headers (CSP, HSTS, X-Frame-Options, etc.)
- Environment validation at startup with minimum key lengths
- Audit logging for security events
- Magic byte validation for file uploads

### Present but Could Be Strengthened
- CSRF protection (present but not universally applied)
- Rate limiting (present but not on all endpoints)
- Webhook URL validation (no SSRF protection)
- Encryption key rotation (no mechanism)
- CSP (allows unsafe-inline for scripts)

### Not Present / Missing
- Content-Length limits on API request bodies (beyond Next.js defaults)
- Request signing for server-to-server calls
- IP allowlisting for admin endpoints
- Webhook URL SSRF protection (private IP blocking)
- Encryption key rotation tooling
- Automated security testing in CI pipeline

---

## 8. Environment Variables (Security-Critical)

| Variable | Purpose | Minimum Length | Required in Prod |
|----------|---------|---------------|------------------|
| `DATABASE_URL` | PostgreSQL connection | - | Yes |
| `NEXTAUTH_SECRET` | JWT signing | 32 chars | Yes |
| `ENCRYPTION_SECRET` | AES-256-GCM key | 32 chars | Yes |
| `CRON_SECRET` | Cron job auth | 32 chars | Yes |
| `ADMIN_SECRET` | Admin API auth | 32 chars | Yes (prod) |
| `BACKEND_AUTHORITY_SECRET_KEY` | Solana program auth | Keypair JSON | Yes |
| `UPSTASH_REDIS_REST_URL` | Rate limiting/nonces | - | Yes (prod) |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limiting/nonces | - | Yes (prod) |
| `PRIVY_APP_SECRET` | Privy auth | - | If Privy enabled |
| `TWITTER_CLIENT_SECRET` | Twitter OAuth | - | If Twitter enabled |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage | - | If uploads enabled |

---

*End of Security Audit Context Report*
