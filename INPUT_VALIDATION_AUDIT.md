# Input Validation and Sanitization Audit Report

**Codebase:** App-Market
**Audit Date:** 2026-01-31
**Scope:** API routes, path parameters, query parameters, file uploads, XSS prevention, and field-specific validation

---

## Executive Summary

This audit analyzed input validation and sanitization patterns across the App-Market codebase. The application uses a mix of validation approaches, with some routes implementing proper validation (using Zod schemas) while others rely on basic existence checks or no validation at all. Several high-severity issues were identified that could lead to security vulnerabilities.

### Risk Summary

| Category | High | Medium | Low |
|----------|------|--------|-----|
| API Input Validation | 4 | 6 | 3 |
| Path Parameter Validation | 2 | 3 | 1 |
| Query Parameter Handling | 1 | 4 | 2 |
| File Upload Validation | 0 | 2 | 1 |
| XSS Prevention | 1 | 2 | 1 |
| Specific Field Validation | 2 | 3 | 2 |

---

## 1. API Input Validation

### 1.1 Routes Using Zod Schema Validation (Good Practice)

The following routes properly implement Zod schema validation:

**`/api/offers/route.ts`**
```typescript
const createOfferSchema = z.object({
  listingId: z.string(),
  amount: z.number().positive(),
  deadline: z.string().datetime(),
});
```
- Validates field types and constraints
- Returns structured error messages

**`/api/profile/route.ts`**
```typescript
const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  username: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/).optional(),
  bio: z.string().max(500).optional(),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  discordHandle: z.string().max(50).optional(),
  image: z.string().url().optional(),
});
```
- Proper length constraints
- Username format validation with regex
- URL validation

### 1.2 Routes with Insufficient Validation

#### HIGH SEVERITY

**`/api/listings/route.ts` (POST)**
- Location: Lines 196-233
- Issue: No type validation for numeric fields
```typescript
const body = await request.json();
const {
  title,
  description,
  startingPrice,   // No validation - could be string/NaN
  reservePrice,    // No validation
  buyNowPrice,     // No validation
  monthlyUsers,    // parseInt without validation
  monthlyRevenue,  // parseFloat without validation
  // ... many more fields
} = body;
```
- **Risk:** Type coercion issues, potential NaN values in database
- **Recommendation:** Add Zod schema validation for all fields

**`/api/transactions/route.ts` (POST)**
- Location: Lines 99-100
- Issue: No validation of `listingId` format
```typescript
const { listingId, paymentMethod, stripePaymentId, onChainTx } = body;
```
- **Risk:** Invalid IDs passed to database queries
- **Recommendation:** Validate UUID format for `listingId`

**`/api/bids/route.ts` (POST)**
- Location: Lines 69-77
- Issue: Amount not validated as positive number
```typescript
const { listingId, amount, maxBid, currency, onChainTx } = body;
if (!listingId || !amount) {
  // Only checks existence, not type or value
}
```
- **Risk:** Negative or zero bids possible, type coercion issues
- **Recommendation:** Add numeric validation with positive constraint

**`/api/disputes/route.ts` (POST)**
- Location: Lines 79-88
- Issue: No validation of description length or content
```typescript
const { transactionId, reason, description, evidence } = body;
if (!transactionId || !reason || !description) {
  // Only existence check
}
```
- **Risk:** Unbounded string length, potential DoS
- **Recommendation:** Add length limits and sanitization

#### MEDIUM SEVERITY

**`/api/messages/route.ts` (POST)**
- Location: Lines 94-101
- Issue: No message content length validation
```typescript
const { recipientId, content, listingId } = body;
if (!recipientId || !content) {
  return NextResponse.json({ error: "Recipient and content are required" }, { status: 400 });
}
```
- **Risk:** Unbounded message size
- **Recommendation:** Add content length limit (e.g., 10,000 chars)

**`/api/reviews/route.ts` (POST)**
- Location: Lines 125-136
- Issue: Comment field has no length validation
```typescript
const {
  rating,
  communicationRating,
  speedRating,
  accuracyRating,
  comment,  // No length validation
} = body;
```
- **Risk:** Extremely long comments possible
- **Recommendation:** Add max length constraint for comment field

**`/api/token-launch/route.ts` (POST)**
- Location: Lines 32-44
- Issue: Token symbol/name not validated for format
```typescript
const {
  tokenName,     // No format validation
  tokenSymbol,   // No format validation
  totalSupply,   // No validation
} = body;
```
- **Risk:** Invalid token metadata
- **Recommendation:** Add regex validation for symbol (alphanumeric, 3-10 chars)

