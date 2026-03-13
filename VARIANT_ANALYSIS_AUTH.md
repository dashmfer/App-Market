# Variant Analysis Report: Authentication Bypass Patterns

**Date:** 2026-01-31
**Scope:** `/api/transfers/`, `/api/transactions/`, `/api/withdrawals/`, `/api/payments/`, `/api/admin/`
**Focus:** Missing session checks, inconsistent auth, auth bypass via default values

---

## Executive Summary

This analysis identified **18 authentication-related findings** across the high-value API routes. The codebase generally implements authentication correctly using `getServerSession` or `getAuthToken`, but several patterns create potential attack surfaces.

### Risk Summary

| Severity | Count | Description |
|----------|-------|-------------|
| **CRITICAL** | 2 | Complete authentication bypass possible |
| **HIGH** | 4 | Authorization bypass or privilege escalation |
| **MEDIUM** | 6 | Weak auth validation patterns |
| **LOW** | 6 | Information disclosure or defense-in-depth gaps |

---

## CRITICAL Findings

### CRIT-01: Cron Endpoints Lack Mandatory Authentication

**Files:**
- `/Users/dasherxd/Desktop/App-Market/app/api/cron/buyer-info-deadlines/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/cron/check-partner-deposits/route.ts`

**Pattern:** Conditional auth that falls through when secret is not configured

```typescript
// buyer-info-deadlines/route.ts:9-14
const authHeader = request.headers.get("authorization");
const cronSecret = process.env.CRON_SECRET;

if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**Vulnerability:** When `CRON_SECRET` environment variable is not set:
- The condition `cronSecret && ...` evaluates to `false`
- Auth check is completely bypassed
- Any attacker can trigger deadline processing and transaction status changes

**Impact:**
- Attacker can mark transactions as `DEADLINE_PASSED` prematurely
- Force refunds on legitimate partner deposits
- Cancel transactions and restore listings maliciously
- Trigger notification spam to users

**Proof of Concept:**
```bash
# If CRON_SECRET is not set, this succeeds without auth
curl -X POST https://target.com/api/cron/buyer-info-deadlines
curl -X POST https://target.com/api/cron/check-partner-deposits
```

---

### CRIT-02: Debug Endpoint Exposes Database Information

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/debug/db-test/route.ts`

**Pattern:** Completely unauthenticated endpoint

```typescript
export async function GET() {
  try {
    await prisma.$connect();
    const userCount = await prisma.user.count();
    const firstUser = await prisma.user.findFirst({
      select: {
        id: true,
        email: true,
        username: true,
        createdAt: true,
      },
    });
    return NextResponse.json({
      success: true,
      database: 'connected',
      userCount,
      firstUser: firstUser || 'No users found',
      // ...
    });
  }
}
```

**Vulnerability:** No authentication whatsoever. Exposes:
- Database connectivity status
- Total user count
- First user's ID, email, and username
- Timestamps useful for timing attacks

**Impact:**
- Information disclosure for reconnaissance
- User enumeration possible
- Email harvesting for phishing

---

## HIGH Findings

### HIGH-01: Admin Endpoint Relies on URL Parameter for Secret

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/admin/reset-listings/route.ts`

**Pattern:** Hardcoded fallback secret + secret in URL

```typescript
// Line 8
const ADMIN_SECRET = process.env.ADMIN_SECRET || "devnet-reset-2024";

// Line 21
if (secret !== ADMIN_SECRET) {
  return NextResponse.json({ error: "Invalid admin secret" }, { status: 403 });
}

// Line 26-28
const session = await getServerSession(authOptions);
if (!session?.user?.id) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**Issues:**
1. **Hardcoded fallback secret** `"devnet-reset-2024"` - if `ADMIN_SECRET` env var is missing, this predictable value is used
2. **Secret transmitted in URL** via query parameter - logged in web server access logs, browser history, referrer headers
3. Session check happens AFTER secret check - allows probing valid secrets without session

**Impact:**
- Complete data destruction capability with known default secret
- Secret exposure in logs enables future attacks

---

