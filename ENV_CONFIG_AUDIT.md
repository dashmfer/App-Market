# Environment Configuration Security Audit

**Date**: 2026-01-31
**Auditor**: Claude Opus 4.5
**Repository**: App-Market

---

## Executive Summary

This audit identified **CRITICAL** security vulnerabilities in environment configuration management. Most notably, real production secrets are present in `.env` and `.env.local` files that, while gitignored, are currently on disk with sensitive credentials. Additionally, several hardcoded fallback values and missing validation create security risks.

### Risk Rating: **CRITICAL**

---

## 1. Environment Files Analysis

### 1.1 Files Examined

| File | Status | Contents |
|------|--------|----------|
| `.env` | Present (gitignored) | **CONTAINS REAL SECRETS** |
| `.env.local` | Present (gitignored) | **CONTAINS REAL SECRETS** (duplicate of .env) |
| `.env.example` | Present | Template with placeholders |

### 1.2 Secrets in `.env` and `.env.local`

**CRITICAL FINDING**: Both `.env` and `.env.local` contain identical real production secrets:

```
Location: /Users/dasherxd/Desktop/App-Market/.env
Location: /Users/dasherxd/Desktop/App-Market/.env.local
```

| Secret | Type | Risk |
|--------|------|------|
| `DATABASE_URL` | PostgreSQL connection with password `ShaniahJoseph12!` | **CRITICAL** - Database credentials exposed |
| `GITHUB_SECRET` | OAuth client secret | **HIGH** - OAuth bypass possible |
| `NEXTAUTH_SECRET` | Session signing key | **CRITICAL** - Session forgery possible |
| `PRIVY_APP_SECRET` | Authentication provider secret | **CRITICAL** - Auth bypass possible |
| `BLOB_READ_WRITE_TOKEN` | Vercel blob storage token | **HIGH** - Storage access |
| `VERCEL_OIDC_TOKEN` | Vercel OIDC token (JWT) | **MEDIUM** - Temporary token |

### 1.3 Gitignore Configuration

**File**: `/Users/dasherxd/Desktop/App-Market/.gitignore`

```
.env
.env.local
.env*.local
```

**Status**: `.env` files are properly gitignored. However, **verify these files were never committed to git history**.

---

## 2. Secret Management Analysis

### 2.1 Server-Side Secret Access

**File**: `/Users/dasherxd/Desktop/App-Market/lib/auth.ts`

```typescript
// Lines 10-14: Partial validation, but has insecure fallback
const secret = process.env.NEXTAUTH_SECRET;

if (!secret && process.env.NODE_ENV === "production") {
  throw new Error("NEXTAUTH_SECRET must be set in production");
}

// Lines 23-26: INSECURE - Hardcoded fallback in development
return nextAuthGetToken({
  req,
  secret: secret || "development-secret-change-in-production",  // INSECURE
  cookieName,
});
```

**Finding**: The hardcoded fallback `"development-secret-change-in-production"` is used when `NEXTAUTH_SECRET` is missing. This could allow session forgery if accidentally deployed without the env var.

**File**: `/Users/dasherxd/Desktop/App-Market/lib/privy.ts`

```typescript
// Lines 4-7: No validation, empty string fallbacks
export const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID || "",
  process.env.PRIVY_APP_SECRET || ""
);
```

**Finding**: Empty string fallbacks mean the client is created even without credentials, potentially causing silent failures.

**File**: `/Users/dasherxd/Desktop/App-Market/app/api/admin/reset-listings/route.ts`

```typescript
// Line 8: CRITICAL - Hardcoded admin secret
const ADMIN_SECRET = process.env.ADMIN_SECRET || "devnet-reset-2024";
```

**Finding**: **CRITICAL** - A hardcoded fallback admin secret allows database wipes if `ADMIN_SECRET` is not set. An attacker can call:
```
DELETE /api/admin/reset-listings?secret=devnet-reset-2024&all=true
```

### 2.2 Client-Side Exposure (NEXT_PUBLIC_)

**Files exposing `NEXT_PUBLIC_` variables to client bundles**:

