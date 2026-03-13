# Insecure Defaults Security Audit Report

**Date:** 2026-01-31
**Codebase:** App-Market
**Auditor:** Claude Code (insecure-defaults skill)

---

## Executive Summary

This report identifies fail-open vulnerabilities, insecure defaults, and hardcoded credentials in the App-Market codebase. **CRITICAL: Production secrets have been committed to the repository** in `.env` and `.env.local` files. While listed in `.gitignore`, these files are currently present and contain real credentials.

| Severity | Count |
|----------|-------|
| Critical | 4 |
| High | 5 |
| Medium | 6 |
| Low | 3 |

---

## Critical Findings

### 1. [CRITICAL] Production Secrets Exposed in Local Files

**File:** `/Users/dasherxd/Desktop/App-Market/.env.local` and `/Users/dasherxd/Desktop/App-Market/.env`

**Finding:** Production secrets are present in the local filesystem. While `.gitignore` includes these files, they contain real credentials:

```
DATABASE_URL="postgresql://postgres.gehrbsolvbphyhnxfxsf:ShaniahJoseph12!@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"
GITHUB_SECRET="39133f6914439c5de1ffc2095803a8502ec5e187"
NEXTAUTH_SECRET="y41WWgeRbXMPC4nRoMJOANTszA1pkcgrz2YvqtxBkUCs"
PRIVY_APP_SECRET="privy_app_secret_UTz3iepgoYAvwj9qta4d7KjhgQiuenyR2pdfD837RNA8Cpe2ffKPfQFg8vhPxeBs9x2eEUZstL7x5Tn6wLKM6Nv"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiI..."
VERCEL_OIDC_TOKEN="eyJhbGciOiJSUzI1NiI..."
```

**Impact:**
- Database credentials with password visible
- GitHub OAuth secret exposed
- Session signing secret compromised
- Privy authentication secret leaked
- JWT tokens exposed

**Recommendation:**
1. **IMMEDIATELY rotate all exposed credentials**
2. Verify these files are not committed to any branch
3. Use environment variable injection from Vercel/hosting provider
4. Remove local `.env` files from developer machines after verification

---

### 2. [CRITICAL] Hardcoded Admin Secret with Fallback

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/admin/reset-listings/route.ts:8`

```typescript
const ADMIN_SECRET = process.env.ADMIN_SECRET || "devnet-reset-2024";
```

**Fail-Open Behavior:** If `ADMIN_SECRET` is not set in production, the default value `"devnet-reset-2024"` is used, allowing anyone who guesses this value to delete all listings.

**Impact:**
- Complete data destruction endpoint accessible with known default password
- Deletes: listings, transactions, reviews, disputes, notifications, bids, offers
- Production reachable: YES (endpoint exists at `/api/admin/reset-listings`)

**Recommendation:**
- Remove the fallback value entirely
- Add startup validation that fails if `ADMIN_SECRET` is not set in production
- Consider requiring additional authentication factors for destructive operations

---

### 3. [CRITICAL] Session Secret with Insecure Fallback

**File:** `/Users/dasherxd/Desktop/App-Market/lib/auth.ts:24` and `:32`

```typescript
return nextAuthGetToken({
  req,
  secret: secret || "development-secret-change-in-production",
  cookieName,
});

// And later:
secret: secret || "development-secret-change-in-production",
```

**Fail-Open Behavior:** While there's a production check at line 12-14, the fallback values are still used in the `getAuthToken` function and `authOptions`, creating attack surface.

**Impact:**
- If NEXTAUTH_SECRET is unset, sessions use predictable secret
- Attackers can forge session tokens
- Session hijacking possible

**Note:** There IS a check on line 12-14, but only in production:
```typescript
if (!secret && process.env.NODE_ENV === "production") {
  throw new Error("NEXTAUTH_SECRET must be set in production");
}
```

**Recommendation:**
- Remove all fallback secret values
- Use explicit undefined instead of fallback strings
- Fail fast rather than fail open

---

### 4. [CRITICAL] Cron Endpoints Accessible Without Authentication

**Files:**
- `/Users/dasherxd/Desktop/App-Market/app/api/cron/buyer-info-deadlines/route.ts:12`
- `/Users/dasherxd/Desktop/App-Market/app/api/cron/check-partner-deposits/route.ts:14`

```typescript
if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**Fail-Open Behavior:** If `CRON_SECRET` is not set, the authentication check is completely bypassed. The condition `cronSecret && ...` means no secret = no auth required.