### HIGH-02: Offers Listing Endpoint Missing Authorization

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/offers/listing/[listingId]/route.ts`

**Pattern:** No authentication or authorization

```typescript
export async function GET(
  req: NextRequest,
  { params }: { params: { listingId: string } }
) {
  try {
    const { listingId } = params;
    const offers = await prisma.offer.findMany({
      where: { listingId },
      include: {
        buyer: {
          select: {
            id: true, name: true, username: true, image: true,
            rating: true, totalPurchases: true,
          },
        },
      },
      // ...
    });
    return NextResponse.json(offers);
  }
}
```

**Vulnerability:** Anyone can view all offers on any listing, including:
- Offer amounts (competitive intelligence)
- Buyer identities and purchase history
- Buyer ratings

**Impact:**
- Competitors can see all offers to undercut
- Market manipulation by knowing offer positions
- Privacy violation for buyers

---

### HIGH-03: Public Profile Endpoint Exposes Internal User IDs

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/profile/[userId]/route.ts`

**Pattern:** No rate limiting, exposes internal IDs

```typescript
export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { userId } = params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, username: true, image: true, bio: true,
      displayName: true, websiteUrl: true, discordHandle: true,
      githubUsername: true, githubVerified: true, discordVerified: true,
      walletVerified: true, totalSales: true, totalPurchases: true,
      // ... listings, reviews
    },
  });
}
```

**Vulnerability:** Allows enumeration of user database using internal UUIDs

**Impact:** Information gathering for targeted attacks

---

### HIGH-04: Bids GET Endpoint No Authentication

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/bids/route.ts`

**Pattern:** GET handler has no auth, POST does

```typescript
// GET - No auth
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const listingId = searchParams.get("listingId");
  const bids = await prisma.bid.findMany({
    where: { listingId },
    include: {
      bidder: {
        select: { id: true, name: true, username: true, walletAddress: true, isVerified: true },
      },
    },
  });
}

// POST - Has auth
export async function POST(request: NextRequest) {
  const token = await getAuthToken(request);
  if (!token?.id) { return 401; }
  // ...
}
```

**Impact:** Competitive intelligence - anyone can monitor all bids on any listing

---

## MEDIUM Findings

### MED-01: Inconsistent Auth Pattern - getAuthToken vs getServerSession

**Affected Files:**
- `/api/transactions/route.ts` - uses `getAuthToken`
- `/api/transactions/[id]/confirm/route.ts` - uses `getServerSession`
- `/api/transfers/[id]/route.ts` - uses `getServerSession`

**Pattern:** Mixed authentication methods across related endpoints

```typescript
// transactions/route.ts
const token = await getAuthToken(request);
if (!token?.id) { ... }

// transactions/[id]/confirm/route.ts
const session = await getServerSession(authOptions);
if (!session?.user) { ... }  // Note: checks session?.user not session?.user?.id
```

**Risk:** Different validation depth:
- `getAuthToken` checks `token?.id`
- `getServerSession` sometimes checks `session?.user?.id`, sometimes just `session?.user`

This inconsistency could lead to edge cases where one passes but the other fails.

---

### MED-02: Partner Deposit Auth Allows Non-User Partners

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/transactions/[id]/partners/[partnerId]/deposit/route.ts`

**Pattern:** Auth check has conditional bypass

```typescript
// Line 44-46
if (partner.userId && partner.userId !== session.user.id) {
  return NextResponse.json({ error: "Only the partner can confirm their deposit" }, { status: 403 });
}
```

**Issue:** If `partner.userId` is null (unregistered wallet partner):
- The condition `partner.userId && ...` is false
- Auth check is skipped entirely
- ANY authenticated user can mark ANY unregistered partner's deposit as complete

**Impact:** Fraudulent deposit confirmations for wallet-only partners

---

### MED-03: Optional Chaining Pattern May Allow Null User

**Files:** Multiple across `/api/transfers/`, `/api/transactions/`

**Pattern:**
```typescript
if (!session?.user?.id) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
// Later...
session.user.id  // Used without null check
```

**Risk:** While TypeScript narrows the type after the check, the optional chaining suggests uncertainty about session structure. If session callback ever returns malformed data with `user: {}` (empty object), `session?.user?.id` would be `undefined` but `session.user` would be truthy.

