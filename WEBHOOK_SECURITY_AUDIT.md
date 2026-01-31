# Webhook and Callback Security Audit Report

**Date:** 2026-01-31
**Auditor:** Claude Code Security Analysis
**Scope:** Webhook endpoints, cron jobs, and OAuth callbacks

---

## Executive Summary

This audit examines the security posture of webhook endpoints, cron jobs, and OAuth callbacks in the App-Market application. The analysis reveals **several critical and high-severity security issues** that require immediate attention.

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Stripe Webhook | 0 | 2 | 1 | 0 |
| Cron Endpoints | 1 | 2 | 1 | 0 |
| OAuth Callbacks | 0 | 1 | 2 | 1 |
| **Total** | **1** | **5** | **4** | **1** |

---

## 1. Stripe Webhook Analysis

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/webhooks/stripe/route.ts`

### 1.1 Signature Verification

**Status:** IMPLEMENTED

```typescript
try {
  event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
} catch (err: any) {
  console.error("Webhook signature verification failed:", err.message);
  return NextResponse.json(
    { error: "Invalid signature" },
    { status: 400 }
  );
}
```

**Assessment:** The Stripe SDK's `constructEvent` method properly validates HMAC-SHA256 signatures. This is the correct approach and prevents unauthorized webhook calls.

### 1.2 Replay Attack Prevention

**Status:** NOT IMPLEMENTED - HIGH SEVERITY

**Issue:** There is no idempotency check or event ID tracking to prevent replay attacks.

**Risk:** An attacker who captures a valid webhook payload could replay it multiple times, potentially:
- Creating duplicate transactions
- Inflating user statistics (totalSales, totalPurchases, totalVolume)
- Sending duplicate notifications

**Evidence:**
```typescript
// No check for previously processed events
switch (event.type) {
  case "payment_intent.succeeded": {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    await handlePaymentSuccess(paymentIntent);  // No idempotency key check
    break;
  }
}
```

**Recommendation:** Implement idempotency by:
1. Storing processed event IDs in the database
2. Checking if `event.id` has been processed before executing business logic
3. Using database transactions to ensure atomicity

### 1.3 Idempotency Handling

**Status:** PARTIALLY IMPLEMENTED - HIGH SEVERITY

**Issue:** While the code uses `paymentIntent.id` in the transaction record, there's no check to prevent duplicate processing.

```typescript
await prisma.transaction.create({
  data: {
    // ...
    stripePaymentId: paymentIntent.id,  // Stored but not checked
    // ...
  },
});
```

**Risk:** The same payment could be processed multiple times if Stripe retries the webhook or an attacker replays it.

**Recommendation:**
1. Add a unique constraint on `stripePaymentId` in the database schema
2. Use `upsert` or check for existing transactions before creating new ones
3. Wrap the entire handler in a database transaction

### 1.4 Event Type Validation

**Status:** IMPLEMENTED

**Assessment:** The webhook properly validates event types with a switch statement and logs unhandled events:
```typescript
default:
  console.log(`Unhandled event type: ${event.type}`);
```

**Recommendation:** Consider explicitly listing all expected event types and returning appropriate responses.

### 1.5 Error Handling

**Status:** IMPLEMENTED - MEDIUM SEVERITY CONCERN

```typescript
} catch (error) {
  console.error("Webhook error:", error);
  return NextResponse.json(
    { error: "Webhook handler failed" },
    { status: 500 }
  );
}
```

**Issue:** Returning 500 causes Stripe to retry the webhook, which could be problematic if the error is due to business logic (e.g., listing not found).

**Recommendation:** Differentiate between:
- Transient errors (500) - should be retried
- Permanent errors (400) - should not be retried

---

## 2. Cron Endpoints Analysis

### 2.1 Buyer Info Deadlines Cron

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/cron/buyer-info-deadlines/route.ts`

#### Authentication/Authorization

**Status:** WEAK IMPLEMENTATION - CRITICAL SEVERITY

```typescript
const authHeader = request.headers.get("authorization");
const cronSecret = process.env.CRON_SECRET;

if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**Critical Issues:**

1. **Optional Security:** The condition `if (cronSecret && ...)` means if `CRON_SECRET` is not set, **no authentication is required**. The endpoint becomes publicly accessible.

2. **Timing Attack Vulnerability:** The string comparison `authHeader !== \`Bearer ${cronSecret}\`` uses JavaScript's native comparison, which is not constant-time. An attacker could potentially brute-force the secret character by character.