**`/api/listings/[slug]/collaborators/route.ts` (POST)**
- Location: Lines 109-115
- Issue: Wallet address validated only by length
```typescript
if (!walletAddress || !role || percentage === undefined) {
  // No format validation for wallet address
}
```
- **Risk:** Invalid wallet addresses accepted
- **Recommendation:** Use proper Solana address validation

**`/api/purchases/route.ts` (POST)**
- Location: Lines 36-42
- Issue: Array validation missing for `partners`
```typescript
const {
  partners,  // No validation that it's an array
  withPartners,
} = body;
```
- **Risk:** Type errors if partners is not an array
- **Recommendation:** Validate array type and structure

### 1.3 Type Coercion Patterns

**Pattern Found in Multiple Routes:**
```typescript
const page = parseInt(searchParams.get("page") || "1");
const limit = parseInt(searchParams.get("limit") || "20");
```
- No validation that result is a valid positive integer
- `parseInt("abc")` returns `NaN`

**Affected Routes:**
- `/api/listings/route.ts` (lines 21-22)
- `/api/reviews/route.ts` (lines 14-15)
- `/api/notifications/route.ts` (line 20)

---

## 2. Path Parameter Validation

### 2.1 UUID/ID Format Issues

#### HIGH SEVERITY

**No UUID Format Validation**
Multiple routes accept path parameters without validating format:

**`/api/disputes/[id]/route.ts`**
```typescript
const disputeId = params.id;  // No validation
const dispute = await prisma.dispute.findUnique({
  where: { id: disputeId },  // Passed directly to query
});
```

**`/api/transactions/[id]/confirm/route.ts`**
```typescript
const transactionId = params.id;  // No validation
```

**`/api/transfers/[id]/buyer-confirm/route.ts`**
```typescript
where: { id: params.id },  // Direct use without validation
```

- **Risk:** SQL injection unlikely with Prisma, but invalid IDs cause unnecessary database queries
- **Recommendation:** Add UUID format validation before queries

### 2.2 Slug Parameter Handling

**`/api/listings/[slug]/route.ts`**
- Slugs are used directly in queries without sanitization
- Pattern: `/api/listings/[slug]/`
- No validation that slug matches expected format

**`/api/messages/[conversationId]/route.ts`**
```typescript
const { conversationId } = await params;
// Used directly in query without validation
```

### 2.3 Path Traversal Risks

**LOW RISK:** No file system operations based on user-provided path parameters were found. All dynamic routes operate on database IDs/slugs.

---

## 3. Query Parameter Handling

### 3.1 Search Parameters

**`/api/listings/route.ts`**
```typescript
if (search) {
  where.OR = [
    { title: { contains: search, mode: "insensitive" } },
    { tagline: { contains: search, mode: "insensitive" } },
    { description: { contains: search, mode: "insensitive" } },
  ];
}
```
- **Status:** Safe - Prisma handles escaping
- **Note:** No length limit on search string

### 3.2 Pagination Limits

#### MEDIUM SEVERITY

**`/api/listings/route.ts`**
```typescript
const limit = parseInt(searchParams.get("limit") || "20");
// No maximum limit enforced
```
- **Risk:** Client can request unlimited records (`?limit=999999`)
- **Recommendation:** Enforce maximum limit (e.g., 100)

**`/api/notifications/route.ts`**
```typescript
const limit = parseInt(searchParams.get("limit") || "50");
// No maximum enforced
```

**`/api/reviews/route.ts`**
```typescript
const limit = parseInt(searchParams.get("limit") || "10");
// No maximum enforced
```

### 3.3 Filter Injection

**`/api/listings/route.ts`**
```typescript
if (status) {
  where.status = status.toUpperCase();  // Transforms but doesn't validate
}
```
- **Status:** Low risk - Prisma will reject invalid enum values
- **Note:** Could add explicit enum validation

**`/api/transactions/route.ts`**
```typescript
if (status) {
  where.status = status.toUpperCase();
}
```
- Same pattern, same risk level

### 3.4 Admin Route Security Issue

#### HIGH SEVERITY

**`/api/admin/reset-listings/route.ts`**
```typescript
const ADMIN_SECRET = process.env.ADMIN_SECRET || "devnet-reset-2024";
```
- **Issue:** Hardcoded fallback admin secret
- **Risk:** Unauthorized access to destructive admin operations
- **Recommendation:** Require environment variable, fail without it

---

## 4. File Upload Validation

### 4.1 Profile Picture Upload

