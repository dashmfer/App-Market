# Sharp Edges Security Analysis Report

**Application:** App-Market
**Analysis Date:** 2026-01-31
**Analyst:** Claude Opus 4.5 (Sharp Edges Skill)

---

## Executive Summary

This report identifies API footguns, dangerous defaults, configuration cliffs, silent failures, and stringly-typed security patterns in the App-Market codebase. The analysis focuses on authentication, Privy/wallet integration, Stripe webhooks, session management, and API route configurations.

**Total Findings:** 15
- Critical: 4
- High: 5
- Medium: 4
- Low: 2

---

## Critical Findings

### 1. Hardcoded Fallback Secret in Authentication

**Location:** `/Users/dasherxd/Desktop/App-Market/lib/auth.ts:24,32`

**Category:** Dangerous Defaults

**Code:**
```typescript
// Line 24
secret: secret || "development-secret-change-in-production",

// Line 32
secret: secret || "development-secret-change-in-production",
```

**Exploitation Scenario:**
If `NEXTAUTH_SECRET` is not set in production, the application falls back to a predictable hardcoded secret. An attacker who discovers this can:
1. Forge valid JWT session tokens
2. Impersonate any user including admins
3. Bypass all authentication checks

The check on line 12-14 only throws in production if `NODE_ENV === "production"`, but the fallback on lines 24 and 32 still apply if the check is bypassed or in edge environments.

**Severity:** Critical

---

### 2. Hardcoded Admin Secret with Predictable Default

**Location:** `/Users/dasherxd/Desktop/App-Market/app/api/admin/reset-listings/route.ts:8`

**Category:** Dangerous Defaults

**Code:**
```typescript
const ADMIN_SECRET = process.env.ADMIN_SECRET || "devnet-reset-2024";
```

**Exploitation Scenario:**
The admin reset endpoint has a hardcoded fallback secret `"devnet-reset-2024"`. If `ADMIN_SECRET` is not set in production:
1. Attacker can call `DELETE /api/admin/reset-listings?secret=devnet-reset-2024&all=true`
2. All listings, transactions, bids, offers, disputes, and reviews can be wiped
3. Complete data destruction with no recovery

**Severity:** Critical

---

### 3. Privy Provider Trusts User-Provided userId Without Verification

**Location:** `/Users/dasherxd/Desktop/App-Market/lib/auth.ts:71-105`

**Category:** Silent Failures / Trust Boundary Violation

**Code:**
```typescript
CredentialsProvider({
  id: "privy",
  name: "Privy",
  credentials: {
    userId: { label: "User ID", type: "text" },
    walletAddress: { label: "Wallet Address", type: "text" },
  },
  async authorize(credentials) {
    if (!credentials?.userId) {
      throw new Error("Missing user ID");
    }
    // Directly looks up user by userId without verifying Privy token
    const user = await prisma.user.findUnique({
      where: { id: credentials.userId },
      ...
    });
```

**Exploitation Scenario:**
The Privy credentials provider accepts a `userId` and looks it up directly in the database. The comment says "This trusts that Privy has already verified the user," but there's no verification at the NextAuth level. If the `/api/auth/privy/callback` endpoint is bypassed (e.g., by calling NextAuth's `signIn('privy')` directly), an attacker can:
1. Supply any existing user's ID
2. Authenticate as that user without owning their wallet or email

**Severity:** Critical

---

### 4. Dispute Resolution Has No Admin Check (TODO Left in Code)

**Location:** `/Users/dasherxd/Desktop/App-Market/app/api/disputes/[id]/route.ts:48-51`

**Category:** Silent Failures / Missing Authorization

**Code:**
```typescript
// For now, only admin can resolve disputes
// In the future, this could be expanded to community arbitration
// TODO: Add admin check
// For MVP, we'll allow the initiator or respondent to "accept" a resolution
```

**Exploitation Scenario:**
The dispute resolution endpoint allows ANY authenticated user to resolve disputes with outcomes like `FULL_REFUND`, `PARTIAL_REFUND`, or `RELEASE_TO_SELLER`. An attacker can:
1. Open a dispute on their own transaction as buyer
2. Immediately call the resolution endpoint with `FULL_REFUND`
3. Receive full refund while potentially keeping transferred assets
4. The missing admin check allows self-service dispute resolution

**Severity:** Critical

---

## High Severity Findings

### 5. Cron Endpoints Bypass Auth When Secret Not Set

**Location:** `/Users/dasherxd/Desktop/App-Market/app/api/cron/buyer-info-deadlines/route.ts:10-14`
**Location:** `/Users/dasherxd/Desktop/App-Market/app/api/cron/check-partner-deposits/route.ts:11-15`

**Category:** Dangerous Defaults / Conditional Security

