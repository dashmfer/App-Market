# Insecure Defaults Security Audit Report

**Audit Type:** Insecure Defaults (Trail of Bits methodology)
**Target:** App-Market (Next.js + Prisma + NextAuth + Solana)
**Date:** 2026-02-27
**Auditor:** Automated security scan with manual verification

---

## Executive Summary

This audit identified **8 findings** across the App-Market codebase. The codebase demonstrates generally strong security practices -- critical secrets (NEXTAUTH_SECRET, ENCRYPTION_SECRET) throw hard errors when missing, CSRF uses HMAC with timing-safe comparison, and production env-validation halts startup on missing config. However, several fallback defaults create risk, particularly around Solana RPC endpoints and wallet addresses where hardcoded devnet/mainnet fallbacks could cause silent financial misdirection. The most impactful findings relate to inconsistent RPC fallback behavior and the Content Security Policy permitting inline scripts.

**Severity Distribution:**
- CRITICAL: 0
- HIGH: 2
- MEDIUM: 4
- LOW: 2

---

## Finding 1: Inconsistent Solana RPC Fallback -- Devnet Used in Production API Routes

**Severity:** HIGH

**Location:**
- `app/api/purchases/route.ts:67`
- `app/dashboard/page.tsx:68`

**Pattern found:**
```typescript
const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
```

**Verification:**
The canonical `getConnection()` in `lib/solana.ts:47-57` correctly throws in production when `NEXT_PUBLIC_SOLANA_RPC_URL` is unset:
```typescript
if (process.env.NODE_ENV === "production") {
  throw new Error("NEXT_PUBLIC_SOLANA_RPC_URL must be set in production");
}
```
However, two call sites bypass this safe function and construct their own `Connection` objects with a hardcoded devnet fallback. These are in:
1. **`app/api/purchases/route.ts:67`** -- a server-side API route that verifies on-chain purchase transactions.
2. **`app/dashboard/page.tsx:68`** -- a client component fetching wallet balances.

If `NEXT_PUBLIC_SOLANA_RPC_URL` is ever unset (e.g., missing from Vercel env config, deployment misconfiguration), these routes silently connect to **Solana devnet** instead of mainnet. The purchases route would then fail to find real mainnet transactions, potentially causing payment verification failures or allowing devnet transactions to be submitted as proof of payment.

**Production Impact:** HIGH. The purchases API route handles financial transaction verification. Falling back to devnet means real mainnet payments cannot be verified, or a malicious user could submit devnet transactions that appear valid when checked against devnet. The env-validation at startup (`lib/env-validation.ts:40`) only requires `NEXT_PUBLIC_SOLANA_RPC_URL` in production, but these inline fallbacks bypass that check entirely.

**Exploitation Scenario:** If the env var is dropped during a redeployment, the purchase verification route falls back to devnet. An attacker could craft devnet transactions that pass verification, effectively getting items for free since devnet SOL has no value.

**Recommendation:** Remove the inline devnet fallbacks and use `getConnection()` from `lib/solana.ts` which has the proper production guard. Alternatively, throw an error if the env var is missing rather than falling back.

---

## Finding 2: Hardcoded Mainnet RPC Fallback in Pool Watcher (No Production Guard)

**Severity:** HIGH

**Location:**
- `lib/pool-watcher.ts:3`

**Pattern found:**
```typescript
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
```

**Verification:**
Unlike the devnet fallbacks, this falls back to Solana's **public mainnet RPC**. The public mainnet RPC has aggressive rate limits (Solana Foundation rate limits public endpoints). The pool-watcher uses this URL for Helius webhook management (`addToHeliusWebhook`, `removeFromHeliusWebhook`) but the `RPC_URL` constant is defined at module scope, ready for use in any future direct RPC calls.

This differs from `lib/solana.ts:getConnection()` which correctly refuses to proceed without the env var in production. The pool-watcher silently degrades to a rate-limited public endpoint that may fail under load.

**Production Impact:** HIGH for availability. The public Solana mainnet RPC aggressively rate-limits and may return errors during high-traffic periods. Pool graduation monitoring (a financial operation that triggers DAMM v2 migration) could silently fail, causing tokens to miss their graduation window.

**Exploitation Scenario:** Not directly exploitable for financial gain, but an attacker who knows the system is on the public RPC could time their actions to coincide with rate-limiting, causing pool graduations to be missed.

**Recommendation:** Add a production guard that throws if `NEXT_PUBLIC_SOLANA_RPC_URL` is unset, consistent with `lib/solana.ts`.

---

## Finding 3: Hardcoded Solana Program ID and Treasury Wallet Fallbacks

