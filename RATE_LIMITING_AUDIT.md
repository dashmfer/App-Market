# Rate Limiting and DoS Prevention Audit

**Date:** 2026-01-31
**Codebase:** App Market
**Auditor:** Security Analysis

---

## Executive Summary

This audit reveals **critical gaps** in rate limiting and DoS prevention across the App Market web application. The codebase has **no rate limiting middleware** implemented at the API layer, leaving all endpoints vulnerable to abuse. While the Solana smart contract includes DoS protections (e.g., MAX_BIDS=1000), the Next.js API routes have no corresponding safeguards.

### Risk Rating: **HIGH**

| Category | Status | Risk Level |
|----------|--------|------------|
| API Rate Limiting | Not Implemented | CRITICAL |
| Pagination Limits | Partially Implemented | MEDIUM |
| File Upload Limits | Implemented | LOW |
| Brute Force Prevention | Not Implemented | HIGH |
| Resource Exhaustion | Partially Addressed | MEDIUM |

---

## 1. API Rate Limiting

### 1.1 Rate Limiting Middleware

**Status:** NOT IMPLEMENTED

The codebase has **no rate limiting middleware**. Key observations:

1. **No `middleware.ts`** in the project root for Next.js middleware
2. **No rate limiting packages** in `package.json` (e.g., no `express-rate-limit`, `upstash/ratelimit`, `@vercel/kv`)
3. **No per-endpoint rate limiting** in any API route handlers

**Affected Files:**
- All files in `/Users/dasherxd/Desktop/App-Market/app/api/**/*.ts`

**Impact:**
- All 60+ API endpoints are unprotected
- Attackers can send unlimited requests
- Easy to overwhelm the database or external services

### 1.2 Endpoints Requiring Priority Rate Limiting

| Endpoint | Method | Priority | Reason |
|----------|--------|----------|--------|
| `/api/auth/register` | POST | CRITICAL | Account creation spam |
| `/api/auth/privy/callback` | POST | CRITICAL | Auth abuse |
| `/api/messages` | POST | HIGH | Message spam |
| `/api/bids` | POST | HIGH | Bid flooding |
| `/api/offers` | POST | HIGH | Offer spam |
| `/api/listings` | POST | HIGH | Listing spam |
| `/api/reviews` | POST | HIGH | Review manipulation |
| `/api/purchases` | POST | HIGH | Transaction abuse |
| `/api/github/verify` | POST | MEDIUM | External API calls |
| `/api/users/lookup` | GET/POST | MEDIUM | User enumeration |
| `/api/listings` | GET | MEDIUM | Expensive search queries |
| `/api/notifications` | GET | MEDIUM | Polling abuse |

### 1.3 Rate Limit Bypass Vectors

Since there are no rate limits, there is nothing to bypass. However, once implemented, consider:

1. **IP Spoofing via Headers** - Do not trust `X-Forwarded-For` without validation
2. **User ID Rotation** - Rate limit by session/user ID, not just IP
3. **API Key Rotation** - N/A (no API key system)
4. **Distributed Attacks** - Need edge-level protection (Cloudflare, Vercel)

---

## 2. DoS Vectors

### 2.1 Expensive Database Queries

**CRITICAL:** Several endpoints allow expensive, unbounded queries.

#### 2.1.1 Search Functionality
**File:** `/Users/dasherxd/Desktop/App-Market/app/api/listings/route.ts`

```typescript
// Lines 53-58: Full-text search across multiple fields
if (search) {
  where.OR = [
    { title: { contains: search, mode: "insensitive" } },
    { tagline: { contains: search, mode: "insensitive" } },
    { description: { contains: search, mode: "insensitive" } },
  ];
}
```

**Issues:**
- Case-insensitive `contains` search on `description` field (potentially large text)
- No search term length validation
- No query complexity limits
- Three simultaneous `LIKE` queries per request

**Attack Vector:**
```bash
# Repeated expensive searches
for i in {1..1000}; do
  curl "https://app.com/api/listings?search=a" &
done
```