| Variable | File | Exposure Risk |
|----------|------|---------------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | `/components/providers/PrivyAuthProvider.tsx` | Low - Public app ID |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Multiple files | Low - Public RPC |
| `NEXT_PUBLIC_SOLANA_NETWORK` | Multiple files | Low - Network name |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env` files | **MEDIUM** - Anon key in client |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env` files | Low - Public URL |
| `NEXT_PUBLIC_MOONPAY_API_KEY` | `/components/wallet/AddFundsModal.tsx` | **MEDIUM** - API key exposed |
| `NEXT_PUBLIC_SITE_URL` | Twitter OAuth routes | Low - Site URL |
| `NEXT_PUBLIC_PROGRAM_ID` | `/lib/solana.ts` | Low - Public program |
| `NEXT_PUBLIC_TREASURY_WALLET` | `/lib/solana.ts`, `/lib/config.ts` | Low - Public wallet |
| `NEXT_PUBLIC_APP_TOKEN_MINT` | `/lib/solana.ts`, `/lib/config.ts` | Low - Public token |
| `NEXT_PUBLIC_USDC_MINT` | `/lib/solana.ts`, `/lib/config.ts` | Low - Public token |

**Finding**: The `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_MOONPAY_API_KEY` are exposed in client bundles. While Supabase anon keys are designed for client use (with RLS), ensure Row Level Security is properly configured.

---

## 3. Configuration Validation

### 3.1 Validation Coverage

| Secret | Has Validation | Fails Safe |
|--------|---------------|------------|
| `NEXTAUTH_SECRET` | Partial (production only) | No - Uses hardcoded fallback |
| `PRIVY_APP_SECRET` | Runtime check in callback | Yes - Returns error |
| `DATABASE_URL` | None | No - Crashes on connect |
| `STRIPE_SECRET_KEY` | None (uses `!` assertion) | No - Crashes |
| `STRIPE_WEBHOOK_SECRET` | None (uses `!` assertion) | No - Crashes |
| `TWITTER_CLIENT_ID` | Runtime check | Yes - Returns error |
| `TWITTER_CLIENT_SECRET` | Runtime check | Yes - Returns error |
| `ADMIN_SECRET` | None | **No - Hardcoded fallback** |
| `CRON_SECRET` | Optional (if set) | Partial - Bypassed if not set |
| `GITHUB_TOKEN` | Optional | Yes - Works without |

### 3.2 Missing Required Validations

**File**: `/Users/dasherxd/Desktop/App-Market/app/api/payments/create-intent/route.ts`

```typescript
// Line 8: Non-null assertion without validation
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
```

**File**: `/Users/dasherxd/Desktop/App-Market/app/api/webhooks/stripe/route.ts`

```typescript
// Lines 6, 10: Non-null assertions without validation
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
```

**Finding**: TypeScript non-null assertions (`!`) do not provide runtime validation. Missing secrets will cause runtime crashes.

### 3.3 Type Coercion Issues

**File**: `/Users/dasherxd/Desktop/App-Market/lib/config.ts`

```typescript
// Line 42: parseInt without NaN check
buybackPercentage: parseInt(process.env.BUYBACK_PERCENTAGE || "20"),
```

**Finding**: If `BUYBACK_PERCENTAGE` is set to a non-numeric value like `"abc"`, `parseInt` returns `NaN`, which could cause calculation errors.

---

## 4. Build vs Runtime Analysis

### 4.1 Build-Time Configuration

All `NEXT_PUBLIC_*` variables are **inlined at build time**:

| Variable | Inlined At Build |
|----------|-----------------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Yes |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Yes |
| `NEXT_PUBLIC_SOLANA_NETWORK` | Yes |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes |
| `NEXT_PUBLIC_SITE_URL` | Yes |
| `NEXT_PUBLIC_PROGRAM_ID` | Yes |
| `NEXT_PUBLIC_TREASURY_WALLET` | Yes |
| `NEXT_PUBLIC_APP_TOKEN_MINT` | Yes |
| `NEXT_PUBLIC_USDC_MINT` | Yes |
| `NEXT_PUBLIC_PLATFORM_FEE_BPS` | Yes |
| `NEXT_PUBLIC_DISPUTE_FEE_BPS` | Yes |
| `NEXT_PUBLIC_TOKEN_FEE_BPS` | Yes |
| `NEXT_PUBLIC_MOONPAY_API_KEY` | Yes |