**Severity:** MEDIUM

**Location:**
- `lib/solana.ts:8-9` (PROGRAM_ID)
- `lib/solana.ts:13-14` (TREASURY_WALLET)
- `lib/solana.ts:18-19` (PLATFORM_TOKEN_MINT)
- `lib/solana.ts:23-24` (USDC_MINT)
- `lib/config.ts:164, 170, 182, 185` (duplicated)

**Pattern found:**
```typescript
export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || "9udUgupraga6dj92zfLec8bAdXUZsU3FGNN3Lf8XGzog"
);
export const TREASURY_WALLET = new PublicKey(
  process.env.NEXT_PUBLIC_TREASURY_WALLET || "3BU9NRDpXqw7h8wed1aTxERk4cg5hajsbH4nFfVgYkJ6"
);
```

**Verification:**
The env-validation system (`lib/env-validation.ts:45-52`) requires `NEXT_PUBLIC_PROGRAM_ID` and `NEXT_PUBLIC_TREASURY_WALLET` in production (throws at startup). This is a good defense. However:
1. The hardcoded values still exist in the source code, meaning anyone can see the production wallet addresses.
2. The env-validation only runs in the Node.js runtime (`instrumentation.ts:3`), not in Edge Runtime. If any of these values are used in edge middleware or client-side code, the fallback could activate.
3. `lib/config.ts` duplicates these same fallbacks, creating a maintenance risk where one file could be updated without the other.