#### 2.1.2 User Lookup
**File:** `/Users/dasherxd/Desktop/App-Market/app/api/users/lookup/route.ts`

```typescript
// Lines 62-68: Case-insensitive partial match across multiple fields
user = await prisma.user.findFirst({
  where: {
    OR: [
      { username: { contains: query, mode: "insensitive" } },
      { displayName: { contains: query, mode: "insensitive" } },
      { twitterUsername: { contains: query, mode: "insensitive" } },
    ],
  },
```

**Issues:**
- Minimum query length is only 2 characters (line 11)
- Allows batch lookups of up to 10 queries in POST (line 123)
- Can be used for user enumeration

#### 2.1.3 Messages Without Pagination
**File:** `/Users/dasherxd/Desktop/App-Market/app/api/messages/[conversationId]/route.ts`

```typescript
// Lines 66-79: Fetches ALL messages in a conversation
const messages = await prisma.message.findMany({
  where: { conversationId },
  include: {
    sender: { ... },
  },
  orderBy: { createdAt: "asc" },
  // NO take/limit!
});
```

**Issue:** No pagination - conversations with thousands of messages will cause memory exhaustion.

### 2.2 Unbounded Pagination

**PARTIALLY ADDRESSED**

Some endpoints have pagination, but with insufficient limits:

| Endpoint | Limit Default | Max Limit | Status |
|----------|---------------|-----------|--------|
| `/api/listings` | 20 | None | VULNERABLE |
| `/api/reviews` | 10 | None | VULNERABLE |
| `/api/notifications` | 50 | None | VULNERABLE |
| `/api/messages` | N/A | N/A | NO PAGINATION |
| `/api/transactions` | N/A | N/A | NO PAGINATION |
| `/api/purchases` | N/A | N/A | NO PAGINATION |
| `/api/watchlist` | N/A | N/A | NO PAGINATION |
| `/api/bids` | N/A | N/A | NO PAGINATION |

**Issue:** Attackers can request `?limit=10000` on paginated endpoints.

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/listings/route.ts`

```typescript
// Lines 21-22: No maximum limit validation
const page = parseInt(searchParams.get("page") || "1");
const limit = parseInt(searchParams.get("limit") || "20");
// Attacker can use ?limit=999999
```

### 2.3 Large File Uploads

**PROPERLY IMPLEMENTED**

File uploads have proper limits:

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/user/profile/image/route.ts`

```typescript
// Lines 40-47: 5MB limit with validation
const maxSize = 5 * 1024 * 1024; // 5MB
if (file.size > maxSize) {
  return NextResponse.json(
    { error: "File too large. Maximum size is 5MB." },
    { status: 400 }
  );
}
```

**Also in:** `/Users/dasherxd/Desktop/App-Market/app/api/profile/upload-picture/route.ts`

**Good Practices Observed:**
- File type validation by MIME type
- File extension validation
- Size limit enforcement
- Using Vercel Blob (managed storage)

### 2.4 Complex Regex Patterns

**LOW RISK**

Regex usage is minimal and safe:

| File | Pattern | Risk |
|------|---------|------|
| `/api/auth/register/route.ts` | `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` | LOW - Email validation |
| `/api/referrals/route.ts` | `/^[a-z0-9_-]+$/` | LOW - Simple character class |
| `/api/users/lookup/route.ts` | `/^[1-9A-HJ-NP-Za-km-z]{32,44}$/` | LOW - Fixed length |
| `/api/profile/route.ts` | `/^[a-z0-9_]+$/` | LOW - Simple character class |

**No ReDoS vulnerabilities identified** - all patterns are linear complexity.

---

## 3. Resource Exhaustion

### 3.1 Memory-Intensive Operations

**MEDIUM RISK**

#### 3.1.1 Unbounded Array Processing
**File:** `/Users/dasherxd/Desktop/App-Market/app/api/transactions/[id]/uploads/route.ts`