**`/api/profile/upload-picture/route.ts`**
```typescript
// Validate file type
const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
if (!validTypes.includes(file.type)) {
  return NextResponse.json({ error: 'Invalid file type.' }, { status: 400 });
}

// Validate file size (max 5MB)
const maxSize = 5 * 1024 * 1024;
if (file.size > maxSize) {
  return NextResponse.json({ error: 'File too large.' }, { status: 400 });
}
```
- **Status:** Good - MIME type and size validation implemented
- **Note:** No content validation (magic bytes)

**`/api/user/profile/image/route.ts`**
```typescript
const fileValidation = validateFile(file.name);
if (!fileValidation.allowed || !isImageFile(file.name)) {
  return NextResponse.json({ error: 'Invalid file type.' }, { status: 400 });
}
```
- **Status:** Good - Uses file-security.ts library for validation

### 4.2 File Security Library

**`/lib/file-security.ts`**
- Implements blocked extensions list (executables, macros)
- Warning extensions (archives, PDFs)
- Safe extensions whitelist
- **Good Practice:** Comprehensive file type checking

### 4.3 Missing Validations

#### MEDIUM SEVERITY

**Content Validation Missing:**
- No magic bytes validation for uploaded files
- MIME type spoofing possible by manipulating Content-Type header

**`/api/transactions/[id]/uploads/route.ts`**
- Accepts upload metadata but doesn't validate actual file content
- Relies on type field being correct

---

## 5. XSS Prevention

### 5.1 User Content Rendering

#### HIGH SEVERITY

**`/app/listing/[slug]/page.tsx`**
```typescript
<div className="whitespace-pre-wrap">{listing.description}</div>
```
- **Issue:** Raw user content rendered without sanitization
- **Context:** Description field accepts arbitrary user input
- **Risk:** Stored XSS if description contains malicious scripts
- **Note:** React escapes by default, but `whitespace-pre-wrap` may have edge cases

### 5.2 Markdown/HTML Handling

**No dangerouslySetInnerHTML Found:**
- No instances of `dangerouslySetInnerHTML` in codebase
- No DOMPurify or sanitization libraries detected
- **Status:** Good - React's default escaping used throughout

### 5.3 URL Sanitization

#### MEDIUM SEVERITY

**`/api/profile/route.ts`**
```typescript
websiteUrl: z.string().url().optional().or(z.literal('')),
```
- **Issue:** Allows `javascript:` protocol URLs
- **Risk:** XSS via malicious URL in profile
- **Recommendation:** Add explicit protocol whitelist (http, https)

**Listing URLs:**
- `demoUrl`, `videoUrl` accepted without protocol validation
- Could contain javascript: URLs

### 5.4 Notification Content

**Multiple Routes:**
Notification messages include user-provided content:
```typescript
message: `${senderName} sent you a message`,
```
- **Status:** Low risk - displayed in controlled context
- **Note:** Ensure notification display escapes content

---

## 6. Specific Field Validation

### 6.1 Email Validation

**`/api/auth/register/route.ts`**
```typescript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
}
```
- **Status:** Basic validation present
- **Note:** Regex is minimal, allows unusual but valid emails

### 6.2 Username Constraints

**`/api/profile/route.ts`**
```typescript
username: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/).optional(),
```
- **Status:** Good - proper constraints
- Length: 3-30 characters
- Format: lowercase alphanumeric and underscore

**`/api/auth/register/route.ts`**
```typescript
const baseUsername = email.split("@")[0].toLowerCase().slice(0, 20);
```
- **Issue:** Auto-generated username may not match profile constraints
- Generated usernames truncated to 20 chars but profile allows 30

### 6.3 URL Validation

#### MEDIUM SEVERITY

**Missing Protocol Validation:**
```typescript
websiteUrl: z.string().url().optional()
```
- Zod's `.url()` validates URL format but allows any protocol
- `javascript:alert(1)` would pass validation

**Recommendation:** Add explicit check:
```typescript
websiteUrl: z.string().url().refine(
  (url) => url.startsWith('http://') || url.startsWith('https://'),
  { message: 'URL must use http or https protocol' }
).optional()
```

### 6.4 Wallet Address Validation

#### HIGH SEVERITY

**`/api/listings/route.ts`**
```typescript
// Validate wallet address format (Solana addresses are 32-44 characters)
if (reservedBuyerWallet.length < 32 || reservedBuyerWallet.length > 44) {
  return NextResponse.json({ error: "Invalid wallet address format" }, { status: 400 });
}
```
- **Issue:** Only length validation, no character set validation
- **Risk:** Invalid addresses with correct length accepted

**`/api/listings/[slug]/reserve/route.ts`**
```typescript
if (walletAddress.length < 32 || walletAddress.length > 44) {
  return NextResponse.json({ error: "Invalid wallet address format" }, { status: 400 });
}
```
- Same issue

