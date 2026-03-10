# Insecure Defaults Detection Report

**Project:** App-Market (Next.js / TypeScript)
**Scan Date:** 2026-03-06
**Scanner:** Manual pattern-based analysis
**Scope:** All production-reachable source code (excluding node_modules, tests, documentation)

---

## Executive Summary

The codebase demonstrates strong security practices overall, with environment validation at startup, fail-closed patterns for critical secrets, and proper cryptographic implementations. However, **5 findings** were identified where insecure defaults could affect production behavior, primarily involving hardcoded fallback values for blockchain addresses/endpoints and a debug page accessible in production.

| Severity | Count |
|----------|-------|
| HIGH     | 1     |
| MEDIUM   | 3     |
| LOW      | 1     |

---

## Findings

### Finding 1: Client-Side Solana RPC Falls Back to Public Devnet

**Location:** `components/providers.tsx:19`
**Pattern Matched:** `process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl("devnet")`
**Severity:** HIGH

**Code:**
```typescript
const endpoint = useMemo(() => {
  return process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl("devnet");
}, []);
```

**Verification:** FAIL-OPEN. If `NEXT_PUBLIC_SOLANA_RPC_URL` is unset or misconfigured, the client-side wallet provider silently connects to the public Solana devnet. This is a `NEXT_PUBLIC_` variable, so it is baked into the client bundle at build time. If the build environment lacks this variable, all users get the devnet fallback even in a production deployment.

**Production Impact:** Users would connect their wallets to devnet instead of mainnet. Transactions would go to the wrong network. While the server-side `getConnection()` in `lib/solana.ts:47-57` correctly throws in production when this variable is missing, the client-side provider does not have the same safeguard.

**Exploitation Scenario:** If `NEXT_PUBLIC_SOLANA_RPC_URL` is accidentally unset during a Vercel build, the production frontend silently routes all wallet interactions to devnet. Users may initiate real purchase flows that appear to succeed but transact on a worthless test network, while the server-side (which throws on missing RPC URL in production) would reject these transactions, causing confusing UX failures and potential fund lock-ups if partial state was written.

**Mitigating Factors:** Server-side `lib/solana.ts` throws in production if the env var is missing; `lib/env-validation.ts` marks `NEXT_PUBLIC_SOLANA_RPC_URL` as required in production. However, the `assertEnvironment()` check runs server-side only and cannot protect the client bundle.

---

### Finding 2: Hardcoded Solana Program ID and Wallet Address Fallbacks

**Location:** `lib/solana.ts:8-24` and `lib/config.ts:164-191`
**Pattern Matched:** `process.env.NEXT_PUBLIC_PROGRAM_ID || "9udUgupraga6dj92zfLec8bAdXUZsU3FGNN3Lf8XGzog"` (and similar for treasury wallet, token mints)
**Severity:** MEDIUM

**Code (representative):**
```typescript
export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || "9udUgupraga6dj92zfLec8bAdXUZsU3FGNN3Lf8XGzog"
);
export const TREASURY_WALLET = new PublicKey(
  process.env.NEXT_PUBLIC_TREASURY_WALLET || "3BU9NRDpXqw7h8wed1aTxERk4cg5hajsbH4nFfVgYkJ6"
);
```

**Affected locations (6 fallbacks total):**
- `lib/solana.ts:9` - Program ID
- `lib/solana.ts:14` - Treasury wallet
- `lib/solana.ts:19` - APP token mint
- `lib/solana.ts:24` - USDC mint
- `lib/config.ts:164,170,182,185` - Duplicate fallbacks for the same addresses

**Verification:** FAIL-OPEN. These are `NEXT_PUBLIC_` variables embedded at build time. If unset, the application silently uses hardcoded addresses that may correspond to devnet/test deployments rather than the production program.