```typescript
// Line 41: No limit on uploads array size
const uploads: UploadData[] = await req.json();

// Line 93-105: Creates database records for each upload
await prisma.upload.createMany({
  data: uploads.map(upload => ({ ... })),
});
```

**Issue:** Attacker could send thousands of upload records in a single request.

#### 3.1.2 Batch User Lookups
**File:** `/Users/dasherxd/Desktop/App-Market/app/api/users/lookup/route.ts`

```typescript
// Line 123: Limited to 10, but each spawns a DB query
if (queries.length > 10) {
  return NextResponse.json(
    { error: "Maximum 10 queries per request" },
    { status: 400 }
  );
}
```

**Good:** Has a limit of 10 queries per request.

### 3.2 Database Connection Limits (Prisma)

**ADDRESSED**

**File:** `/Users/dasherxd/Desktop/App-Market/lib/db.ts`

```typescript
// Lines 7-12: Singleton pattern implemented
// Use singleton pattern in both development AND production
// This prevents connection exhaustion in serverless environments
export const prisma = globalThis.prisma || new PrismaClient();
globalThis.prisma = prisma;
```

**Good Practices:**
- Singleton pattern for Prisma client
- Works in serverless environments
- Prevents connection pool exhaustion

**Potential Issue:** No connection pool size configuration visible. Default Prisma pool may be insufficient under heavy load.

### 3.3 External API Call Limits

**MEDIUM RISK**

#### 3.3.1 GitHub API Calls
**File:** `/Users/dasherxd/Desktop/App-Market/app/api/github/verify/route.ts`

```typescript
// Lines 27-91: Makes 3 GitHub API calls per request
const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, ...);
const contentsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents`, ...);
const commitsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`, ...);
```

**Issues:**
- No rate limiting on this endpoint
- Each request makes 3 GitHub API calls
- GitHub rate limit: 60/hour (unauthenticated), 5000/hour (authenticated)
- No caching of results

**Attack Vector:**
```bash
# Exhaust GitHub rate limit
for i in {1..100}; do
  curl -X POST "/api/github/verify" -d '{"owner":"test","repo":"test"}'
done
```

#### 3.3.2 Privy API Calls
**File:** `/Users/dasherxd/Desktop/App-Market/app/api/auth/privy/callback/route.ts`

```typescript
// Lines 138, 150: Two Privy API calls per auth
const claims = await verifyPrivyToken(accessToken);
const privyUser = await getPrivyUser(claims.userId);
```

**Issue:** No protection against repeated auth attempts that consume Privy API quota.

---

## 4. Abuse Prevention

### 4.1 Account Enumeration

**VULNERABLE**

Multiple endpoints leak user existence:

#### 4.1.1 Registration
**File:** `/Users/dasherxd/Desktop/App-Market/app/api/auth/register/route.ts`

```typescript
// Lines 40-44: Reveals if email exists
if (existingUser) {
  return NextResponse.json(
    { error: "Email already registered" },
    { status: 400 }
  );
}
```

#### 4.1.2 User Lookup
**File:** `/Users/dasherxd/Desktop/App-Market/app/api/users/lookup/route.ts`

Returns different responses for existing vs non-existing users, enabling enumeration.

### 4.2 Brute Force Login

**NOT APPLICABLE (Wallet-Based Auth)**

The application uses wallet-based authentication via Privy, so traditional password brute force is not applicable. However:

**Potential Issues:**
1. No lockout after failed wallet signature verifications
2. No CAPTCHA on any forms
3. No rate limiting on auth endpoints

### 4.3 Message/Listing Spam

**HIGHLY VULNERABLE**

#### 4.3.1 Message Spam
**File:** `/Users/dasherxd/Desktop/App-Market/app/api/messages/route.ts`

```typescript
// POST endpoint - No rate limiting
// No cooldown between messages
// No daily message limit
const message = await prisma.message.create({ ... });
```

**Attack:** Authenticated user can send unlimited messages.

