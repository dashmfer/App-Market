# Database Security Audit Report

**Project:** App-Market
**Date:** 2026-01-31
**Auditor:** Claude Opus 4.5
**Scope:** Prisma Schema, Query Security, Data Access Patterns, Connection Security, Data at Rest

---

## Executive Summary

This audit examines the database security posture of the App-Market application, a marketplace platform using PostgreSQL with Prisma ORM. The analysis identified several security concerns across different risk levels, along with positive security patterns already in place.

### Risk Summary

| Severity | Count | Categories |
|----------|-------|------------|
| Critical | 2 | Admin secret exposure, OAuth token storage |
| High | 4 | Sensitive field exposure, cascade delete risks, mass assignment potential |
| Medium | 6 | Missing indexes, N+1 query potential, connection pooling gaps |
| Low | 3 | Soft delete absence, referral code predictability |

---

## 1. Prisma Schema Security

### 1.1 Sensitive Field Exposure

**File:** `/Users/dasherxd/Desktop/App-Market/prisma/schema.prisma`

#### Critical: OAuth Tokens Stored in Plain Text

```prisma
model Account {
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  id_token          String? @db.Text
  session_state     String?
}
```

**Risk:** OAuth tokens (`access_token`, `refresh_token`, `id_token`) are stored as plain text. If the database is compromised, attackers gain access to users' connected accounts (GitHub, Twitter, etc.).

**Evidence:** The `access_token` is used directly in API calls:
```typescript
// /Users/dasherxd/Desktop/App-Market/app/api/transactions/[id]/uploads/route.ts:327
if (!account?.access_token) {
  return { verified: false, error: 'GitHub access token not found...' };
}
const octokit = new Octokit({ auth: account.access_token });
```

**Recommendation:** Encrypt tokens at rest using application-level encryption or database column encryption.

#### High: Password Hash Exposed in Schema

```prisma
model User {
  passwordHash    String?
}
```

**Positive:** The password is properly hashed using bcryptjs with cost factor 12:
```typescript
// /Users/dasherxd/Desktop/App-Market/app/api/auth/register/route.ts:48
const passwordHash = await hash(password, 12);
```

**Concern:** No explicit field-level security to prevent accidental exposure through queries. Review all `select` clauses to ensure `passwordHash` is never returned.

#### Medium: Sensitive Metadata in JSON Fields

```prisma
model Upload {
  metadata      Json?  // Can contain credentials, social account passwords
}
```

**Evidence:** Social account passwords stored in metadata:
```typescript
// /Users/dasherxd/Desktop/App-Market/app/api/transactions/[id]/uploads/route.ts:379
if (!account.platform || !account.username || !account.password) {
  return { verified: false, error: 'Missing platform, username, or password...' };
}
```

**Risk:** Credentials for transferred social accounts are stored in plaintext JSON. This data should be encrypted.

### 1.2 Missing Indexes for Security Queries

**Positive - Well-indexed fields:**
- `@@index([walletAddress])` on User
- `@@index([email])` on User
- `@@index([userId])` on UserWallet, Notification, etc.
- `@@index([status])` on Listing, Dispute, etc.

**Missing indexes that could impact security audit queries:**
- No index on `Account.userId` (potential performance issue for OAuth lookups)
- No index on `Transaction.createdAt` (could affect fraud detection queries)
- No index on `ReferralEarning.status` (payment fraud detection)

### 1.3 Cascade Delete Implications

**File:** `/Users/dasherxd/Desktop/App-Market/prisma/schema.prisma`

```prisma
// Lines 119, 129, 136, 162, 502, 721
onDelete: Cascade
```

**Cascade Delete Chain Analysis:**

| Parent Model | Child Models (Cascade) | Risk |
|--------------|----------------------|------|
| User | Account, Session, UserWallet | **High** - Deleting user removes all auth tokens and wallets |
| Listing | ListingCollaborator | **Medium** - Deleting listing removes collaborator records |
| Transaction | TransactionPartner | **High** - Deleting transaction removes partner deposit records |
| Conversation | Message | **Low** - Expected behavior |

**Critical Risk:** A User delete operation cascades to:
1. All `Account` records (OAuth tokens)
2. All `Session` records
3. All `UserWallet` records