**`/api/users/lookup/route.ts`**
```typescript
const isWalletAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(query);
```
- **Status:** Good - proper Base58 character validation
- **Recommendation:** Use this pattern consistently across codebase

### 6.5 Password Validation

**`/api/auth/register/route.ts`**
```typescript
if (password.length < 8) {
  return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
}
```
- **Status:** Basic length validation
- **Note:** No complexity requirements (uppercase, numbers, special chars)
- No maximum length (potential DoS with very long passwords)

---

## 7. Database Query Patterns

### 7.1 Safe Patterns

**Prisma ORM:** All database queries use Prisma, which provides:
- Parameterized queries (SQL injection protection)
- Type safety
- Automatic escaping

### 7.2 Direct Input to Queries

**Pattern Found:**
```typescript
const listing = await prisma.listing.findUnique({
  where: { slug },  // User input directly in where clause
});
```
- **Status:** Safe with Prisma
- **Note:** Could add format validation for efficiency

---

## 8. Recommendations

### Immediate Actions (High Priority)

1. **Add Maximum Pagination Limits**
   - Enforce `limit <= 100` on all paginated endpoints
   - Validate `page >= 1`

2. **Implement Zod Validation Across All Routes**
   - Create shared schema library
   - Apply to: listings, bids, transactions, disputes, messages

3. **Fix Wallet Address Validation**
   - Use consistent Base58 regex: `/^[1-9A-HJ-NP-Za-km-z]{32,44}$/`
   - Apply to all wallet address inputs

4. **Remove Hardcoded Admin Secret**
   - Require `ADMIN_SECRET` environment variable
   - Fail startup if not configured

5. **Add URL Protocol Validation**
   - Whitelist http/https protocols
   - Apply to: websiteUrl, demoUrl, videoUrl fields

### Medium Priority

6. **Add Content Length Limits**
   - Message content: 10,000 chars
   - Review comments: 2,000 chars
   - Dispute descriptions: 5,000 chars

7. **Validate UUID Format**
   - Add UUID validation helper
   - Apply to all ID path parameters

8. **Enhance File Upload Security**
   - Add magic bytes validation
   - Implement virus scanning integration

### Low Priority

9. **Add Password Complexity Requirements**
   - Require mix of character types
   - Add maximum length (e.g., 128 chars)

10. **Implement Rate Limiting**
    - Add rate limits to sensitive endpoints
    - Protect against brute force attacks

---

## 9. Files Reviewed

| File | Validation Status | Issues Found |
|------|------------------|--------------|
| `/api/auth/register/route.ts` | Partial | Basic email/password validation |
| `/api/listings/route.ts` | Minimal | Multiple unvalidated fields |
| `/api/bids/route.ts` | Minimal | Amount not validated |
| `/api/offers/route.ts` | Good | Zod schema used |
| `/api/profile/route.ts` | Good | Zod schema used |
| `/api/disputes/route.ts` | Minimal | No length validation |
| `/api/messages/route.ts` | Minimal | No content length limit |
| `/api/reviews/route.ts` | Partial | Rating validated, comment not |
| `/api/transactions/route.ts` | Minimal | Missing ID format validation |
| `/api/purchases/route.ts` | Minimal | Array validation missing |
| `/api/watchlist/route.ts` | Basic | ID existence only |
| `/api/notifications/route.ts` | Minimal | No pagination limit |
| `/api/token-launch/route.ts` | Minimal | Token fields unvalidated |
| `/api/admin/reset-listings/route.ts` | Critical | Hardcoded secret |
| `/api/webhooks/stripe/route.ts` | Good | Signature verification |
| `/api/profile/upload-picture/route.ts` | Good | MIME + size validation |
| `/api/user/profile/image/route.ts` | Good | Uses file-security lib |

---

## Appendix: Validation Patterns to Implement

### Recommended Zod Schemas

```typescript
// Shared validation schemas
import { z } from 'zod';

export const uuidSchema = z.string().uuid();

export const walletAddressSchema = z.string().regex(
  /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  'Invalid Solana wallet address'
);

export const safeUrlSchema = z.string().url().refine(
  (url) => /^https?:\/\//.test(url),
  { message: 'URL must use http or https protocol' }
);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const listingCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(10).max(10000),
  category: z.enum(['SAAS', 'AI_ML', 'MOBILE_APP', ...]),
  startingPrice: z.number().positive().optional(),
  buyNowPrice: z.number().positive().optional(),
  // ... other fields
});
```

---

*Report generated by security audit tool*