#### 4.3.2 Listing Spam
**File:** `/Users/dasherxd/Desktop/App-Market/app/api/listings/route.ts`

```typescript
// POST endpoint - No rate limiting
// No limit on active listings per user
// No cooldown between listings
const listing = await prisma.listing.create({ ... });
```

**Attack:** Authenticated user can create unlimited listings.

#### 4.3.3 Bid Spam
**File:** `/Users/dasherxd/Desktop/App-Market/app/api/bids/route.ts`

```typescript
// POST endpoint - No rate limiting
// Smart contract has DoS protection, but API doesn't
const bid = await prisma.bid.create({ ... });
```

**Note:** The Solana smart contract has `MAX_CONSECUTIVE_BIDS = 10`, but the API layer has no corresponding protection.

### 4.4 Notification Spam

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/notifications/route.ts`

Multiple actions create notifications without limits:
- Bids create seller notifications
- Messages create recipient notifications
- Purchases create multiple notifications

**Issue:** Notification table can grow unbounded, impacting database performance.

---

## 5. Specific Endpoint Analysis

### 5.1 Search Functionality

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/listings/route.ts`

| Issue | Severity | Details |
|-------|----------|---------|
| No rate limiting | HIGH | Unlimited searches allowed |
| No search term length limit | MEDIUM | Can search for single characters |
| No query caching | MEDIUM | Same search repeated hits database |
| Case-insensitive search | MEDIUM | More expensive than exact match |
| Multi-field OR search | MEDIUM | 3x query cost |