3. **No IP Allowlisting:** No verification that requests come from expected cron service IPs.

#### Rate Limiting

**Status:** NOT IMPLEMENTED - HIGH SEVERITY

**Risk:** An attacker could flood this endpoint to:
- Cause excessive database queries
- Trigger notification spam
- Exhaust server resources

#### Abuse Prevention

**Status:** NOT IMPLEMENTED

**Risk:** Multiple concurrent requests could process the same transactions, leading to race conditions and duplicate notifications.

### 2.2 Check Partner Deposits Cron

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/cron/check-partner-deposits/route.ts`

#### Security Issues

**Status:** Same issues as buyer-info-deadlines - CRITICAL/HIGH SEVERITY

```typescript
if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

Additionally, this endpoint exposes a GET handler:
```typescript
export async function GET(request: NextRequest) {
  return POST(request);
}
```

**Risk:** The GET method makes it easier to trigger unintentionally (e.g., via browser, crawlers, or CSRF).

#### Financial Impact

This endpoint handles financial operations (refunds, transaction status changes). The security weaknesses have higher impact:
- Unauthorized status changes
- Premature or duplicate refund processing
- Notification spam to users

---

## 3. OAuth Callback Analysis

### 3.1 Twitter OAuth Callback

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/auth/twitter/callback/route.ts`

#### State Parameter Validation

**Status:** IMPLEMENTED

```typescript
if (state !== oauthData.state) {
  return NextResponse.redirect(
    `${SITE_URL}/dashboard/settings?twitter_error=state_mismatch`
  );
}
```

**Assessment:** Proper CSRF protection via state parameter validation.

#### PKCE Implementation

**Status:** IMPLEMENTED (in connect route)

```typescript
// From /api/auth/twitter/connect/route.ts
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}
```

**Assessment:** Proper PKCE implementation with S256 challenge method.

#### Cookie Security

**Status:** PARTIALLY IMPLEMENTED - MEDIUM SEVERITY

```typescript
response.cookies.set("twitter_oauth_data", Buffer.from(oauthData).toString("base64"), {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 600,
  path: "/",
});
```

**Issues:**
1. Cookie contains sensitive data (codeVerifier, userId) with only base64 encoding - not encrypted
2. Comment states "encrypted in production" but no encryption is implemented

**Risk:** If an attacker can read cookies (e.g., via XSS elsewhere), they can decode the OAuth data.

#### Error Information Leakage

**Status:** LOW SEVERITY

Error messages are passed via URL parameters which could be logged:
```typescript
return NextResponse.redirect(
  `${SITE_URL}/dashboard/settings?twitter_error=token_exchange_failed`
);
```

### 3.2 Privy Callback

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/auth/privy/callback/route.ts`

#### Token Verification

**Status:** IMPLEMENTED

```typescript
const claims = await verifyPrivyToken(accessToken);
if (!claims) {
  return NextResponse.json(
    { error: "Invalid or expired access token. Please try signing in again." },
    { status: 401 }
  );
}
```

**Assessment:** Token verification is delegated to the Privy SDK (`@privy-io/server-auth`), which handles JWT verification properly.

#### Information Disclosure

**Status:** HIGH SEVERITY

```typescript
return NextResponse.json(
  { error: errorMessage, details: error?.stack?.split('\n')[0] },
  { status: 500 }
);
```

**Risk:** Stack traces are returned in error responses, potentially revealing:
- Internal file paths
- Library versions
- Implementation details

#### Race Condition in User Creation

**Status:** MEDIUM SEVERITY

```typescript
let user = await prisma.user.findFirst({ ... });

if (!user) {
  // Check username exists
  const existingUsername = await prisma.user.findUnique({ where: { username } });
  // ...
  user = await prisma.user.create({ ... });
}
```

**Risk:** Time-of-check to time-of-use (TOCTOU) vulnerability. Two concurrent requests could create duplicate users or cause constraint violations.

---

## 4. Timing Attack Analysis

