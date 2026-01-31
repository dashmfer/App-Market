# Access Control and Authorization Audit Report

**Application**: App-Market (SaaS/App Marketplace)
**Audit Date**: 2026-01-31
**Auditor**: Security Analysis

---

## Executive Summary

This audit analyzes the access control and authorization patterns across the App-Market codebase, focusing on IDOR vulnerabilities, role-based access control, resource ownership verification, and state-based access controls.

### Risk Rating Summary

| Category | Risk Level | Findings |
|----------|------------|----------|
| IDOR Vulnerabilities | **CRITICAL** | 3 Critical, 2 High |
| Role-Based Access Control | **HIGH** | 1 Critical, 1 High |
| Resource Ownership | **MEDIUM** | Mostly secure with gaps |
| Cross-User Access | **MEDIUM** | Partner/Collaborator controls exist |
| State-Based Access | **LOW** | Generally well-implemented |

---

## 1. IDOR Vulnerabilities

### 1.1 CRITICAL: Dispute Resolution Lacks Admin Authorization

**File**: `/Users/dasherxd/Desktop/App-Market/app/api/disputes/[id]/route.ts`
**Lines**: 7-60

```typescript
// POST /api/disputes/[id]/resolve - Resolve a dispute (admin only for now)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // ...
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // For now, only admin can resolve disputes
  // In the future, this could be expanded to community arbitration
  // TODO: Add admin check    <-- VULNERABILITY: TODO never implemented
```

**Issue**: The comment states "only admin can resolve disputes" but there is NO admin check implemented. Any authenticated user can resolve any dispute, choosing resolutions like `FULL_REFUND` or `RELEASE_TO_SELLER`.

**Impact**: Any user can manipulate dispute outcomes, causing financial harm to transaction participants.

**Recommendation**: Implement proper admin role checking before allowing dispute resolution.

---

### 1.2 CRITICAL: Purchase Partner Invite Details Exposed Without Authentication

**File**: `/Users/dasherxd/Desktop/App-Market/app/api/purchase-partners/[id]/route.ts`
**Lines**: 5-127

```typescript
// GET - Get purchase partner invite details by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: partnerId } = await params;

    // NO AUTHENTICATION CHECK - Anyone can access partner invite details
    const partner = await prisma.transactionPartner.findUnique({
      where: { id: partnerId },
      // ...includes sensitive transaction data, listing info, wallet addresses
```

**Issue**: No authentication or authorization check. Anyone with a partner ID can view:
- Wallet addresses (only partially masked)
- Transaction details and sale prices
- All partner deposit statuses
- Listing details

**Impact**: Information disclosure, potential phishing/social engineering attacks.

**Recommendation**: Add authentication and verify the requesting user is either a partner or the seller.

---

### 1.3 CRITICAL: Collaborator Invite Details Exposed to Any Authenticated User

**File**: `/Users/dasherxd/Desktop/App-Market/app/api/collaborators/[id]/respond/route.ts`
**Lines**: 148-202

```typescript
// GET /api/collaborators/[id]/respond - Get collaboration invite details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getAuthToken(request);
    if (!token?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only checks for authentication, NOT that user is the collaborator
    const { id: collaboratorId } = await params;

    const collaborator = await prisma.listingCollaborator.findUnique({
      where: { id: collaboratorId },
      include: {
        listing: { ... },  // Exposes listing details
      },
    });
    // ...
    return NextResponse.json({ collaborator });  // Returns to ANY authenticated user
```

**Issue**: Any authenticated user can view any collaborator invite details by guessing/enumerating IDs.

**Impact**: Information disclosure about listings, collaborator percentages, and seller details.

**Recommendation**: Add ownership check to verify the requesting user is either the collaborator or the listing owner.

---

### 1.4 HIGH: Profile Endpoint Exposes Sensitive User Data Without Access Control

**File**: `/Users/dasherxd/Desktop/App-Market/app/api/profile/[userId]/route.ts`
**Lines**: 1-94

```typescript
export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params;
    // NO AUTHENTICATION REQUIRED - Public endpoint

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        // Exposes potentially sensitive fields
        websiteUrl: true,
        discordHandle: true,
        githubUsername: true,
        // ...
```

**Issue**: No authentication required. By design this may be intentional for public profiles, but it exposes data that users might expect to be private.

**Impact**: Low-to-medium depending on data sensitivity expectations.

**Recommendation**: Review which fields should be public vs. private. Consider only exposing full details to authenticated users or the profile owner.

---

### 1.5 HIGH: Admin Reset Endpoint Uses Weak Secret-Based Authentication

**File**: `/Users/dasherxd/Desktop/App-Market/app/api/admin/reset-listings/route.ts`
**Lines**: 1-110