**Code:**
```typescript
const cronSecret = process.env.CRON_SECRET;

if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**Exploitation Scenario:**
If `CRON_SECRET` is not set, the authorization check is completely skipped. Attackers can:
1. Trigger deadline processing at will
2. Force transactions to be marked as `DEADLINE_PASSED`
3. Cancel partner transactions and trigger refund flows
4. Manipulate transaction state machine

**Severity:** High

---

### 6. Empty Privy Client When Credentials Not Set

**Location:** `/Users/dasherxd/Desktop/App-Market/lib/privy.ts:4-7`

**Category:** Silent Failures

**Code:**
```typescript
export const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID || "",
  process.env.PRIVY_APP_SECRET || ""
);
```

**Exploitation Scenario:**
When Privy credentials are not set, the client is initialized with empty strings. The `verifyPrivyToken` function returns `null` on failure (line 16), which is caught in the callback route. However, the empty-string client instantiation may have undefined behavior depending on the Privy SDK version, potentially causing:
1. Silent authentication bypass
2. Misleading error messages
3. Operational failures that appear as user errors

**Severity:** High

---

### 7. Stripe Webhook Non-Atomic Transaction Creation with Silent Failure

**Location:** `/Users/dasherxd/Desktop/App-Market/app/api/webhooks/stripe/route.ts:57-172`

**Category:** Silent Failures

**Code:**
```typescript
async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const { listingId, buyerId, sellerId, amountSol, paymentType } = paymentIntent.metadata;
  // ...
  if (!listing) {
    console.error("Listing not found for payment:", listingId);
    return;  // Silent failure - payment succeeded but no transaction created
  }
```

**Exploitation Scenario:**
If a listing is deleted between payment initiation and webhook processing:
1. Payment succeeds and funds are collected
2. Webhook handler returns silently without creating a transaction
3. No refund is triggered, no notification is sent
4. Customer loses money with no record in the system

Additionally, the entire webhook handler can fail silently (line 48-54 returns 500), and there's no retry/queue mechanism visible.

**Severity:** High

---

### 8. Hardcoded SOL/USD Price in Payment Intent

**Location:** `/Users/dasherxd/Desktop/App-Market/app/api/payments/create-intent/route.ts:80`

**Category:** Configuration Cliffs / Hardcoded Values

**Code:**
```typescript
// Convert SOL to USD (would use real-time oracle in production)
// For now, use a fixed rate or fetch from CoinGecko
const solPriceUsd = 150; // Placeholder - fetch real price
```

**Exploitation Scenario:**
If SOL price differs significantly from $150:
1. If SOL > $150: Sellers receive less USD value than expected
2. If SOL < $150: Buyers overpay significantly
3. During high volatility, this creates arbitrage opportunities
4. No mechanism to detect or alert on price deviation

**Severity:** High

---

### 9. JSON.parse Without Validation on User Input

**Location:** `/Users/dasherxd/Desktop/App-Market/app/api/listings/route.ts:320-322`

**Category:** Silent Failures / Input Validation

**Code:**
```typescript
socialAccounts: socialAccounts && typeof socialAccounts === 'string' && socialAccounts.trim()
  ? JSON.parse(socialAccounts)
  : (typeof socialAccounts === 'object' ? socialAccounts : null),