---

### MED-04: Inconsistent Null Checks on session.user.id

**Affected Routes:**
- `/api/payments/create-intent/route.ts` - checks `session?.user`
- `/api/transactions/[id]/confirm/route.ts` - checks `session?.user`
- `/api/transactions/[id]/uploads/route.ts` - checks `session?.user`
- `/api/disputes/route.ts` - checks `session?.user`

**Pattern:**
```typescript
// payments/create-intent/route.ts:17
if (!session?.user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
// But then uses session.user.id in metadata line 91
```

**Risk:** These check `session?.user` but not `session?.user?.id`. If a session exists with a user object but no ID, the code would pass auth but fail later or use undefined values.

---

### MED-05: Webhook Trusts Metadata Without Additional Verification

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/webhooks/stripe/route.ts`

**Pattern:**
```typescript
async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const { listingId, buyerId, sellerId, amountSol, paymentType } = paymentIntent.metadata;
  // Directly uses metadata without verification
  await prisma.transaction.create({
    data: {
      listingId,
      buyerId,
      sellerId,
      // ...
    },
  });
}
```

**Risk:** While Stripe signature verification is done, the metadata was set by the create-intent endpoint. If an attacker can manipulate the payment intent before payment (e.g., via browser dev tools), they could:
- Set themselves as seller to receive funds
- Modify listing ID to affect different listings

**Mitigation needed:** Server-side verification of metadata against database state

---

### MED-06: Stats Endpoint Exposes Business Intelligence

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/stats/route.ts`

**Pattern:** Completely unauthenticated

```typescript
export async function GET() {
  const [totalSales, totalVolume, activeSellers, activeListings, avgSaleTime] = await Promise.all([
    prisma.transaction.count({ where: { status: "COMPLETED" } }),
    prisma.transaction.aggregate({ where: { status: "COMPLETED" }, _sum: { salePrice: true } }),
    // ...
  ]);
  return NextResponse.json({
    projectsSold: totalSales,
    totalVolume: totalVolume._sum.salePrice || 0,
    activeSellers,
    activeListings,
    avgSaleTime: avgDays,
  });
}
```

**Impact:** Competitors can monitor platform metrics, transaction volumes, seller counts

---

## LOW Findings

### LOW-01: Categories Endpoint Unauthenticated

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/categories/route.ts`

Likely intentional for public display, but verify this is expected.

---

### LOW-02: Public Listings Expose Seller Wallet Addresses

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/listings/[slug]/route.ts`

```typescript
seller: {
  select: {
    walletAddress: true,  // Exposes full wallet address
    // ...
  },
},
```

**Risk:** Wallet addresses can be used to track on-chain activity, correlate identities

---

### LOW-03: Transfer Routes Leak Wallet Prefixes

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/transfers/[id]/route.ts`

```typescript
walletAddress: transaction.buyer.walletAddress
  ? `${transaction.buyer.walletAddress.slice(0, 4)}...${transaction.buyer.walletAddress.slice(-4)}`
  : null,
```

**Observation:** This is good practice (truncating), but inconsistent with other endpoints that expose full addresses.

---

### LOW-04: Error Messages Leak Implementation Details

Multiple files include detailed error messages:
```typescript
return NextResponse.json({
  error: 'Internal server error',
  details: error instanceof Error ? error.message : 'Unknown error'
}, { status: 500 });
```

**Risk:** Stack traces and error details can aid attackers in understanding system internals.

---

### LOW-05: Test Session Endpoint Exposes Session Details

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/test-session/route.ts`

```typescript
return NextResponse.json({
  hasUser: !!session?.user,
  userId: session?.user?.id || null,
  userEmail: session?.user?.email || null,
});
```

**Risk:** Information disclosure about session state, useful for debugging attacks.

---