```typescript
// ADMIN SECRET - Set this in your environment variables for production
// For now, using a hardcoded key that you can change or disable
const ADMIN_SECRET = process.env.ADMIN_SECRET || "devnet-reset-2024";

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  // Verify admin secret
  if (secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Invalid admin secret" }, { status: 403 });
  }
```

**Issues**:
1. Hardcoded fallback secret `"devnet-reset-2024"` in production code
2. Secret passed in URL query parameters (logged in server logs, browser history)
3. No rate limiting on admin endpoint

**Impact**: If secret is guessed or leaked, all marketplace data can be deleted.

**Recommendation**:
- Remove hardcoded fallback
- Use proper admin role-based authentication
- Never pass secrets in URLs

---

## 2. Role-Based Access Control

### 2.1 Role System Analysis

**Finding**: The application has NO formal role system. There is no `isAdmin`, `role`, or `ADMIN` field in the User schema.

```prisma
model User {
  id              String    @id @default(cuid())
  // ... NO role field exists
  isVerified      Boolean   @default(false)  // Only verification status
  kycStatus       KycStatus @default(NONE)
  // ...
}
```

**Roles that exist implicitly**:
- **Seller**: User who creates listings (`listing.sellerId`)
- **Buyer**: User who purchases (`transaction.buyerId`)
- **Collaborator**: User added to listing (`ListingCollaborator.userId`)
- **Partner**: Co-buyer on transaction (`TransactionPartner.userId`)
- **Lead Buyer**: Partner with `isLead: true`

**Missing Roles**:
- No Admin role
- No Moderator role
- No Platform Operator role

---

### 2.2 CRITICAL: Admin Functionality Without Admin Role

Multiple features require admin access but have no proper implementation:

1. **Dispute Resolution** (`/api/disputes/[id]/route.ts`): Comment says "admin only" but no check
2. **Listing Reset** (`/api/admin/reset-listings/route.ts`): Uses weak secret instead of role
3. **Future Arbitration**: Referenced in comments but never implemented

**Recommendation**: Implement a proper admin role:
```prisma
model User {
  // Add these fields
  role            UserRole  @default(USER)
}

enum UserRole {
  USER
  MODERATOR
  ADMIN
}
```

---

### 2.3 HIGH: Collaborator "PARTNER" Role Has Elevated Permissions Without Enforcement

**File**: `/Users/dasherxd/Desktop/App-Market/prisma/schema.prisma`

```prisma
enum CollaboratorRole {
  PARTNER       // Co-founders, core developers - can edit listing
  COLLABORATOR  // Supporting contributors - cannot edit listing
}

model ListingCollaborator {
  canEdit           Boolean             @default(false) // Partners can edit
```

**Issue**: While the schema defines that PARTNER role users "can edit listing", there is no enforcement in the listing update endpoint:

**File**: `/Users/dasherxd/Desktop/App-Market/app/api/listings/[slug]/route.ts` (Lines 124-188)

```typescript
export async function PUT(...) {
  // Check ownership
  if (listing.sellerId !== userId) {
    return NextResponse.json(
      { error: "You can only edit your own listings" },
      { status: 403 }
    );
  }
  // NO CHECK for collaborators with canEdit=true
```

**Impact**: PARTNER collaborators cannot edit listings despite schema claiming they can.

**Recommendation**: Update the PUT handler to also allow users where `ListingCollaborator.canEdit === true`.

---

## 3. Resource Ownership Verification

### 3.1 Listing Ownership - SECURE

**File**: `/Users/dasherxd/Desktop/App-Market/app/api/listings/[slug]/route.ts`

```typescript
// PUT - Update listing
if (listing.sellerId !== userId) {
  return NextResponse.json(
    { error: "You can only edit your own listings" },
    { status: 403 }
  );
}
```

**Status**: Properly implemented for update operations.

---

### 3.2 Transaction Access Control - SECURE

**File**: `/Users/dasherxd/Desktop/App-Market/app/api/transactions/[id]/confirm/route.ts`

```typescript
// Check authorization
const isBuyer = transaction.buyerId === session.user.id;
const isSeller = transaction.sellerId === session.user.id;

if (!isBuyer && !isSeller) {
  return NextResponse.json(
    { error: "Not authorized for this transaction" },
    { status: 403 }
  );
}
```

**Status**: Properly implemented across transaction endpoints.

---

### 3.3 Transfer Access Control - SECURE

**File**: `/Users/dasherxd/Desktop/App-Market/app/api/transfers/[id]/route.ts`