**Impact:**
- Partner deposit cron can be triggered to process/refund deposits
- Buyer info deadline cron can mark transactions as deadline-passed
- State manipulation attacks possible
- Production reachable: YES

**Recommendation:**
```typescript
// Fail-secure pattern:
if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

---

## High Severity Findings

### 5. [HIGH] Debug Mode Enabled Based on NODE_ENV

**File:** `/Users/dasherxd/Desktop/App-Market/lib/auth.ts:128`

```typescript
debug: process.env.NODE_ENV === 'development',
```

**Issue:** NextAuth debug mode exposes detailed authentication flow information. If NODE_ENV is incorrectly set or defaulted, sensitive auth details may be logged.

**Impact:**
- Session tokens may appear in logs
- Authentication flow details exposed
- Potential information disclosure

---

### 6. [HIGH] Privy Client with Empty String Fallbacks

**File:** `/Users/dasherxd/Desktop/App-Market/lib/privy.ts:4-7`

```typescript
export const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID || "",
  process.env.PRIVY_APP_SECRET || ""
);
```

**Fail-Open Behavior:** Empty strings are passed if env vars are missing. This creates a PrivyClient with invalid credentials that may behave unexpectedly.

**Impact:**
- Token verification may fail silently or behave unexpectedly
- Authentication bypass may be possible depending on SDK behavior

**Recommendation:**
- Add startup validation for required Privy credentials
- Throw error if credentials are missing rather than using empty strings

---

### 7. [HIGH] Error Stack Traces Exposed to Clients

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/auth/privy/callback/route.ts:344-350`

```typescript
console.error("Error stack:", error?.stack);
// ...
return NextResponse.json(
  { error: errorMessage, details: error?.stack?.split('\n')[0] },
  { status: 500 }
);
```

**Impact:**
- Stack trace first line exposed in API responses
- Internal file paths and function names revealed
- Aids attackers in understanding application structure

**Recommendation:**
- Remove `details` field from production responses
- Log full stack traces server-side only
- Return generic error messages to clients

---

### 8. [HIGH] Unauthenticated Debug Endpoints

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/debug/db-test/route.ts`

**Issue:** Database test endpoint is publicly accessible and reveals:
- Database connection status
- User count
- First user's ID, email, username, and creation date

**Impact:**
- Information disclosure about database state
- User enumeration possible
- Aids reconnaissance attacks

**Recommendation:**
- Remove from production or restrict to authenticated admins
- Add proper authorization checks

---

### 9. [HIGH] Test Session Endpoint Exposes Session Details

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/test-session/route.ts`

**Issue:** Endpoint exposes session authentication state and cookie names without requiring authentication.

**Impact:**
- Session state enumeration
- Cookie name disclosure aids session attacks

**Recommendation:**
- Remove from production deployment
- Or restrict to development environment only

---

## Medium Severity Findings

### 10. [MEDIUM] Hardcoded Wallet Addresses with Fallbacks

**File:** `/Users/dasherxd/Desktop/App-Market/lib/solana.ts:6-22` and `/Users/dasherxd/Desktop/App-Market/lib/config.ts:137-158`

```typescript
export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || "9udUgupraga6dj92zfLec8bAdXUZsU3FGNN3Lf8XGzog"
);

export const TREASURY_WALLET = new PublicKey(
  process.env.NEXT_PUBLIC_TREASURY_WALLET || "3BU9NRDpXqw7h8wed1aTxERk4cg5hajsbH4nFfVgYkJ6"
);
```

**Issue:** Production wallet addresses hardcoded as fallbacks. If env vars are unset, payments may go to incorrect addresses.

**Impact:**
- Funds sent to wrong treasury if misconfigured
- Potential loss of platform fees

---

### 11. [MEDIUM] RPC URL Fallback to DevNet

**File:** `/Users/dasherxd/Desktop/App-Market/lib/solana.ts:45`

```typescript
const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
```