### LOW-06: GET Alias for Cron POST

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/cron/check-partner-deposits/route.ts`

```typescript
export async function GET(request: NextRequest) {
  return POST(request);
}
```

**Risk:** Cron actions accessible via browser navigation (GET requests)

---

## Remediation Recommendations

### Priority 1 (Immediate)

1. **CRIT-01:** Make cron secret mandatory
```typescript
const cronSecret = process.env.CRON_SECRET;
if (!cronSecret) {
  throw new Error("CRON_SECRET must be configured");
}
if (authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

2. **CRIT-02:** Delete or protect debug endpoint
```typescript
// Option A: Delete the file entirely
// Option B: Add strict auth
if (process.env.NODE_ENV === 'production') {
  return NextResponse.json({ error: "Not available" }, { status: 404 });
}
```

3. **HIGH-01:** Remove hardcoded secret fallback and move secret to header
```typescript
const ADMIN_SECRET = process.env.ADMIN_SECRET;
if (!ADMIN_SECRET) {
  return NextResponse.json({ error: "Admin not configured" }, { status: 500 });
}
const providedSecret = request.headers.get("x-admin-secret");
```

### Priority 2 (This Sprint)

4. **HIGH-02:** Add authorization to offers listing endpoint
```typescript
const session = await getServerSession(authOptions);
const listing = await prisma.listing.findUnique({ where: { id: listingId } });
if (listing.sellerId !== session?.user?.id) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

5. **MED-02:** Fix partner deposit auth
```typescript
// Always check session matches partner, even for unregistered wallets
const isOwner = partner.userId === session.user.id ||
  (await verifyWalletOwnership(session.user.id, partner.walletAddress));
if (!isOwner) {
  return NextResponse.json({ error: "Not authorized" }, { status: 403 });
}
```

### Priority 3 (Backlog)

6. Standardize on consistent auth pattern (`getServerSession` with `session?.user?.id` check)
7. Add rate limiting to public endpoints
8. Implement request signing for webhooks
9. Remove sensitive data from error responses in production

---

## Appendix: Files Reviewed

| File | Auth Method | Status |
|------|-------------|--------|
| `/api/transfers/[id]/route.ts` | getServerSession | OK |
| `/api/transfers/[id]/buyer-confirm/route.ts` | getServerSession | OK |
| `/api/transfers/[id]/seller-confirm/route.ts` | getServerSession | OK |
| `/api/transfers/[id]/complete/route.ts` | getServerSession | OK |
| `/api/transfers/[id]/fallback/route.ts` | getServerSession | OK |
| `/api/transactions/route.ts` | getAuthToken | OK |
| `/api/transactions/[id]/confirm/route.ts` | getServerSession | WARN: checks user not user.id |
| `/api/transactions/[id]/uploads/route.ts` | getServerSession | WARN: checks user not user.id |
| `/api/transactions/[id]/buyer-info/route.ts` | getServerSession | OK |
| `/api/transactions/[id]/partners/route.ts` | getServerSession | OK |
| `/api/transactions/[id]/partners/[partnerId]/deposit/route.ts` | getServerSession | VULN: conditional bypass |
| `/api/transactions/[id]/partners/[partnerId]/transfer-lead/route.ts` | getServerSession | OK |
| `/api/withdrawals/route.ts` | getServerSession | OK |
| `/api/withdrawals/[withdrawalId]/claim/route.ts` | getServerSession | OK |
| `/api/payments/create-intent/route.ts` | getServerSession | WARN: checks user not user.id |
| `/api/admin/reset-listings/route.ts` | getServerSession + secret | VULN: hardcoded fallback |
| `/api/cron/buyer-info-deadlines/route.ts` | Bearer token | VULN: optional auth |
| `/api/cron/check-partner-deposits/route.ts` | Bearer token | VULN: optional auth |
| `/api/webhooks/stripe/route.ts` | Stripe signature | OK (webhook-appropriate) |
| `/api/bids/route.ts` | getAuthToken (POST only) | WARN: GET unauthenticated |
| `/api/offers/listing/[listingId]/route.ts` | None | VULN: no auth |
| `/api/profile/[userId]/route.ts` | None | INFO: public profile |
| `/api/debug/db-test/route.ts` | None | VULN: exposes data |
| `/api/stats/route.ts` | None | INFO: public stats |
| `/api/listings/route.ts` | getAuthToken (POST only) | OK |
| `/api/listings/[slug]/route.ts` | getAuthToken (PUT only) | OK |

---

*Report generated by variant-analysis security scan*