**Production Impact:** If environment variables are missing at build time, the application would interact with incorrect Solana programs. Specifically:
- Escrow payments could be sent to a test program address that is not the real escrow.
- Platform fees could be sent to a hardcoded treasury address that may not be the current production wallet.
- The hardcoded USDC mint (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`) is the real mainnet USDC address, so that specific fallback is likely safe. However, the program ID and treasury wallet fallbacks are higher risk.

**Exploitation Scenario:** If an attacker can influence the build environment (e.g., supply-chain compromise on CI), removing `NEXT_PUBLIC_PROGRAM_ID` would cause the app to interact with the hardcoded program, which could be a malicious contract deployed to the same address on a different cluster, or simply a non-functional address causing all transactions to fail.

**Mitigating Factors:** `lib/env-validation.ts` marks `NEXT_PUBLIC_PROGRAM_ID` and `NEXT_PUBLIC_TREASURY_WALLET` as required in production. The `assertEnvironment()` startup check would catch this server-side.

---

### Finding 3: Debug Session Page Available in Production

**Location:** `app/debug/session/page.tsx:1-213`
**Pattern Matched:** Debug/diagnostic endpoint with no environment gating
**Severity:** MEDIUM

**Verification:** FAIL-OPEN. The `/debug/session` page is a standard Next.js page with no middleware protection, no authentication requirement, and no `NODE_ENV` check. It renders in all environments including production.

**Production Impact:** The debug page exposes:
- Current user's full session data (user ID, wallet address, email, username, admin status)
- Cookie names and values (visible in client-side JavaScript)
- API session endpoint response

While this only reveals the current user's own session data (not other users'), it is an information disclosure risk. The page is not listed in the protected routes in `middleware.ts`.

**Exploitation Scenario:** An attacker who has achieved XSS or is conducting a social engineering attack could direct a victim to `/debug/session` to observe session token details, cookie names, and authentication state, aiding further attacks. The page also serves as reconnaissance for understanding the application's auth architecture.

**Mitigating Factors:** The page only shows the visiting user's own session data. Session tokens are httpOnly and not directly visible. However, the page still reveals auth architecture details.

---

### Finding 4: Environment Validation Does Not Halt Non-Production Builds

**Location:** `lib/env-validation.ts:136-141`
**Pattern Matched:** Conditional fail behavior based on NODE_ENV
**Severity:** MEDIUM

**Code:**
```typescript
if (process.env.NODE_ENV === "production") {
  throw new Error(
    `Environment validation failed with ${result.errors.length} error(s). Fix before deploying to production.`
  );
}
```

**Verification:** FAIL-OPEN in non-production. When `NODE_ENV !== "production"`, environment validation errors are logged but the application continues to run. This means staging or preview deployments on Vercel (which may use `NODE_ENV=development` or `NODE_ENV=preview`) can run without critical secrets like `ENCRYPTION_SECRET`, `CRON_SECRET`, or `ADMIN_SECRET`.

**Production Impact:** If a staging/preview deployment is accidentally promoted to production, or if `NODE_ENV` is misconfigured, the application runs without validated environment variables. Critical security infrastructure (encryption, cron auth, admin auth) may fall back to insecure states.

**Exploitation Scenario:** A Vercel preview deployment running with `NODE_ENV=development` would skip the environment validation throw. If this preview deployment is misconfigured to point at the production database (e.g., `DATABASE_URL` is set to prod), it runs without validated secrets against real user data.

**Mitigating Factors:** Individual modules (like `lib/encryption.ts`, `lib/auth.ts`) have their own fail-secure checks that throw when their specific secrets are missing. This provides defense-in-depth.

---

### Finding 5: CSP Allows unsafe-inline for Scripts

**Location:** `next.config.js:77`
**Pattern Matched:** `'unsafe-inline'` in script-src CSP directive
**Severity:** LOW

**Code:**
```javascript
`script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== 'production' ? " 'unsafe-eval'" : ""}`,
```

**Verification:** FAIL-OPEN. The `'unsafe-inline'` directive is included in the production Content-Security-Policy for script-src. The code comment acknowledges this: "NOTE: unsafe-inline is still needed until Next.js nonce support is adopted."

**Production Impact:** `'unsafe-inline'` in script-src weakens the CSP, allowing inline scripts to execute. This significantly reduces the protection CSP offers against XSS attacks. An attacker who achieves HTML injection can include inline `<script>` tags that the CSP will not block.

**Exploitation Scenario:** If an XSS vulnerability exists elsewhere in the application (e.g., in user-generated content rendering), the `'unsafe-inline'` CSP directive means the browser will not block the injected script. A strict CSP with nonces would prevent this class of attack.

**Mitigating Factors:** The comment indicates this is a known limitation of the Next.js framework. `'unsafe-eval'` is correctly restricted to development only. Other security headers (X-Frame-Options, X-Content-Type-Options, HSTS) are properly configured.

---

## Patterns Searched With No Findings (Secure)

The following patterns were searched and returned no actionable findings, indicating good security practices:

| Pattern | Result |
|---------|--------|
| `process.env.* ?? 'fallback'` (nullish coalescing fallbacks) | No matches |
| `CORS * (wildcard Access-Control-Allow-Origin)` | No matches; CORS headers are not set at all (same-origin only) |
| Weak crypto (MD5, SHA1, DES, RC4, ECB in security contexts) | No matches in application code. AES-256-GCM used throughout |
| `DEBUG = true` hardcoded | No matches; `debug` is properly gated to `NODE_ENV === 'development'` |
| `AUTH = false` / auth bypass flags | No matches |
| Hardcoded passwords/API keys/secrets | No matches in production code (only in SDK doc example comments) |
| Empty catch blocks around security operations | No matches; all `catch` blocks either re-throw, return false (fail-closed), or log errors |
| `skipAuth` / `bypassAuth` / `disableAuth` flags | No matches |

## Notable Secure Patterns Observed

1. **NEXTAUTH_SECRET**: Throws at module load if missing (`lib/auth.ts:41-43`). Fail-secure.
2. **ENCRYPTION_SECRET**: Throws if missing or too short (`lib/encryption.ts:24-39`). Fail-secure.
3. **CRON_SECRET**: Returns 500 if missing (`middleware.ts:92-98`). Fail-secure.
4. **Rate limiting**: Throws in production if Redis is unavailable (`lib/rate-limit.ts:127-130`). Fail-secure.
5. **Nonce replay protection**: Rejects requests in production if Redis is unavailable (`lib/validation.ts:43-45`, `lib/agent-auth.ts:230-232`). Fail-secure.
6. **Privy auth**: Throws if Privy client is not configured (`lib/auth.ts:226-228`). Fail-secure.
7. **Timing-safe comparisons**: Used consistently for secret/token comparisons with buffer padding to prevent length leaks.
8. **Cookie security**: `httpOnly`, `sameSite`, and `secure` (in production) flags properly set.

---

## Recommendations

1. **[HIGH] Add client-side RPC URL validation**: In `components/providers.tsx`, add a build-time or runtime check that prevents falling back to devnet. Consider throwing an error or showing a user-visible warning when `NEXT_PUBLIC_SOLANA_RPC_URL` is unset.

2. **[MEDIUM] Remove or protect the debug page**: Either delete `app/debug/session/page.tsx` entirely, gate it behind `NODE_ENV === 'development'`, or add it to the `PROTECTED_ROUTES` list in `middleware.ts` requiring authentication.

3. **[MEDIUM] Make Solana address fallbacks fail-closed**: In `lib/solana.ts`, consider throwing when `NEXT_PUBLIC_PROGRAM_ID` or `NEXT_PUBLIC_TREASURY_WALLET` are missing rather than falling back to hardcoded addresses. The env-validation already requires them in production, so the fallback adds risk without benefit.

4. **[MEDIUM] Consider making env-validation stricter in staging**: The `assertEnvironment()` function could also throw for non-production environments when critical secrets (ENCRYPTION_SECRET, NEXTAUTH_SECRET) are missing, since these protect data integrity regardless of environment.

5. **[LOW] Plan CSP nonce adoption**: Track the Next.js nonce support feature and plan to replace `'unsafe-inline'` with nonce-based CSP when available.