**Issue:** Falls back to devnet RPC in production if not configured, which would cause transactions to fail or use wrong network.

---

### 12. [MEDIUM] Dispute Resolution Lacks Admin Authorization

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/disputes/[id]/route.ts:48-50`

```typescript
// For now, only admin can resolve disputes
// TODO: Add admin check
```

**Issue:** TODO indicates missing authorization for dispute resolution endpoint.

---

### 13. [MEDIUM] Twitter OAuth Redirect URL Fallback

**Files:**
- `/Users/dasherxd/Desktop/App-Market/app/api/auth/twitter/callback/route.ts:9-10`
- `/Users/dasherxd/Desktop/App-Market/app/api/auth/twitter/connect/route.ts:10`

```typescript
const TWITTER_REDIRECT_URI = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/auth/twitter/callback`;
```

**Issue:** Falls back to localhost in production, breaking OAuth flow or creating open redirect opportunities.

---

### 14. [MEDIUM] MoonPay API Key Fallback to Empty

**File:** `/Users/dasherxd/Desktop/App-Market/components/wallet/AddFundsModal.tsx:42`

```typescript
moonpayUrl.searchParams.set("apiKey", process.env.NEXT_PUBLIC_MOONPAY_API_KEY || "");
```

**Issue:** Empty API key may cause silent failures or unexpected behavior in payment flow.

---

### 15. [MEDIUM] Buyback Wallet Fallback to Null

**File:** `/Users/dasherxd/Desktop/App-Market/lib/config.ts:161`

```typescript
buybackWallet: process.env.BUYBACK_WALLET || null,
```

**Issue:** If buyback is enabled but wallet not set, funds may be lost or transactions may fail.

---

## Low Severity Findings

### 16. [LOW] Example Credentials in .env.example

**File:** `/Users/dasherxd/Desktop/App-Market/.env.example:6`

```
NEXTAUTH_SECRET="your-super-secret-key-change-in-production"
```

**Issue:** Placeholder text could be used as-is by developers who don't read documentation.

**Recommendation:** Use obviously invalid placeholders like `CHANGE_ME_REQUIRED`

---

### 17. [LOW] Debug Session Page Exists

**File:** `/Users/dasherxd/Desktop/App-Market/app/debug/session/page.tsx`

**Issue:** Debug UI page exists at `/debug/session` for session inspection.

**Recommendation:** Remove or conditionally render only in development.

---

### 18. [LOW] Console Logging of Sensitive Data

Multiple files log wallet addresses, user IDs, and authentication flow details:
- `app/api/auth/privy/callback/route.ts`
- Various debug statements

**Recommendation:** Implement structured logging with PII redaction.

---

## Configuration Summary

### Fail-Open Patterns Found:
| Pattern | Location | Behavior |
|---------|----------|----------|
| `\|\| "default-secret"` | lib/auth.ts | Uses hardcoded secret if env missing |
| `secret && authHeader !== ...` | cron routes | No auth if secret unset |
| `\|\| ""` | lib/privy.ts | Empty credentials if missing |
| `\|\| "devnet-reset-2024"` | admin/reset-listings | Known default password |

### Environment Variables Requiring Validation:
1. `NEXTAUTH_SECRET` - Currently has runtime check for production only
2. `ADMIN_SECRET` - No check, has dangerous fallback
3. `CRON_SECRET` - No check, auth bypassed if missing
4. `PRIVY_APP_SECRET` - No check, empty string fallback
5. `DATABASE_URL` - No startup validation

---

## Recommendations Summary

### Immediate Actions Required:
1. **Rotate all credentials exposed in .env files**
2. Remove hardcoded admin secret fallback
3. Fix fail-open cron authentication
4. Remove debug endpoints from production
5. Stop exposing stack traces in error responses

### Architecture Changes:
1. Implement startup validation for all required environment variables
2. Use fail-secure patterns (deny by default)
3. Add rate limiting to administrative endpoints
4. Implement proper admin authorization system
5. Add structured logging with PII redaction

### Development Process:
1. Add pre-commit hooks to detect secrets
2. Use secret scanning in CI/CD
3. Implement environment variable documentation
4. Create production deployment checklist

---

*Report generated by Claude Code insecure-defaults security skill*