```typescript
// Check if user is a purchase partner
const userPartner = transaction.partners.find(p => p.userId === session.user.id);
const isPartner = !!userPartner;

// Only buyer, seller, or partners can view
if (transaction.buyerId !== session.user.id && transaction.sellerId !== session.user.id && !isPartner) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

**Status**: Properly includes purchase partners in access control.

---

### 3.4 Message/Conversation Access - SECURE

**File**: `/Users/dasherxd/Desktop/App-Market/app/api/messages/[conversationId]/route.ts`

```typescript
if (
  conversation.participant1Id !== userId &&
  conversation.participant2Id !== userId
) {
  return NextResponse.json(
    { error: "Not authorized to view this conversation" },
    { status: 403 }
  );
}
```

**Status**: Properly restricts to conversation participants only.

---

### 3.5 Offer Access Control - SECURE

**File**: `/Users/dasherxd/Desktop/App-Market/app/api/offers/[offerId]/accept/route.ts`

```typescript
// Only seller can accept
if (offer.listing.sellerId !== session.user.id) {
  return NextResponse.json(
    { error: 'Only the seller can accept this offer' },
    { status: 403 }
  );
}
```

**File**: `/Users/dasherxd/Desktop/App-Market/app/api/offers/[offerId]/cancel/route.ts`

```typescript
// Only buyer can cancel
if (offer.buyerId !== session.user.id) {
  return NextResponse.json(
    { error: 'Only the buyer can cancel this offer' },
    { status: 403 }
  );
}
```

**Status**: Properly separates buyer vs seller actions.

---

### 3.6 Withdrawal Ownership - SECURE

**File**: `/Users/dasherxd/Desktop/App-Market/app/api/withdrawals/[withdrawalId]/claim/route.ts`

```typescript
// Only owner can claim
if (withdrawal.userId !== session.user.id) {
  return NextResponse.json(
    { error: 'Not authorized to claim this withdrawal' },
    { status: 403 }
  );
}
```

**Status**: Properly implemented.

---

## 4. Cross-User Access Controls

### 4.1 Partner Access to Transactions - SECURE

Partners are properly included in access checks:

```typescript
// File: /app/api/transactions/[id]/partners/route.ts
const isParticipant =
  transaction.buyerId === session.user.id ||
  transaction.sellerId === session.user.id ||
  transaction.partners.some(p => p.userId === session.user.id);
```

Partners are granted appropriate buyer-equivalent access for transfer confirmations.

---

### 4.2 Collaborator Access to Listings - PARTIALLY SECURE

**Secure**: Collaborator invitation acceptance/decline is properly restricted:

```typescript
// File: /app/api/collaborators/[id]/respond/route.ts
const isCollaborator =
  (collaborator.userId && collaborator.userId === userId) ||
  (currentUser?.walletAddress &&
   collaborator.walletAddress.toLowerCase() === currentUser.walletAddress.toLowerCase());

if (!isCollaborator) {
  return NextResponse.json(
    { error: "You are not authorized to respond to this invitation" },
    { status: 403 }
  );
}
```

**Gap**: As noted above, collaborator viewing of invite details is not restricted.

---

### 4.3 Lead Buyer Transfer of Authority - SECURE

**File**: `/Users/dasherxd/Desktop/App-Market/app/api/transactions/[id]/partners/route.ts`

```typescript
// Only lead buyer can add/remove/update partners
const leadPartner = transaction.partners.find(p => p.isLead);
const isLeadBuyer = leadPartner
  ? leadPartner.userId === session.user.id
  : transaction.buyerId === session.user.id;