**Implication**: Changing these values requires a rebuild. Values are visible in client JavaScript bundles.

### 4.2 Runtime Configuration

Server-side variables read at runtime:

| Variable | Server-Only |
|----------|-------------|
| `DATABASE_URL` | Yes |
| `NEXTAUTH_SECRET` | Yes |
| `PRIVY_APP_SECRET` | Yes |
| `STRIPE_SECRET_KEY` | Yes |
| `STRIPE_WEBHOOK_SECRET` | Yes |
| `TWITTER_CLIENT_ID` | Yes |
| `TWITTER_CLIENT_SECRET` | Yes |
| `GITHUB_SECRET` | Yes |
| `GITHUB_TOKEN` | Yes |
| `ADMIN_SECRET` | Yes |
| `CRON_SECRET` | Yes |
| `ENABLE_AUTO_BUYBACK` | Yes |
| `BUYBACK_PERCENTAGE` | Yes |
| `BUYBACK_WALLET` | Yes |
| `BLOB_READ_WRITE_TOKEN` | Yes |

### 4.3 Exposure in Bundled Code

Variables containing hardcoded fallbacks that appear in server bundles:

**File**: `/Users/dasherxd/Desktop/App-Market/lib/solana.ts`

```typescript
// Lines 5-22: Hardcoded fallback addresses
export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || "9udUgupraga6dj92zfLec8bAdXUZsU3FGNN3Lf8XGzog"
);

export const TREASURY_WALLET = new PublicKey(
  process.env.NEXT_PUBLIC_TREASURY_WALLET || "3BU9NRDpXqw7h8wed1aTxERk4cg5hajsbH4nFfVgYkJ6"
);
```

**Finding**: These are public blockchain addresses, so hardcoding is acceptable. However, the pattern of fallbacks could be risky if applied to sensitive values.

---

## 5. Production Hardening

### 5.1 Debug Mode

**File**: `/Users/dasherxd/Desktop/App-Market/lib/auth.ts`

```typescript
// Line 128: Debug enabled in development
debug: process.env.NODE_ENV === 'development',
```

**Status**: Correctly disabled in production.

### 5.2 Logging Analysis

**Finding**: 303 console log/error/warn statements found across 77 files.

**High-Risk Logging Locations**:

| File | Line | Risk |
|------|------|------|
| `/lib/privy.ts` | Line 15 | Logs token verification errors |
| `/app/api/auth/privy/callback/route.ts` | Multiple | Logs user data, wallet addresses, linked accounts |
| `/lib/auth.ts` | Line 170 | Logs database errors |
| `/app/api/webhooks/stripe/route.ts` | Line 22-23, 44 | Logs webhook errors |

**Example of verbose logging**:

```typescript
// /app/api/auth/privy/callback/route.ts - Lines 166, 344-345
console.log("[Privy Callback] Linked accounts:", JSON.stringify(privyUser.linkedAccounts, null, 2));
console.error("Error stack:", error?.stack);
console.error("Error message:", error?.message);
```

### 5.3 Error Verbosity

**File**: `/Users/dasherxd/Desktop/App-Market/app/api/auth/privy/callback/route.ts`

```typescript
// Lines 349-351: Stack traces returned to client
return NextResponse.json(
  { error: errorMessage, details: error?.stack?.split('\n')[0] },
  { status: 500 }
);
```

**Finding**: **HIGH RISK** - Error stack traces are returned to the client, leaking internal implementation details.

### 5.4 Debug Endpoint Exposed

**File**: `/Users/dasherxd/Desktop/App-Market/app/api/debug/db-test/route.ts`

```typescript
// No authentication required
export async function GET() {
  // Returns database connection status and user data
  return NextResponse.json({
    success: true,
    database: 'connected',
    userCount,
    firstUser: firstUser || 'No users found',
    timestamp: new Date().toISOString(),
  });
}
```