**Production Impact:** MEDIUM. The env-validation provides a strong defense-in-depth, but the pattern of hardcoding addresses in source creates an information leak (wallet addresses visible in the repository) and a risk if env-validation is bypassed. The USDC mint (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`) is the canonical mainnet USDC address, which is public knowledge, but the treasury wallet address being in source code reveals platform infrastructure.

**Exploitation Scenario:** If env-validation is temporarily disabled or bypassed, the fallback program ID could point to a devnet or outdated program, causing funds to be sent to incorrect escrow accounts.

**Recommendation:** For `PROGRAM_ID` and `TREASURY_WALLET`, throw at the point of use if the env var is missing rather than using a fallback. The USDC mint fallback is acceptable since it is a well-known canonical address.

---

## Finding 4: Content Security Policy Allows `unsafe-inline` for Scripts

**Severity:** MEDIUM

**Location:**
- `next.config.js:77`

**Pattern found:**
```javascript
"script-src 'self' 'unsafe-inline'",
"style-src 'self' 'unsafe-inline'",
```

**Verification:**
The CSP `script-src` directive includes `'unsafe-inline'`, which allows execution of inline `<script>` tags and JavaScript event handlers. This significantly reduces the protection CSP provides against Cross-Site Scripting (XSS) attacks. The comment notes this is "needed for Next.js" -- while Next.js does inject some inline scripts, the recommended approach is to use a nonce-based CSP.

The `style-src 'unsafe-inline'` is less severe since inline styles are lower risk than inline scripts, and are commonly needed for CSS-in-JS frameworks.

**Production Impact:** MEDIUM. If an XSS vector is found elsewhere in the application (e.g., via unsanitized user input in listing descriptions, chat messages, or review text), `unsafe-inline` means the attacker's injected script will execute without CSP blocking it. This is a defense-in-depth weakness.

**Exploitation Scenario:** An attacker finds a stored XSS vulnerability in listing descriptions. With `unsafe-inline` in the CSP, their injected `<script>` tag executes for all visitors, enabling wallet phishing, session theft, or transaction manipulation.

**Recommendation:** Migrate to nonce-based CSP: `script-src 'self' 'nonce-<random>'`. Next.js supports this via the `nonce` prop on `<Script>` components and the `headers()` config. This would maintain Next.js functionality while blocking injected inline scripts.

---

## Finding 5: SITE_URL Fallback to localhost in OAuth Redirect URIs

**Severity:** MEDIUM

**Location:**
- `app/api/auth/twitter/callback/route.ts:10-11`
- `app/api/auth/twitter/connect/route.ts:11`

**Pattern found:**
```typescript
const TWITTER_REDIRECT_URI = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/auth/twitter/callback`;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
```

**Verification:**
If `NEXT_PUBLIC_SITE_URL` is not set in the deployment environment, the Twitter OAuth redirect URI falls back to `http://localhost:3000`. This has two impacts:
1. **HTTP, not HTTPS:** The fallback uses `http://`, not `https://`. In production, OAuth tokens would be sent over an unencrypted connection if this fallback were activated.
2. **localhost redirect:** Twitter's OAuth would redirect the user to `localhost:3000`, which would fail (Twitter would likely reject this if the registered redirect URI is different), but if an attacker controls localhost:3000 on the user's machine, they could intercept the OAuth code.

The `SITE_URL` variable is also used to construct redirect URLs after the callback completes (`route.ts:31, 37, 45, 69, 95, etc.`), meaning error handling redirects would also point to localhost.

`NEXT_PUBLIC_SITE_URL` is **not** validated by `lib/env-validation.ts` as a required variable.

**Production Impact:** MEDIUM. The Twitter OAuth flow would break entirely if the env var is missing (Twitter rejects mismatched redirect URIs), so this is more of a fail-closed scenario. However, the HTTP protocol in the fallback is concerning and the variable should be validated at startup.

**Exploitation Scenario:** In a staging or preview deployment where `NEXT_PUBLIC_SITE_URL` is accidentally omitted, OAuth tokens could be sent over HTTP if the Twitter app's registered redirect URIs are permissive.

**Recommendation:** Add `NEXT_PUBLIC_SITE_URL` to the required env vars in `lib/env-validation.ts`. At minimum, ensure the fallback uses `https://` if any fallback is retained.

---

## Finding 6: ADMIN_SECRET Not Required by Environment Validation

**Severity:** MEDIUM

**Location:**
- `lib/env-validation.ts:89-93`
- `app/api/admin/reset-listings/route.ts:9, 17`

**Pattern found:**
```typescript
// env-validation.ts - only validates length IF set, but doesn't require it
const adminSecret = process.env.ADMIN_SECRET;
if (adminSecret && adminSecret.length < 32) {
  errors.push("WEAK: ADMIN_SECRET must be at least 32 characters");
}
```

```typescript
// reset-listings/route.ts - returns false (access denied) if ADMIN_SECRET is not set
if (!authHeader || !ADMIN_SECRET) {
  return false;
}
```

**Verification:**
The `ADMIN_SECRET` is used to protect the `DELETE /api/admin/reset-listings` endpoint which can **delete ALL listings and related data** (bids, offers, transactions, reviews, disputes). The env-validation only checks its length *if it is set*, but does not require it to be set.

The admin route handler (`reset-listings/route.ts:17`) correctly returns `false` (denying access) when `ADMIN_SECRET` is unset, which is fail-secure. Additionally, the route requires both the admin secret AND an authenticated admin session. This provides good defense-in-depth.

However, the fact that this critical secret is not flagged as required means a deployment could go live without it configured, and the only indication would be that admin operations silently fail. No startup error would alert operators.

**Production Impact:** MEDIUM. The route is fail-secure (access denied when unconfigured), but the silent failure could mask operational issues. An admin might not realize their management tools are non-functional until they need them during an incident.

**Recommendation:** Add `ADMIN_SECRET` to the required env vars in `lib/env-validation.ts` with `minLength: 32`.

---

## Finding 7: Health Endpoint Exposes Configuration State

**Severity:** LOW

**Location:**
- `app/api/health/route.ts:85-93`

**Pattern found:**
```typescript
checks.config = {
  status: [
    "NEXTAUTH_SECRET",
    "ENCRYPTION_SECRET",
    "CRON_SECRET",
    "DATABASE_URL",
  ].every(v => !!process.env[v]) ? "ok" : "missing_vars",
};
```

**Verification:**
The health endpoint is public (no authentication required) and reveals whether specific environment variables are configured. While it does not expose the values themselves, it exposes the *names* of the secrets the application uses and whether they are set. An attacker can probe this endpoint to determine:
1. Whether the application uses encryption (ENCRYPTION_SECRET)
2. Whether cron jobs are protected (CRON_SECRET)
3. Whether the database is connected (DATABASE_URL)
4. Whether Redis is configured (`checks.redis` section)

The endpoint also returns latency metrics for each service, which can reveal infrastructure characteristics.

**Production Impact:** LOW. No secret values are leaked, but the information aids reconnaissance. An attacker could use the Redis `not_configured` status to determine that rate limiting may be ineffective (if Upstash is not set up).

**Exploitation Scenario:** An attacker probes `/api/health` and discovers Redis is `not_configured`, indicating rate limiting may be running in degraded mode. They then attempt brute-force or denial-of-service attacks knowing rate limiting is weakened.

**Recommendation:** Consider requiring authentication for the full health check details, returning only a simple `{"status": "healthy"}` or `{"status": "degraded"}` to unauthenticated callers. Move detailed checks behind an admin-authenticated endpoint.

---

## Finding 8: .env.example Contains Insecure Placeholder Secrets

**Severity:** LOW

**Location:**
- `.env.example:9`
- `.env.example:68`
- `.env.example:72`

**Pattern found:**
```
NEXTAUTH_SECRET="your-super-secret-key-change-in-production"
ADMIN_SECRET="your-admin-secret-change-in-production"
CRON_SECRET="your-cron-secret-change-in-production"
```

**Verification:**
The `.env.example` file contains human-readable placeholder strings for secrets. These are not insecure by themselves since `.env.example` is a template, but they create a risk:
1. A developer might copy `.env.example` to `.env` and deploy without changing the secrets.
2. The `NEXTAUTH_SECRET` placeholder is only 45 characters -- it would pass the `minLength: 32` check in env-validation, so the application would start without warning.
3. The `ADMIN_SECRET` placeholder is 40 characters, also passing the length check.

The env-validation system (`lib/env-validation.ts`) checks minimum length but does not check for known weak values or dictionary words.

**Production Impact:** LOW. The startup validation would catch truly missing secrets, and the placeholder values would technically "work" but are easily guessable. This is mitigated by the fact that production deployments on Vercel typically configure secrets independently.

**Exploitation Scenario:** A developer deploys to staging/production by copying `.env.example` directly. The placeholder `"your-super-secret-key-change-in-production"` becomes the actual NEXTAUTH_SECRET. An attacker who reads the public GitHub repository forges JWT tokens signed with this known secret.

**Recommendation:** Add entropy validation: reject secrets that contain dictionary words like "your", "secret", "change", "production". Alternatively, make the placeholder values obviously invalid (e.g., `NEXTAUTH_SECRET=CHANGE_ME_GENERATE_WITH_openssl_rand_base64_32`) and add a specific check that rejects values containing "CHANGE_ME".

---

## Items Verified as Secure (No Finding)

The following patterns were checked and found to be properly implemented:

| Pattern | Location | Assessment |
|---------|----------|------------|
| NEXTAUTH_SECRET enforcement | `lib/auth.ts:41-44` | Throws hard error if missing. No fallback. |
| ENCRYPTION_SECRET enforcement | `lib/encryption.ts:24-39` | Throws hard error if missing. Validates minimum length. No fallback to NEXTAUTH_SECRET. |
| CSRF secret enforcement | `lib/csrf.ts:19-24` | Falls back to NEXTAUTH_SECRET (acceptable), then throws if neither is set. |
| Rate limiting in production | `lib/rate-limit.ts:127-129` | Throws in production if Upstash not configured. Does not silently fall back. |
| Cron route authentication | `middleware.ts:97-132` | Returns 500 if CRON_SECRET not configured. Uses timing-safe comparison. |
| Session cookie security | `lib/auth.ts:418-428` | `httpOnly: true`, `secure` in production, `sameSite: "lax"`. |
| CORS configuration | `next.config.js`, API routes | No `Access-Control-Allow-Origin: *` found. API spec is same-origin only. |
| Weak crypto algorithms | Codebase-wide | No MD5, SHA1, DES, RC4, or ECB used in security contexts. SHA-256 HMAC used for CSRF. AES-256-GCM used for encryption. SHA-256 used for PKCE code challenge. |
| DEBUG mode defaults | Codebase-wide | `debug: process.env.NODE_ENV === 'development'` in auth config -- correctly scoped. No `DEBUG=true` defaults. |
| Admin route protection | `middleware.ts:146-168` | Requires both JWT token and `isAdmin` flag from database. |
| Production env validation | `instrumentation.ts:1-7` | `assertEnvironment()` runs at startup and throws in production on missing critical vars. |

---

## Recommendations Summary

| Priority | Action | Affected Files |
|----------|--------|----------------|
| HIGH | Remove inline devnet RPC fallbacks; use `getConnection()` from `lib/solana.ts` | `app/api/purchases/route.ts`, `app/dashboard/page.tsx` |
| HIGH | Add production guard to `lib/pool-watcher.ts` RPC URL | `lib/pool-watcher.ts` |
| MEDIUM | Migrate CSP from `unsafe-inline` to nonce-based | `next.config.js` |
| MEDIUM | Add `NEXT_PUBLIC_SITE_URL` to required env vars | `lib/env-validation.ts` |
| MEDIUM | Make `ADMIN_SECRET` required in env validation | `lib/env-validation.ts` |
| MEDIUM | Remove hardcoded fallbacks for PROGRAM_ID and TREASURY_WALLET | `lib/solana.ts`, `lib/config.ts` |
| LOW | Restrict health endpoint details to authenticated users | `app/api/health/route.ts` |
| LOW | Add entropy/dictionary check for placeholder secrets | `lib/env-validation.ts` |