### 5.2 Listing Creation

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/listings/route.ts`

| Issue | Severity | Details |
|-------|----------|---------|
| No rate limiting | HIGH | Unlimited listings allowed |
| No cooldown | MEDIUM | Can create back-to-back |
| Large body allowed | MEDIUM | `description` field unbounded |
| No active listing limit | LOW | User could have thousands |

### 5.3 Image Uploads

**Files:**
- `/Users/dasherxd/Desktop/App-Market/app/api/user/profile/image/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/profile/upload-picture/route.ts`

| Feature | Status | Details |
|---------|--------|---------|
| Size limit | OK | 5MB max |
| Type validation | OK | JPEG, PNG, GIF, WebP |
| Extension validation | OK | Double validation |
| Rate limiting | MISSING | Can upload repeatedly |
| Per-user storage limit | MISSING | No total storage limit |

### 5.4 Message Sending

**Files:**
- `/Users/dasherxd/Desktop/App-Market/app/api/messages/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/messages/[conversationId]/route.ts`

| Issue | Severity | Details |
|-------|----------|---------|
| No rate limiting | HIGH | Unlimited messages |
| No message length limit | MEDIUM | `content` field unbounded |
| No daily limit | MEDIUM | Can spam users |
| No conversation pagination | HIGH | Memory exhaustion |

---

## 6. Recommendations

### 6.1 Critical (Implement Immediately)

1. **Implement Rate Limiting Middleware**
   ```typescript
   // Using Vercel KV or Upstash Redis
   import { Ratelimit } from "@upstash/ratelimit";
   import { Redis } from "@upstash/redis";

   const ratelimit = new Ratelimit({
     redis: Redis.fromEnv(),
     limiter: Ratelimit.slidingWindow(10, "10 s"),
   });
   ```

2. **Add Edge Rate Limiting**
   - Configure Cloudflare or Vercel rate limiting rules
   - Implement IP-based limits at the edge

3. **Limit Pagination**
   ```typescript
   const MAX_LIMIT = 100;
   const limit = Math.min(parseInt(searchParams.get("limit") || "20"), MAX_LIMIT);
   ```

4. **Add Message Pagination**
   ```typescript
   const messages = await prisma.message.findMany({
     where: { conversationId },
     take: 50,  // Add limit
     skip: offset,
   });
   ```

### 6.2 High Priority

1. **Rate Limit by Endpoint Sensitivity**
   | Endpoint Type | Limit | Window |
   |---------------|-------|--------|
   | Auth endpoints | 5 | 1 minute |
   | Write operations | 10 | 1 minute |
   | Search | 30 | 1 minute |
   | Read operations | 100 | 1 minute |

2. **Add CAPTCHA**
   - Implement Cloudflare Turnstile or reCAPTCHA
   - Required for: registration, listing creation, message sending

3. **Cache GitHub API Responses**
   ```typescript
   // Cache verification results for 5 minutes
   const cached = await redis.get(`github:${owner}/${repo}`);
   if (cached) return cached;
   ```

4. **Limit Uploads Array Size**
   ```typescript
   const MAX_UPLOADS = 20;
   if (uploads.length > MAX_UPLOADS) {
     return NextResponse.json({ error: "Too many uploads" }, { status: 400 });
   }
   ```

### 6.3 Medium Priority

1. **Add Search Query Limits**
   ```typescript
   const MAX_SEARCH_LENGTH = 100;
   if (search && search.length > MAX_SEARCH_LENGTH) {
     search = search.slice(0, MAX_SEARCH_LENGTH);
   }
   ```

2. **Implement User-Level Limits**
   - Max 10 active listings per user
   - Max 50 messages per hour
   - Max 100 bids per day

3. **Add Request Body Size Limits**
   ```typescript
   // In next.config.js
   api: {
     bodyParser: {
       sizeLimit: '1mb',
     },
   },
   ```

4. **Normalize Enumeration Responses**
   ```typescript
   // Always return same response format
   return NextResponse.json({
     message: "If an account exists, you will receive an email"
   });
   ```

### 6.4 Low Priority

1. **Add Prisma Query Timeouts**
   ```typescript
   const prisma = new PrismaClient({
     datasources: {
       db: {
         url: process.env.DATABASE_URL,
       },
     },
   }).$extends({
     query: {
       $allOperations({ operation, model, args, query }) {
         return Promise.race([
           query(args),
           new Promise((_, reject) =>
             setTimeout(() => reject(new Error("Query timeout")), 30000)
           ),
         ]);
       },
     },
   });
   ```

2. **Implement Connection Pool Monitoring**
3. **Add Request Logging for Anomaly Detection**

---

## 7. Smart Contract Comparison

The Solana smart contract has DoS protections that the API layer lacks:

| Protection | Smart Contract | API |
|------------|----------------|-----|
| Max bids per listing | 1,000 | None |
| Max consecutive bids | 10 | None |
| Max offers per listing | 100 | None |
| Max consecutive offers | 10 | None |
| Timeouts | 48hr dispute, 30-day backend | None |

**Recommendation:** Mirror these limits in the API layer.

---

## 8. Conclusion

The App Market application has **critical gaps** in rate limiting and DoS prevention at the API layer. While the Solana smart contract includes reasonable protections, the Next.js API routes are completely unprotected.

**Immediate actions required:**
1. Implement rate limiting middleware
2. Add pagination limits to all list endpoints
3. Add message endpoint pagination
4. Implement CAPTCHA for sensitive operations

**Estimated effort:** 2-3 days for critical items, 1 week for full implementation.

---

## Appendix: Affected Files

### Files Requiring Rate Limiting
- `/Users/dasherxd/Desktop/App-Market/app/api/auth/register/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/auth/privy/callback/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/messages/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/messages/[conversationId]/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/bids/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/offers/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/listings/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/reviews/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/purchases/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/github/verify/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/users/lookup/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/notifications/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/watchlist/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/transactions/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/profile/upload-picture/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/user/profile/image/route.ts`

### Files Requiring Pagination Limits
- `/Users/dasherxd/Desktop/App-Market/app/api/listings/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/reviews/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/notifications/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/messages/[conversationId]/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/transactions/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/purchases/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/watchlist/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/bids/route.ts`

### Database Configuration
- `/Users/dasherxd/Desktop/App-Market/lib/db.ts`
- `/Users/dasherxd/Desktop/App-Market/lib/prisma.ts`