if (!isLeadBuyer) {
  return NextResponse.json({ error: "Only the lead buyer can add partners" }, { status: 403 });
}
```

**Status**: Lead buyer authority is properly enforced for partner management.

---

## 5. State-Based Access Control

### 5.1 Listing State Transitions - SECURE

**Cancellation restricted to ACTIVE listings**:
```typescript
// File: /app/api/listings/[slug]/cancel/route.ts
if (listing.status !== "ACTIVE") {
  return NextResponse.json(
    { error: "Only active listings can be cancelled" },
    { status: 400 }
  );
}
```

**Bidding restricted to ACTIVE listings**:
```typescript
// File: /app/api/bids/route.ts
if (listing.status !== "ACTIVE") {
  return NextResponse.json({ error: "Listing is not active" }, { status: 400 });
}
```

---

### 5.2 Transaction State Transitions - SECURE

**Disputes restricted to specific states**:
```typescript
// File: /app/api/disputes/route.ts
const validStatuses = ["IN_ESCROW", "TRANSFER_PENDING", "TRANSFER_IN_PROGRESS", "AWAITING_CONFIRMATION"];
if (!validStatuses.includes(transaction.status)) {
  return NextResponse.json(
    { error: "Cannot dispute a transaction in this status" },
    { status: 400 }
  );
}
```

---

### 5.3 Offer State Transitions - SECURE

**Accept only ACTIVE offers**:
```typescript
if (offer.status !== 'ACTIVE') {
  return NextResponse.json({ error: 'Offer is not active' }, { status: 400 });
}
```

**Expiration handled**:
```typescript
if (new Date() > offer.deadline) {
  await prisma.offer.update({
    where: { id: offerId },
    data: { status: 'EXPIRED', expiredAt: new Date() },
  });
  return NextResponse.json({ error: 'Offer has expired' }, { status: 400 });
}
```

---

### 5.4 Partner Deposit State - SECURE

```typescript
// File: /app/api/transactions/[id]/partners/route.ts
// Can only add partners before deposits are complete
if (transaction.status !== "PENDING" && transaction.status !== "AWAITING_PARTNER_DEPOSITS") {
  return NextResponse.json({ error: "Cannot add partners after deposit phase" }, { status: 400 });
}
```

---

## 6. Specific Route Analysis

### 6.1 `/api/listings/[slug]` - PARTIAL

| Method | Auth Required | Ownership Check | State Check | Status |
|--------|---------------|-----------------|-------------|--------|
| GET | No | N/A | N/A | OK (public) |
| PUT | Yes | Yes | No* | PARTIAL |

*Note: PUT allows editing regardless of listing state (could edit SOLD listings).

---

### 6.2 `/api/transactions/[id]/*` - SECURE

| Endpoint | Auth | Ownership | State | Status |
|----------|------|-----------|-------|--------|
| `/confirm` | Yes | Buyer/Seller | Yes | SECURE |
| `/buyer-info` | Yes | Buyer/Seller | Yes | SECURE |
| `/uploads` | Yes | Seller only | Yes | SECURE |
| `/partners/*` | Yes | Lead Buyer | Yes | SECURE |

---

### 6.3 `/api/transfers/[id]/*` - SECURE

| Endpoint | Auth | Ownership | State | Status |
|----------|------|-----------|-------|--------|
| GET | Yes | Buyer/Seller/Partner | No | SECURE |
| `/seller-confirm` | Yes | Seller only | Yes | SECURE |
| `/buyer-confirm` | Yes | Buyer/Partner | Yes | SECURE |
| `/complete` | Yes | Buyer only | Yes | SECURE |

---

### 6.4 `/api/messages/[conversationId]` - SECURE

| Method | Auth | Ownership | Status |
|--------|------|-----------|--------|
| GET | Yes | Participant only | SECURE |
| POST | Yes | Participant only | SECURE |

---

### 6.5 `/api/disputes/[id]` - CRITICAL VULNERABILITY

| Method | Auth | Ownership | Status |
|--------|------|-----------|--------|
| POST (resolve) | Yes | **NONE** | **CRITICAL** |
| PUT (respond) | Yes | Respondent only | SECURE |

---

### 6.6 `/api/users/[username]` - SECURE (Public by design)

| Method | Auth | Note | Status |
|--------|------|------|--------|
| GET | No | Public profile endpoint | OK |

---

### 6.7 `/api/profile/[userId]` - REVIEW NEEDED

| Method | Auth | Note | Status |
|--------|------|------|--------|
| GET | No | Exposes some fields | REVIEW |

---

## 7. Recommendations Summary

### Critical Priority (Fix Immediately)

1. **Add admin role and dispute resolution authorization**
   - Create `UserRole` enum with ADMIN
   - Add admin check to `/api/disputes/[id]` POST handler

2. **Add authentication to purchase partner invite endpoint**
   - Require auth on `/api/purchase-partners/[id]` GET

3. **Restrict collaborator invite viewing**
   - Add ownership check to `/api/collaborators/[id]/respond` GET

4. **Replace admin secret with role-based auth**
   - Remove hardcoded `"devnet-reset-2024"` secret
   - Implement proper admin authentication

### High Priority

5. **Implement collaborator edit permissions**
   - Update `/api/listings/[slug]` PUT to allow PARTNER collaborators

6. **Add listing state checks for editing**
   - Prevent editing of SOLD, CANCELLED, EXPIRED listings

### Medium Priority

7. **Review public profile data exposure**
   - Determine which fields should be owner-only

8. **Add rate limiting to sensitive endpoints**
   - Admin endpoints
   - Authentication endpoints

---

## 8. Conclusion

The codebase demonstrates generally good ownership verification patterns for core marketplace operations (transactions, transfers, messages). However, there are critical gaps in:

1. **Administrative access control** - No admin role exists, leading to missing authorization on dispute resolution
2. **Information disclosure** - Several endpoints expose data without proper authorization
3. **Weak authentication for sensitive operations** - URL-based secret for admin functions

The state-based access controls are well-implemented, preventing users from performing actions in inappropriate transaction/listing states.

**Overall Security Posture**: The application requires immediate attention to the critical vulnerabilities before production deployment. The missing admin role is the highest priority issue as it allows any user to resolve disputes.

---

*Report generated by automated security analysis*