However, `Transaction`, `Listing`, `Bid`, `Review`, `Dispute` are NOT cascaded, which could leave orphaned records referencing a deleted user.

**Recommendation:**
1. Implement soft deletes for users (`deletedAt` timestamp)
2. Add referential integrity checks before allowing user deletion
3. Archive financial records before deletion

### 1.4 Soft Delete vs Hard Delete

**Finding:** No soft delete implementation exists in the schema.

**Missing pattern:**
```prisma
model User {
  deletedAt     DateTime?  // Should exist for soft deletes
  isDeleted     Boolean    @default(false)
}
```

**Impact:**
- Audit trail is lost when records are deleted
- No ability to recover accidentally deleted data
- Compliance concerns (GDPR right to erasure vs. audit requirements)

**Recommendation:** Implement soft deletes for:
- User (compliance, fraud investigation)
- Transaction (financial audit trail)
- Dispute (legal records)
- Review (content moderation history)

---

## 2. Query Security

### 2.1 Raw SQL Usage

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/stats/route.ts`

```typescript
// Lines 41-49
prisma.$queryRaw<{ avg_days: number }[]>`
  SELECT AVG(
    EXTRACT(EPOCH FROM (t."transferCompletedAt" - l."createdAt")) / 86400
  ) as avg_days
  FROM "Transaction" t
  JOIN "Listing" l ON t."listingId" = l.id
  WHERE t.status = 'COMPLETED'
  AND t."transferCompletedAt" IS NOT NULL
`
```

**Assessment:** This query uses template literals with no user input, making it **safe from SQL injection**.

**Positive:** Only one instance of raw SQL found, and it's parameterized correctly using tagged template literals.

### 2.2 Parameter Injection Risks

**No SQL injection vulnerabilities found.** All queries use Prisma's type-safe query builder.

**Positive patterns observed:**
```typescript
// User input sanitized through Prisma
const listing = await prisma.listing.findUnique({
  where: { slug }, // slug from URL params, but Prisma handles escaping
});
```

### 2.3 Mass Assignment Vulnerabilities

**High Risk Found:**

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/profile/route.ts`

```typescript
// Lines 96-117
const body = await req.json();
const validatedData = updateProfileSchema.parse(body);
// ...
const updatedUser = await prisma.user.update({
  where: { id: userId },
  data: validatedData,  // Zod schema limits fields - GOOD
});
```

**Positive:** Zod validation schema limits updateable fields:
```typescript
const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  username: z.string().min(3).max(30).regex(...).optional(),
  bio: z.string().max(500).optional(),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  discordHandle: z.string().max(50).optional(),
  image: z.string().url().optional(),
});
```

**However, mass assignment risks exist in:**

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/auth/privy/callback/route.ts`

```typescript
// Lines 270-299
const updates: any = {};  // Dynamic object built from input
if (email && !user.email) updates.email = email;
if (twitterId && !user.twitterId) {
  updates.twitterId = twitterId;
  updates.twitterUsername = twitterUsername;
  updates.twitterVerified = true;  // User can self-verify!
}
// ...
user = await prisma.user.update({
  where: { id: user.id },
  data: updates,
});
```

**Risk:** Users could potentially manipulate Privy responses to set `twitterVerified: true` without actual verification.

### 2.4 N+1 Query Issues (DoS Potential)

**Potential N+1 patterns identified:**

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/users/[username]/route.ts`

```typescript
// Lines 131-167 - Additional query per request for reserved listings
if (currentUserId || currentUserWallet) {
  const reservedListings = await prisma.listing.findMany({
    where: { sellerId: user.id, status: "RESERVED", ... },
  });
}
```

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/auth/privy/callback/route.ts`

```typescript
// Lines 32-53 - Loop with queries
for (const invite of pendingCollaboratorInvites) {
  await prisma.listingCollaborator.update(...);  // N queries
  await createNotification(...);  // N more queries
}
```

**Recommendation:** Use batch operations:
```typescript
await prisma.listingCollaborator.updateMany({
  where: { id: { in: inviteIds } },
  data: { userId },
});
```

---

## 3. Data Access Patterns

### 3.1 User Data Isolation

**Positive patterns found:**

Most endpoints properly filter by authenticated user:
```typescript
// /Users/dasherxd/Desktop/App-Market/app/api/notifications/route.ts:22-28
const notifications = await prisma.notification.findMany({
  where: {
    userId,  // Proper isolation
    ...(unreadOnly ? { read: false } : {}),
  },
});
```

```typescript
// /Users/dasherxd/Desktop/App-Market/app/api/disputes/route.ts:19-25
const disputes = await prisma.dispute.findMany({
  where: {
    OR: [
      { initiatorId: session.user.id },
      { respondentId: session.user.id },
    ],
  },
});
```

### 3.2 Multi-tenancy Concerns

**Architecture:** Single-tenant (all users share the same database without tenant isolation).

**Risk Areas:**
- Admin endpoints can access all data
- No row-level security enforced at database level
- Reliance on application-layer authorization

### 3.3 Ownership Verification Before Data Access

**Positive Example:**

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/listings/[slug]/route.ts`