**Finding**: **CRITICAL** - Unauthenticated debug endpoint exposes database status and user information.

---

## 6. Security Recommendations

### CRITICAL Priority

1. **Rotate All Exposed Secrets Immediately**
   - Database password (`ShaniahJoseph12!`)
   - `GITHUB_SECRET`
   - `NEXTAUTH_SECRET`
   - `PRIVY_APP_SECRET`
   - `BLOB_READ_WRITE_TOKEN`

2. **Remove Hardcoded Admin Secret**
   ```typescript
   // BEFORE (insecure)
   const ADMIN_SECRET = process.env.ADMIN_SECRET || "devnet-reset-2024";

   // AFTER (secure)
   const ADMIN_SECRET = process.env.ADMIN_SECRET;
   if (!ADMIN_SECRET) {
     return NextResponse.json({ error: "Admin endpoint not configured" }, { status: 503 });
   }
   ```

3. **Remove or Protect Debug Endpoint**
   - Delete `/app/api/debug/db-test/route.ts` or
   - Add authentication and restrict to development environment

4. **Remove Stack Traces from Error Responses**
   ```typescript
   // BEFORE (exposes internals)
   { error: errorMessage, details: error?.stack?.split('\n')[0] }

   // AFTER (safe)
   { error: "Authentication failed. Please try again." }
   ```

### HIGH Priority

5. **Add Environment Variable Validation**
   Create a validation module at `/lib/env.ts`:
   ```typescript
   import { z } from 'zod';

   const envSchema = z.object({
     DATABASE_URL: z.string().url(),
     NEXTAUTH_SECRET: z.string().min(32),
     PRIVY_APP_SECRET: z.string().startsWith('privy_app_secret_'),
     STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
     STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
     // ... other required vars
   });

   export const env = envSchema.parse(process.env);
   ```

6. **Remove Hardcoded Auth Fallback**
   ```typescript
   // BEFORE (insecure)
   secret: secret || "development-secret-change-in-production",

   // AFTER (secure)
   secret: secret || (() => {
     if (process.env.NODE_ENV === 'production') {
       throw new Error('NEXTAUTH_SECRET required');
     }
     return crypto.randomBytes(32).toString('hex');
   })(),
   ```

7. **Secure Cron Endpoints**
   ```typescript
   // BEFORE (optional auth)
   if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {

   // AFTER (required auth)
   const cronSecret = process.env.CRON_SECRET;
   if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
   }
   ```

### MEDIUM Priority

8. **Reduce Logging Verbosity**
   - Remove or conditionally gate `console.log` statements with sensitive data
   - Use structured logging with redaction for production

9. **Add Type Validation for Numeric Configs**
   ```typescript
   const buybackPct = parseInt(process.env.BUYBACK_PERCENTAGE || "20", 10);
   if (isNaN(buybackPct) || buybackPct < 0 || buybackPct > 100) {
     throw new Error("Invalid BUYBACK_PERCENTAGE");
   }
   ```

10. **Verify Supabase RLS Configuration**
    - Ensure Row Level Security policies are in place for all tables
    - The anon key is exposed; database must enforce access control

---

## 7. Expected Environment Variables

### Required for Production

| Variable | Purpose | Validation |
|----------|---------|------------|
| `DATABASE_URL` | PostgreSQL connection | URL format, contains password |
| `NEXTAUTH_SECRET` | Session signing | Min 32 chars |
| `NEXTAUTH_URL` | Auth callback URL | Valid HTTPS URL |
| `PRIVY_APP_SECRET` | Privy server auth | Starts with `privy_app_secret_` |
| `STRIPE_SECRET_KEY` | Stripe payments | Starts with `sk_live_` (prod) |
| `STRIPE_WEBHOOK_SECRET` | Webhook verification | Starts with `whsec_` |
| `BLOB_READ_WRITE_TOKEN` | Vercel blob storage | Starts with `vercel_blob_rw_` |
| `ADMIN_SECRET` | Admin operations | Strong random string |
| `CRON_SECRET` | Cron job auth | Strong random string |