```

**Exploitation Scenario:**
User-provided `socialAccounts` string is parsed without try-catch:
1. Malformed JSON causes unhandled exception
2. Request fails with 500 error
3. No validation of parsed structure
4. Potential for prototype pollution if not properly sanitized

**Severity:** High

---

## Medium Severity Findings

### 10. Stringly-Typed Role Handling in Collaborators

**Location:** `/Users/dasherxd/Desktop/App-Market/app/api/listings/[slug]/collaborators/route.ts:117-121`

**Category:** Stringly-Typed Security

**Code:**
```typescript
// Validate role
if (!["PARTNER", "COLLABORATOR"].includes(role)) {
  return NextResponse.json(
    { error: "Invalid role. Must be PARTNER or COLLABORATOR" },
```

**Exploitation Scenario:**
Role validation uses string comparison instead of TypeScript enums:
1. Case sensitivity issues could allow bypass (`partner` vs `PARTNER`)
2. New role types could be missed in validation
3. Typos in role checks elsewhere in code won't be caught at compile time
4. The `canEdit: role === "PARTNER"` check depends on exact string match

**Severity:** Medium

---

### 11. Session Cookie sameSite: "lax" Allows Cross-Site Request Context

**Location:** `/Users/dasherxd/Desktop/App-Market/lib/auth.ts:118`

**Category:** Configuration Cliffs

**Code:**
```typescript
options: {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: process.env.NODE_ENV === "production",
},
```

**Exploitation Scenario:**
`sameSite: "lax"` allows cookies to be sent on top-level navigations from external sites:
1. Phishing links that navigate to app routes with side effects
2. GET-based state changes (though most appear to be POST)
3. The `secure: false` in development means cookies sent over HTTP

**Severity:** Medium

---

### 12. Wallet Signature Message Has No Nonce or Expiration

**Location:** `/Users/dasherxd/Desktop/App-Market/hooks/useAutoWalletAuth.ts:70-71`

**Category:** Algorithm/Mode Selection Footguns

**Code:**
```typescript
const message = `Sign this message to authenticate with App Market.\n\nWallet: ${publicKey.toBase58()}\nTimestamp: ${new Date().toISOString()}`;
```

**Exploitation Scenario:**
The signed message includes a timestamp but:
1. No server-side validation of timestamp freshness
2. No nonce from server (replay protection is client-side only)
3. A captured signature could be replayed indefinitely
4. The `verifyWalletSignature` function does not check message timestamp

**Severity:** Medium

---

### 13. 30-Day Session with No Token Refresh or Revocation

**Location:** `/Users/dasherxd/Desktop/App-Market/lib/auth.ts:107-109`

**Category:** Dangerous Defaults

**Code:**
```typescript
session: {
  strategy: "jwt",
  maxAge: 30 * 24 * 60 * 60, // 30 days
},
```

**Exploitation Scenario:**
Sessions last 30 days with no visible refresh mechanism:
1. Stolen tokens remain valid for a month
2. No mechanism to revoke sessions on password/wallet change
3. No token rotation on privilege escalation
4. Long session window increases exposure time

**Severity:** Medium

---

## Low Severity Findings

### 14. Debug Mode Enabled in Development

**Location:** `/Users/dasherxd/Desktop/App-Market/lib/auth.ts:128`

**Category:** Information Disclosure

**Code:**
```typescript
debug: process.env.NODE_ENV === 'development',
```

**Exploitation Scenario:**
Debug mode logs sensitive auth information. If `NODE_ENV` is not properly set:
1. Auth flow details logged
2. Token/session information exposed
3. Potential credential leakage in logs

**Severity:** Low

---

### 15. Referral Earnings Processing Fails Silently

**Location:** `/Users/dasherxd/Desktop/App-Market/app/api/transfers/[id]/complete/route.ts:139-150`

**Category:** Silent Failures

**Code:**
```typescript
try {
  const referralResult = await processReferralEarnings(
    transaction.id,
    transaction.salePrice,
    transaction.buyerId,
    transaction.sellerId
  );
  console.log("[Transfer Complete] Referral earnings processed:", referralResult);
} catch (referralError) {
  // Don't fail the transaction if referral processing fails
  console.error("[Transfer Complete] Failed to process referral earnings:", referralError);
}
```

**Exploitation Scenario:**
Referral earnings failures are logged but never retried or tracked:
1. Users may lose legitimate referral earnings
2. No notification to admins about failed earnings
3. No mechanism to reconcile or retry later
4. Creates accounting discrepancies

**Severity:** Low

---

## Recommendations Summary

### Immediate Actions (Critical/High)

1. **Remove all hardcoded fallback secrets** - Never allow security-sensitive defaults
2. **Add admin check to dispute resolution** - Implement proper role-based access control
3. **Verify Privy token in NextAuth provider** - Never trust user-provided IDs
4. **Make cron secrets mandatory** - Remove conditional security checks
5. **Add real-time price oracle** - Remove hardcoded SOL/USD rate
6. **Wrap JSON.parse in try-catch** - Handle malformed input gracefully

### Short-Term Actions (Medium)

1. **Use TypeScript enums for roles** - Replace string literals with type-safe enums
2. **Add signature nonce and expiration** - Server-generated nonces with TTL
3. **Implement session revocation** - Allow users to invalidate sessions
4. **Consider sameSite: "strict"** - Evaluate impact on legitimate cross-site flows

### Long-Term Actions

1. **Implement transaction queuing** - Retry failed webhook processing
2. **Add monitoring for silent failures** - Alert on console.error patterns
3. **Audit all env variable fallbacks** - Ensure secure defaults or hard failures

---

## Appendix: Files Analyzed

- `/Users/dasherxd/Desktop/App-Market/lib/auth.ts`
- `/Users/dasherxd/Desktop/App-Market/lib/privy.ts`
- `/Users/dasherxd/Desktop/App-Market/lib/config.ts`
- `/Users/dasherxd/Desktop/App-Market/lib/wallet-verification.ts`
- `/Users/dasherxd/Desktop/App-Market/lib/solana.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/webhooks/stripe/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/payments/create-intent/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/auth/privy/callback/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/auth/wallet/verify/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/admin/reset-listings/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/disputes/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/disputes/[id]/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/cron/buyer-info-deadlines/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/cron/check-partner-deposits/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/transfers/[id]/complete/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/listings/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/auth/twitter/callback/route.ts`
- `/Users/dasherxd/Desktop/App-Market/hooks/useAutoWalletAuth.ts`
- `/Users/dasherxd/Desktop/App-Market/.env.example`
