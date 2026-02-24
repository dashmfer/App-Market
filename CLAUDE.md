# App Market - Claude Code Project Instructions

## Project Overview

App Market is a marketplace for buying and selling AI-generated apps, prototypes, and MVPs. Built on Solana with trustless escrow and instant settlement.

- **Stack**: Next.js 14 (App Router), TypeScript, Tailwind, Prisma + PostgreSQL, Solana/Anchor 0.29.0
- **Auth**: Privy (wallet + social) + NextAuth v4 + custom session revocation
- **Program ID**: `9udUgupraga6dj92zfLec8bAdXUZsU3FGNN3Lf8XGzog`
- **Smart Contract**: `programs/app-market/src/lib.rs` (3,875 lines, Rust/Anchor)
- **IDL**: `idl/app_market.json`

## Security Rules (MANDATORY)

These rules are non-negotiable. Every code change must follow them.

### Authentication & Sessions
- **ALWAYS** use `getAuthToken(request)` from `@/lib/auth` for API route authentication
- **NEVER** use `getServerSession(authOptions)` — it skips session revocation checks
- **NEVER** trust client-supplied identity claims (wallet, email, twitter) from JWT tokens
- **ALWAYS** verify identity server-side via `privyClient.getUser()`
- Access user ID via `session.id` (not `session.user.id`)

### CSRF Protection
- **ALL** mutating API endpoints (POST, PUT, PATCH, DELETE) MUST validate CSRF via `validateCsrfToken()`
- **ALL** client-side fetch calls MUST use `apiFetch()` from `@/lib/apiFetch` (never raw `fetch()`)
- Agent API key-authenticated requests are exempt from CSRF (they use HMAC, not cookies)

### Rate Limiting
- **ALL** mutating API endpoints MUST have rate limiting via `@upstash/ratelimit`
- Use appropriate windows: auth endpoints (strict), writes (moderate), reads (relaxed)

### Data Integrity
- **ALWAYS** use atomic database operations for state transitions (check + update in one query)
- **NEVER** read-then-write patterns (TOCTOU race conditions)
- Example: `prisma.listing.updateMany({ where: { id, status: 'AVAILABLE' }, data: { status: 'RESERVED' } })`
- Use `BigInt` or string-based math for token amounts — never floating-point arithmetic

### Input Validation
- Sanitize all user input (HTML strip, length limits, URL validation)
- Validate numeric bounds on all financial inputs (bids, amounts, fees)
- Cap maximum values to prevent overflow attacks

### Smart Contract (Rust/Anchor)
- All arithmetic MUST use checked operations (`checked_add`, `checked_mul`, `checked_div`)
- Validate all PDA seeds and account ownership
- Use `require!()` macros for all precondition checks
- Never allow reinitialization of accounts
- Verify signer authority for every privileged instruction

## Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build (runs prisma generate first)
npm run lint             # ESLint

# Database
npx prisma generate      # Generate client
npx prisma db push       # Push schema changes

# Tests
npm test                 # Unit tests (ts-mocha, 60s timeout)
npm run test:integration # Integration tests (120s timeout)

# Smart Contract
cd programs/app-market && anchor build    # Build contract
anchor deploy --provider.cluster devnet   # Deploy to devnet
```

## Key File Locations

| Area | Path |
|------|------|
| Smart contract | `programs/app-market/src/lib.rs` |
| Anchor IDL | `idl/app_market.json` |
| Solana utilities | `lib/solana.ts`, `lib/solana-contract.ts` |
| Auth system | `lib/auth.ts` |
| CSRF utilities | `lib/csrf.ts` |
| API fetch wrapper | `lib/apiFetch.ts` |
| Rate limiter | `lib/rate-limit.ts` |
| Wallet verification | `lib/wallet-verification.ts` |
| Token launch (Meteora) | `lib/meteora-dbc.ts` |
| Buyback logic | `lib/buyback.ts` |
| Database schema | `prisma/schema.prisma` |
| Agent SDK | `lib/sdk/` |
| Security reports | `security-reports/` |

## Architecture Notes

### Escrow Flow
1. Seller creates listing + escrow (PDAs created atomically)
2. Buyer places bid / buys now / makes offer (funds locked in escrow)
3. Auction ends, winner determined
4. Transfer period (7 days) — seller transfers off-chain assets
5. Backend verifies uploads, buyer confirms receipt
6. Escrow releases to seller (minus platform fee)
7. OR: Dispute opened, admin resolves

### Fee Structure
- Platform fee: 5% (500 bps) — 3% for $APP token payments
- Dispute fee: 2% (200 bps) — refunded to buyer if they win
- Token launch: 1% supply + 1 SOL flat fee
- Revenue split: 50% ops, 30% treasury, 20% buyback

### Auth Flow
- Privy handles wallet connection + social login
- Server verifies via `privyClient.verifyAuthToken()` then `privyClient.getUser()`
- Sessions stored as JWTs with server-side revocation tracking in `RevokedSession` table
- Agent API uses HMAC key pairs (separate from session auth)

## Security Audit Trail of Bits Plugins

When performing security reviews, use the following Trail of Bits methodologies:
1. **Audit context building** — architectural analysis before hunting
2. **Static analysis** — automated pattern matching for known vulnerability classes
3. **Entry point analysis** — map all state-changing entry points and their trust boundaries
4. **Differential review** — compare against known-good patterns
5. **Property-based testing** — define and verify invariants
6. **Variant analysis** — find variants of known bugs
7. **Sharp edges** — identify footguns and surprising behavior
8. **Building secure contracts** — Solana/Anchor-specific vulnerability checks

Previous security reports are in `security-reports/` for reference.