### Required for OAuth

| Variable | Purpose |
|----------|---------|
| `GITHUB_ID` | GitHub OAuth client ID |
| `GITHUB_SECRET` | GitHub OAuth secret |
| `TWITTER_CLIENT_ID` | Twitter OAuth client ID |
| `TWITTER_CLIENT_SECRET` | Twitter OAuth secret |

### Optional

| Variable | Purpose | Default |
|----------|---------|---------|
| `ENABLE_AUTO_BUYBACK` | Enable token buyback | `false` |
| `BUYBACK_PERCENTAGE` | Buyback percentage | `20` |
| `BUYBACK_WALLET` | Buyback destination | `null` |
| `GITHUB_TOKEN` | GitHub API rate limit | None |

### Public (NEXT_PUBLIC_)

| Variable | Purpose | Default |
|----------|---------|---------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy client ID | Required |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Solana RPC endpoint | `api.devnet.solana.com` |
| `NEXT_PUBLIC_SOLANA_NETWORK` | Solana network | `devnet` |
| `NEXT_PUBLIC_SITE_URL` | Site base URL | `http://localhost:3000` |
| `NEXT_PUBLIC_PROGRAM_ID` | Solana program | Hardcoded |
| `NEXT_PUBLIC_TREASURY_WALLET` | Treasury address | Hardcoded |

---

## 8. Verification Checklist

- [ ] All secrets in `.env` have been rotated
- [ ] `.env` files are not in git history (`git log --all -- '.env*'`)
- [ ] Hardcoded `ADMIN_SECRET` fallback removed
- [ ] Debug endpoint removed or protected
- [ ] Stack traces removed from error responses
- [ ] Environment validation module implemented
- [ ] `CRON_SECRET` made mandatory
- [ ] Logging sanitized for production
- [ ] Supabase RLS verified

---

## Appendix: Files Analyzed

| File | Purpose |
|------|---------|
| `/Users/dasherxd/Desktop/App-Market/.env` | Environment secrets |
| `/Users/dasherxd/Desktop/App-Market/.env.local` | Local environment secrets |
| `/Users/dasherxd/Desktop/App-Market/.env.example` | Template |
| `/Users/dasherxd/Desktop/App-Market/.gitignore` | Git exclusions |
| `/Users/dasherxd/Desktop/App-Market/lib/auth.ts` | NextAuth configuration |
| `/Users/dasherxd/Desktop/App-Market/lib/privy.ts` | Privy client |
| `/Users/dasherxd/Desktop/App-Market/lib/solana.ts` | Solana configuration |
| `/Users/dasherxd/Desktop/App-Market/lib/config.ts` | Platform configuration |
| `/Users/dasherxd/Desktop/App-Market/lib/db.ts` | Database client |
| `/Users/dasherxd/Desktop/App-Market/next.config.js` | Next.js configuration |
| `/Users/dasherxd/Desktop/App-Market/components/providers.tsx` | Client providers |
| `/Users/dasherxd/Desktop/App-Market/components/providers/PrivyAuthProvider.tsx` | Privy provider |
| `/Users/dasherxd/Desktop/App-Market/app/api/admin/reset-listings/route.ts` | Admin endpoint |
| `/Users/dasherxd/Desktop/App-Market/app/api/cron/buyer-info-deadlines/route.ts` | Cron endpoint |
| `/Users/dasherxd/Desktop/App-Market/app/api/auth/twitter/callback/route.ts` | Twitter OAuth |
| `/Users/dasherxd/Desktop/App-Market/app/api/auth/privy/callback/route.ts` | Privy callback |
| `/Users/dasherxd/Desktop/App-Market/app/api/payments/create-intent/route.ts` | Stripe payments |
| `/Users/dasherxd/Desktop/App-Market/app/api/webhooks/stripe/route.ts` | Stripe webhooks |
| `/Users/dasherxd/Desktop/App-Market/app/api/debug/db-test/route.ts` | Debug endpoint |

---

*Report generated by Claude Opus 4.5 security audit*