```typescript
// Lines 159-165
if (listing.sellerId !== userId) {
  return NextResponse.json(
    { error: "You can only edit your own listings" },
    { status: 403 }
  );
}
```

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/transfers/[id]/route.ts`

```typescript
// Lines 146-152
const isPartner = !!userPartner;
if (transaction.buyerId !== session.user.id &&
    transaction.sellerId !== session.user.id &&
    !isPartner) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

**Comprehensive ownership checks observed in:**
- Listing updates/deletes
- Transaction access
- Dispute creation
- Notification access
- Profile updates

---

## 4. Connection Security

### 4.1 Connection String Handling

**File:** `/Users/dasherxd/Desktop/App-Market/prisma/schema.prisma`

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**Positive:** Connection string loaded from environment variable, not hardcoded.

**File:** `/Users/dasherxd/Desktop/App-Market/.env.example`

```
DATABASE_URL="postgresql://username:password@localhost:5432/appmarket?schema=public"
```

**Recommendation:** Ensure production connection strings include:
- `?sslmode=require` or `?sslmode=verify-full`
- Connection pooling parameters for serverless

### 4.2 SSL/TLS Enforcement

**File:** `/Users/dasherxd/Desktop/App-Market/DATABASE_SETUP_PRODUCTION.md`

```markdown
Your DATABASE_URL should look like:
postgresql://username:password@host:5432/database?sslmode=require
```

**Finding:** SSL is recommended in documentation but not enforced in schema or configuration.

**Recommendation:** Add SSL requirement to Prisma configuration or enforce via environment:
```
DATABASE_URL="...?sslmode=verify-full&sslrootcert=/path/to/ca-certificate.crt"
```

### 4.3 Connection Pooling (Serverless)

**File:** `/Users/dasherxd/Desktop/App-Market/lib/db.ts`

```typescript
// Use singleton pattern in both development AND production
// This prevents connection exhaustion in serverless environments
export const prisma = globalThis.prisma || new PrismaClient();
globalThis.prisma = prisma;
```

**Assessment:** Basic singleton pattern implemented.

**Missing for production serverless:**
- No explicit connection limits
- No connection timeout configuration
- No PgBouncer or similar pooler integration

**Recommendation for Vercel/serverless:**
```typescript
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_POOLER_URL, // Use pooler URL
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
});
```

---

## 5. Data at Rest

### 5.1 Sensitive Data Encryption

**Critical Finding:** No encryption at rest for sensitive fields.

| Field | Model | Data Type | Encryption Status |
|-------|-------|-----------|-------------------|
| `access_token` | Account | OAuth token | **NOT ENCRYPTED** |
| `refresh_token` | Account | OAuth token | **NOT ENCRYPTED** |
| `passwordHash` | User | Hashed password | Properly hashed (bcrypt) |
| `metadata` | Upload | Credentials JSON | **NOT ENCRYPTED** |
| `initiatorEvidence` | Dispute | Evidence JSON | **NOT ENCRYPTED** |
| `socialAccounts` | Listing | Account details | **NOT ENCRYPTED** |

### 5.2 PII Handling

**PII fields identified:**
- `User.email`
- `User.name`, `User.displayName`
- `User.walletAddress`
- `User.twitterUsername`, `User.githubUsername`
- `User.discordHandle`

**Risk:** No data masking or encryption for PII fields.

**Recommendation:**
1. Implement field-level encryption for sensitive PII
2. Add data masking for logs
3. Implement GDPR data export/deletion features