### 4.1 Cron Secret Comparison

**Status:** VULNERABLE

Both cron endpoints use non-constant-time string comparison:
```typescript
authHeader !== `Bearer ${cronSecret}`
```

**Risk:** Timing side-channel attacks could allow an attacker to discover the secret character by character.

**Recommendation:** Use `crypto.timingSafeEqual()`:
```typescript
import { timingSafeEqual } from 'crypto';

const expected = Buffer.from(`Bearer ${cronSecret}`);
const received = Buffer.from(authHeader || '');

if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

### 4.2 Stripe Signature Verification

**Status:** SAFE

The Stripe SDK uses constant-time comparison internally for signature verification.

### 4.3 Twitter State Comparison

**Status:** LIKELY VULNERABLE

```typescript
if (state !== oauthData.state) { ... }
```

**Risk:** Similar timing attack potential, though the state is random and short-lived, reducing practical exploitability.

---

## 5. Summary of Findings

### Critical Severity

| ID | Issue | Location |
|----|-------|----------|
| CRIT-01 | Cron endpoints allow unauthenticated access if CRON_SECRET is not set | `app/api/cron/*/route.ts` |

### High Severity

| ID | Issue | Location |
|----|-------|----------|
| HIGH-01 | No replay attack prevention in Stripe webhook | `app/api/webhooks/stripe/route.ts` |
| HIGH-02 | No idempotency check for payment processing | `app/api/webhooks/stripe/route.ts` |
| HIGH-03 | Timing-vulnerable secret comparison in cron auth | `app/api/cron/*/route.ts` |
| HIGH-04 | No rate limiting on cron endpoints | `app/api/cron/*/route.ts` |
| HIGH-05 | Stack trace disclosure in Privy callback errors | `app/api/auth/privy/callback/route.ts` |

### Medium Severity

| ID | Issue | Location |
|----|-------|----------|
| MED-01 | Stripe webhook returns 500 for non-transient errors | `app/api/webhooks/stripe/route.ts` |
| MED-02 | Cron endpoints expose GET handler | `app/api/cron/check-partner-deposits/route.ts` |
| MED-03 | OAuth cookie data not encrypted | `app/api/auth/twitter/connect/route.ts` |
| MED-04 | TOCTOU in Privy user creation | `app/api/auth/privy/callback/route.ts` |

### Low Severity

| ID | Issue | Location |
|----|-------|----------|
| LOW-01 | Error codes in URL parameters may be logged | `app/api/auth/twitter/callback/route.ts` |

---

## 6. Recommendations Summary

### Immediate Actions (Critical/High)

1. **Make cron authentication mandatory:**
   ```typescript
   if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
   }
   ```

2. **Implement constant-time comparison for secrets**

3. **Add idempotency to Stripe webhook:**
   - Store processed event IDs
   - Check before processing
   - Use database transactions

4. **Remove stack traces from production error responses**

5. **Implement rate limiting using Upstash Redis or similar**

### Short-term Actions (Medium)

1. **Encrypt OAuth cookie data** with a server-side key

2. **Use database transactions** for user creation to prevent race conditions

3. **Remove GET handler** from financial cron endpoints

4. **Differentiate transient vs permanent errors** in Stripe webhook

### Long-term Actions

1. **Implement IP allowlisting** for cron endpoints

2. **Add monitoring and alerting** for webhook failures

3. **Implement audit logging** for sensitive operations

4. **Consider using a job queue** (e.g., BullMQ) instead of HTTP cron endpoints

---

## 7. Security Controls Matrix

| Control | Stripe Webhook | Cron Endpoints | Twitter OAuth | Privy Callback |
|---------|----------------|----------------|---------------|----------------|
| Authentication | Signature | Weak Bearer | OAuth2 + PKCE | JWT |
| Replay Prevention | Missing | N/A | State param | Token expiry |
| Rate Limiting | Missing | Missing | Missing | Missing |
| Constant-time Comparison | SDK handles | Missing | Missing | SDK handles |
| Idempotency | Missing | Partial | N/A | N/A |
| Error Handling | Needs work | Adequate | Adequate | Leaks info |
| Audit Logging | Missing | Missing | Missing | Missing |

---

*End of Security Audit Report*