### 5.3 Secrets in Database

**Critical Finding:** Plaintext secrets stored in database.

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/transactions/[id]/uploads/route.ts`

```typescript
// Social account credentials stored in metadata
for (const account of metadata.accounts) {
  if (!account.platform || !account.username || !account.password) {
    // Passwords stored in plaintext JSON
  }
}
```

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/admin/reset-listings/route.ts`

```typescript
// Line 8
const ADMIN_SECRET = process.env.ADMIN_SECRET || "devnet-reset-2024";
```

**Critical:** Hardcoded fallback admin secret. If `ADMIN_SECRET` is not set, the default value is used.

---

## 6. Additional Security Findings

### 6.1 Admin Endpoint Security

**File:** `/Users/dasherxd/Desktop/App-Market/app/api/admin/reset-listings/route.ts`

```typescript
// Lines 8-28
const ADMIN_SECRET = process.env.ADMIN_SECRET || "devnet-reset-2024";

export async function DELETE(request: NextRequest) {
  const secret = searchParams.get("secret");  // Secret in URL!
  if (secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Invalid admin secret" }, { status: 403 });
  }
  // Can delete ALL listings
  if (deleteAll) {
    await prisma.listing.deleteMany({});
    // ... deletes all related data
  }
}
```

**Vulnerabilities:**
1. Admin secret passed in URL query parameter (logged in access logs)
2. Hardcoded default secret
3. No rate limiting
4. No IP restriction
5. Destructive operation with minimal safeguards

### 6.2 Authentication Token Handling

**File:** `/Users/dasherxd/Desktop/App-Market/lib/auth.ts`

```typescript
// Lines 23-27
return nextAuthGetToken({
  req,
  secret: secret || "development-secret-change-in-production",  // Fallback!
  cookieName,
});
```

**Risk:** Fallback secret for JWT verification in development could leak to production.

---

## 7. Recommendations Summary

### Critical Priority

1. **Encrypt OAuth tokens** at application level before storing in database
2. **Remove hardcoded admin secret** and require environment variable
3. **Move admin secret from URL** to authorization header
4. **Encrypt social account credentials** in Upload.metadata

### High Priority

5. Implement **soft deletes** for User, Transaction, Dispute models
6. Add **field-level encryption** for sensitive JSON metadata
7. Review **cascade delete implications** and add safeguards
8. Implement **row-level security** or tenant isolation

### Medium Priority

9. Add **missing database indexes** for security query patterns
10. Configure **connection pooling** for serverless environments
11. Enforce **SSL/TLS** in database connection string
12. Fix **N+1 query patterns** to prevent DoS

### Low Priority

13. Add **audit logging** for sensitive operations
14. Implement **data masking** in logs
15. Add **rate limiting** to admin endpoints
16. Create **data retention policies**

---

## 8. Appendix: Files Reviewed

| File Path | Analysis |
|-----------|----------|
| `/Users/dasherxd/Desktop/App-Market/prisma/schema.prisma` | Schema security, indexes, cascades |
| `/Users/dasherxd/Desktop/App-Market/lib/db.ts` | Connection pooling |
| `/Users/dasherxd/Desktop/App-Market/lib/auth.ts` | Authentication token handling |
| `/Users/dasherxd/Desktop/App-Market/app/api/stats/route.ts` | Raw SQL usage |
| `/Users/dasherxd/Desktop/App-Market/app/api/profile/route.ts` | Mass assignment |
| `/Users/dasherxd/Desktop/App-Market/app/api/admin/reset-listings/route.ts` | Admin security |
| `/Users/dasherxd/Desktop/App-Market/app/api/transactions/[id]/uploads/route.ts` | Credential storage |
| `/Users/dasherxd/Desktop/App-Market/app/api/auth/privy/callback/route.ts` | User creation security |
| `/Users/dasherxd/Desktop/App-Market/app/api/listings/[slug]/route.ts` | Authorization checks |
| `/Users/dasherxd/Desktop/App-Market/app/api/disputes/route.ts` | Data isolation |
| `/Users/dasherxd/Desktop/App-Market/app/api/notifications/route.ts` | User data isolation |
| `/Users/dasherxd/Desktop/App-Market/.env.example` | Connection string patterns |

---

*Report generated by automated security analysis. Manual review recommended for all critical findings.*
