# Entry Point Analysis Report

## App-Market: Next.js Marketplace with Solana Smart Contract Integration

**Analysis Date:** 2026-01-31
**Codebase Location:** `/Users/dasherxd/Desktop/App-Market`

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Solana Program Entry Points](#solana-program-entry-points)
3. [Next.js API Entry Points](#nextjs-api-entry-points)
4. [Authentication Patterns](#authentication-patterns)
5. [Access Control Matrix](#access-control-matrix)
6. [Security Observations](#security-observations)

---

## Executive Summary

This codebase implements a **digital project marketplace** where users can list, bid on, and purchase digital projects (apps, SaaS, etc.). The system consists of:

- **Solana Smart Contract** (`programs/app-market/src/lib.rs`): Handles on-chain escrow, bidding, offers, and dispute resolution with ~30 state-changing instructions
- **Next.js API Routes** (`app/api/`): ~70 API endpoints handling authentication, listings, transactions, messaging, and administrative functions

### Entry Point Summary

| Category | Count | State-Changing |
|----------|-------|----------------|
| Solana Instructions | 30 | 30 |
| API Routes (POST) | 35+ | 35+ |
| API Routes (PUT/PATCH) | 10+ | 10+ |
| API Routes (DELETE) | 5+ | 5+ |
| Webhook Endpoints | 1 | 1 |
| Cron Endpoints | 2 | 2 |

---

## Solana Program Entry Points

**File:** `/Users/dasherxd/Desktop/App-Market/programs/app-market/src/lib.rs`
**Program ID:** `9udUgupraga6dj92zfLec8bAdXUZsU3FGNN3Lf8XGzog`

### Admin-Only Instructions (Requires EXPECTED_ADMIN or config.admin)

| Instruction | Access Level | Description | Security Notes |
|-------------|-------------|-------------|----------------|
| `initialize` | Admin (EXPECTED_ADMIN only) | One-time marketplace config setup | Hardcoded admin check prevents frontrunning |
| `propose_treasury_change` | Admin | Step 1 of treasury change (48hr timelock) | Timelock protection |
| `execute_treasury_change` | Admin | Step 2 of treasury change | Requires timelock expiry |
| `propose_admin_change` | Admin | Step 1 of admin change (48hr timelock) | Timelock protection |
| `execute_admin_change` | Admin | Step 2 of admin change | Requires timelock expiry |
| `set_paused` | Admin | Emergency pause/unpause contract | No timelock for emergencies |
| `propose_dispute_resolution` | Admin | Propose dispute outcome (48hr timelock) | Parties can contest |
| `admin_emergency_verify` | Admin | Emergency verification after 30-day timeout | Same timeout as buyer |

### Backend Authority Instructions

| Instruction | Access Level | Description | Security Notes |
|-------------|-------------|-------------|----------------|
| `verify_uploads` | Backend Authority | Verify seller's upload proofs | Only backend_authority from config |

### Seller-Only Instructions

| Instruction | Access Level | Description | Security Notes |
|-------------|-------------|-------------|----------------|
| `create_listing` | Any User (becomes Seller) | Create new listing with escrow | Validates GitHub username, duration limits |
| `cancel_auction` | Seller | Cancel auction without bids | Only if no bids received |
| `seller_confirm_transfer` | Seller | Confirm asset transfer complete | Requires IN_ESCROW status |
| `finalize_transaction` | Seller | Release funds after grace period | Requires verified uploads + 7-day grace |
| `accept_offer` | Seller | Accept buyer's offer | Closes listing, creates transaction |

### Buyer-Only Instructions

| Instruction | Access Level | Description | Security Notes |
|-------------|-------------|-------------|----------------|
| `place_bid` | Any User (not Seller) | Place auction bid | Min increment 5%, anti-sniping protection |
| `buy_now` | Any User (not Seller) | Instant purchase | Seller cannot buy own listing |
| `make_offer` | Any User (not Seller) | Submit offer with deadline | Max 10 consecutive offers per buyer |
| `cancel_offer` | Offer Owner | Cancel active offer, get refund | Only buyer can cancel their offer |
| `confirm_receipt` | Buyer | Confirm assets received, release escrow | Requires verified uploads |
| `emergency_auto_verify` | Buyer | Emergency verify after 30-day timeout | Fallback if backend unresponsive |

### Public Instructions (Any Signer)

| Instruction | Access Level | Description | Security Notes |
|-------------|-------------|-------------|----------------|
| `withdraw_funds` | Withdrawal Owner | Claim pending bid refund | Pull pattern for refunds |
| `settle_auction` | Seller/Winner/Admin | Settle ended auction | Creates transaction record |
| `expire_listing` | Any | Mark expired listing | Only if no bids |
| `expire_offer` | Offer Owner | Expire offer after deadline | Only buyer can expire their offer |

### Dispute Instructions

| Instruction | Access Level | Description | Security Notes |
|-------------|-------------|-------------|----------------|
| `open_dispute` | Buyer or Seller | Open dispute on transaction | Requires dispute fee, 7-day deadline |
| `contest_dispute_resolution` | Buyer or Seller | Contest admin's proposed resolution | Within 48hr window |
| `execute_dispute_resolution` | Any | Execute uncontested resolution | After 48hr timelock |

---

## Next.js API Entry Points

### Authentication Endpoints

| Endpoint | Methods | Access | Description |
|----------|---------|--------|-------------|
| `/api/auth/[...nextauth]` | GET, POST | Public | NextAuth handler |
| `/api/auth/register` | POST | Public | Email/password registration |
| `/api/auth/wallet/verify` | POST | Public | Solana wallet signature verification |
| `/api/auth/privy/callback` | POST | Public | Privy OAuth callback, creates/updates users |
| `/api/auth/twitter/connect` | GET | Authenticated | Initiate Twitter OAuth |
| `/api/auth/twitter/callback` | GET | Public | Twitter OAuth callback |
| `/api/auth/twitter/disconnect` | POST | Authenticated | Disconnect Twitter account |

### Listing Endpoints

| Endpoint | Methods | Access | Description |
|----------|---------|--------|-------------|
| `/api/listings` | GET | Public | List all active listings with filters |
| `/api/listings` | POST | Authenticated | Create new listing |
| `/api/listings/[slug]` | GET | Public | Get single listing details |
| `/api/listings/[slug]` | PUT | Authenticated (Owner) | Update listing (title, tagline, description) |
| `/api/listings/[slug]/cancel` | POST | Authenticated (Owner) | Cancel listing (no bids only) |
| `/api/listings/[slug]/reserve` | POST | Authenticated (Owner) | Reserve listing for specific buyer |
| `/api/listings/[slug]/reserve` | DELETE | Authenticated (Owner) | Remove reservation |
| `/api/listings/[slug]/collaborators` | GET, POST | Authenticated | Manage listing collaborators |
| `/api/listings/[slug]/required-info` | GET, POST | Authenticated | Manage required buyer info |
| `/api/listings/[slug]/purchase-partners` | GET, POST | Authenticated | Manage purchase partners |
| `/api/listings/reserved` | GET | Authenticated | Get listings reserved for user |

### Bidding Endpoints

| Endpoint | Methods | Access | Description |
|----------|---------|--------|-------------|
| `/api/bids` | GET | Public | Get bids for a listing |
| `/api/bids` | POST | Authenticated | Place a bid |

### Offer Endpoints

| Endpoint | Methods | Access | Description |
|----------|---------|--------|-------------|
| `/api/offers` | GET | Authenticated | Get user's offers |
| `/api/offers` | POST | Authenticated | Create offer on listing |
| `/api/offers/[offerId]/accept` | POST | Authenticated (Seller) | Accept an offer |
| `/api/offers/[offerId]/cancel` | POST | Authenticated (Buyer) | Cancel own offer |
| `/api/offers/listing/[listingId]` | GET | Public | Get offers for a listing |

### Transaction Endpoints

| Endpoint | Methods | Access | Description |
|----------|---------|--------|-------------|
| `/api/transactions` | GET | Authenticated | Get user's transactions |
| `/api/transactions` | POST | Authenticated | Create transaction (buy now/auction win) |
| `/api/transactions/[id]/confirm` | POST | Authenticated (Buyer/Seller) | Confirm transfer item |
| `/api/transactions/[id]/buyer-info` | GET | Authenticated (Buyer/Seller) | Get buyer info status |
| `/api/transactions/[id]/buyer-info` | POST | Authenticated (Buyer) | Submit required buyer info |
| `/api/transactions/[id]/uploads` | POST | Authenticated (Seller) | Upload transfer evidence |
| `/api/transactions/[id]/partners` | GET, POST | Authenticated | Manage purchase partners |
| `/api/transactions/[id]/partners/[partnerId]/deposit` | POST | Authenticated (Partner) | Submit partner deposit |
| `/api/transactions/[id]/partners/[partnerId]/transfer-lead` | POST | Authenticated (Lead Partner) | Transfer lead role |

### Transfer Endpoints

| Endpoint | Methods | Access | Description |
|----------|---------|--------|-------------|
| `/api/transfers/[id]` | GET | Authenticated (Buyer/Seller) | Get transfer details |
| `/api/transfers/[id]/complete` | POST | Authenticated (Buyer) | Complete transfer, release escrow |
| `/api/transfers/[id]/seller-confirm` | POST | Authenticated (Seller) | Seller confirms item transferred |
| `/api/transfers/[id]/buyer-confirm` | POST | Authenticated (Buyer) | Buyer confirms item received |
| `/api/transfers/[id]/fallback` | POST | Authenticated | Initiate fallback transfer process |

### Dispute Endpoints

| Endpoint | Methods | Access | Description |
|----------|---------|--------|-------------|
| `/api/disputes` | GET | Authenticated | Get user's disputes |
| `/api/disputes` | POST | Authenticated (Buyer/Seller) | Open a dispute |
| `/api/disputes/[id]` | POST | Authenticated (Admin) | Resolve dispute |
| `/api/disputes/[id]` | PUT | Authenticated (Respondent) | Respond to dispute |

### Withdrawal Endpoints

| Endpoint | Methods | Access | Description |
|----------|---------|--------|-------------|
| `/api/withdrawals` | GET | Authenticated | Get pending withdrawals |
| `/api/withdrawals/[withdrawalId]/claim` | POST | Authenticated (Owner) | Claim pending withdrawal |

### User/Profile Endpoints

| Endpoint | Methods | Access | Description |
|----------|---------|--------|-------------|
| `/api/profile` | GET | Authenticated | Get current user's profile |
| `/api/profile` | PUT | Authenticated | Update profile |
| `/api/profile/[userId]` | GET | Public | Get user's public profile |
| `/api/profile/upload-picture` | POST | Authenticated | Upload profile picture |
| `/api/user/profile` | GET | Authenticated | Get user profile |
| `/api/user/profile/image` | POST | Authenticated | Upload profile image |
| `/api/user/stats` | GET | Authenticated | Get user statistics |
| `/api/users/[username]` | GET | Public | Get user by username |
| `/api/users/lookup` | GET | Public | Lookup user by wallet address |

### Messaging Endpoints

| Endpoint | Methods | Access | Description |
|----------|---------|--------|-------------|
| `/api/messages` | GET | Authenticated | Get user's conversations |
| `/api/messages` | POST | Authenticated | Send new message (create conversation) |
| `/api/messages/[conversationId]` | GET | Authenticated (Participant) | Get conversation messages |
| `/api/messages/[conversationId]` | POST | Authenticated (Participant) | Send message in conversation |

### Notification Endpoints

| Endpoint | Methods | Access | Description |
|----------|---------|--------|-------------|
| `/api/notifications` | GET | Authenticated | Get user's notifications |
| `/api/notifications` | PATCH | Authenticated | Mark notifications as read |

### Review Endpoints

| Endpoint | Methods | Access | Description |
|----------|---------|--------|-------------|
| `/api/reviews` | GET | Public | Get reviews for a user |
| `/api/reviews` | POST | Authenticated (Twitter linked) | Submit a review |
| `/api/reviews/can-review` | GET | Authenticated | Check if user can review |

### Watchlist Endpoints

| Endpoint | Methods | Access | Description |
|----------|---------|--------|-------------|
| `/api/watchlist` | GET | Authenticated | Get user's watchlist |
| `/api/watchlist` | POST | Authenticated | Add listing to watchlist |
| `/api/watchlist` | DELETE | Authenticated | Remove from watchlist |

### Collaborator Endpoints

| Endpoint | Methods | Access | Description |
|----------|---------|--------|-------------|
| `/api/collaborators/[id]/respond` | GET | Authenticated | Get collaboration invite details |
| `/api/collaborators/[id]/respond` | POST | Authenticated (Invitee) | Accept/decline collaboration |
| `/api/collaborators/invites` | GET | Authenticated | Get pending invites |

### Purchase Partner Endpoints

| Endpoint | Methods | Access | Description |
|----------|---------|--------|-------------|
| `/api/purchase-partners/[id]` | GET, DELETE | Authenticated | Manage purchase partner |
| `/api/purchase-partners/invites` | GET | Authenticated | Get purchase partner invites |

### Payment Endpoints

| Endpoint | Methods | Access | Description |
|----------|---------|--------|-------------|
| `/api/payments/create-intent` | POST | Authenticated | Create Stripe payment intent |
| `/api/webhooks/stripe` | POST | Public (Signature Verified) | Stripe webhook handler |

### Referral Endpoints

| Endpoint | Methods | Access | Description |
|----------|---------|--------|-------------|
| `/api/referrals` | GET | Authenticated | Get referral info |
| `/api/referrals` | PATCH | Authenticated | Update referral code (one-time) |

### Token Launch Endpoints

| Endpoint | Methods | Access | Description |
|----------|---------|--------|-------------|
| `/api/token-launch` | GET | Public | Get token launches |
| `/api/token-launch` | POST | Authenticated (Project Owner) | Launch token for acquired project |

### Miscellaneous Endpoints

| Endpoint | Methods | Access | Description |
|----------|---------|--------|-------------|
| `/api/github/verify` | POST | Authenticated | Verify GitHub repository |
| `/api/categories` | GET | Public | Get listing categories |
| `/api/stats` | GET | Public | Get platform statistics |
| `/api/purchases` | GET | Authenticated | Get user's purchases |
| `/api/og` | GET | Public | Open Graph image generation |

### Admin Endpoints

| Endpoint | Methods | Access | Description |
|----------|---------|--------|-------------|
| `/api/admin/reset-listings` | DELETE | Admin (Secret + Auth) | Reset/delete listings |

### Cron Endpoints

| Endpoint | Methods | Access | Description |
|----------|---------|--------|-------------|
| `/api/cron/buyer-info-deadlines` | POST | Cron (Secret) | Process buyer info deadlines |
| `/api/cron/check-partner-deposits` | POST | Cron (Secret) | Check partner deposit status |

### Debug/Test Endpoints

| Endpoint | Methods | Access | Description |
|----------|---------|--------|-------------|
| `/api/debug/db-test` | GET | Public | Database connectivity test |
| `/api/test-session` | GET | Public | Session test endpoint |

---

## Authentication Patterns

### 1. JWT-Based Authentication (`getAuthToken`)
Used by most API routes for authenticated operations:
```typescript
const token = await getAuthToken(request);
if (!token?.id) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

### 2. NextAuth Session (`getServerSession`)
Alternative authentication method using NextAuth:
```typescript
const session = await getServerSession(authOptions);
if (!session?.user?.id) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

### 3. Privy Token Verification
For Privy-authenticated users:
```typescript
const claims = await verifyPrivyToken(accessToken);
```

### 4. Wallet Signature Verification
For wallet-based authentication:
```typescript
const result = await verifyWalletSignature(publicKey, signature, message);
```

### 5. Secret-Based Authentication (Cron/Admin)
For system endpoints:
```typescript
if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

### 6. Stripe Webhook Signature Verification
For payment webhooks:
```typescript
event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
```

---

## Access Control Matrix

| Role | Solana Program | API Endpoints |
|------|---------------|---------------|
| **Public** | None | GET endpoints for listings, profiles, categories, stats |
| **Authenticated User** | place_bid, buy_now, make_offer, create_listing | All CRUD on own resources |
| **Listing Owner (Seller)** | cancel_auction, seller_confirm_transfer, finalize_transaction, accept_offer | Update/cancel own listings, manage collaborators |
| **Transaction Buyer** | confirm_receipt, emergency_auto_verify | Complete transfers, submit buyer info |
| **Transaction Seller** | seller_confirm_transfer, finalize_transaction | Confirm transfers, upload evidence |
| **Dispute Party** | open_dispute, contest_dispute_resolution | Create/respond to disputes |
| **Offer Owner** | cancel_offer, expire_offer | Cancel own offers |
| **Withdrawal Owner** | withdraw_funds | Claim pending withdrawals |
| **Backend Authority** | verify_uploads | N/A (server-side only) |
| **Admin** | All admin functions (with timelock) | Reset listings, resolve disputes |
| **Cron Service** | N/A | Process deadlines, check deposits |

---

## Security Observations

### Solana Program Security Features

1. **Timelock Protection**: Admin-sensitive operations (treasury change, admin change, dispute resolution) require 48-hour timelock
2. **Hardcoded Admin Check**: `initialize` requires `EXPECTED_ADMIN` pubkey to prevent frontrunning
3. **Anti-Sniping Protection**: 15-minute extension window when bids placed near auction end
4. **DoS Prevention**:
   - Max 1000 bids per listing
   - Max 100 offers per listing
   - Max 10 consecutive offers/bids per user
5. **Fee Locking**: Platform fees locked at listing creation time
6. **Withdrawal Pattern**: Pull-based refunds prevent reentrancy
7. **Math Overflow Protection**: All arithmetic uses checked_add/checked_sub/checked_mul
8. **Pause Mechanism**: Admin can pause contract in emergencies
9. **Backend Timeout Fallback**: 30-day emergency verification if backend unresponsive
10. **Dispute Contestation**: Parties can contest proposed resolutions within 48 hours

### API Security Patterns

1. **Consistent Auth Checks**: All state-changing endpoints require authentication
2. **Owner Verification**: Operations verify resource ownership before modifications
3. **Rate Limiting**: Max consecutive offers limit (429 response)
4. **Input Validation**: Zod schemas for request validation
5. **Transaction Participants**: Only buyer/seller can access transaction details
6. **Review Requirements**: Twitter verification required to leave reviews
7. **Webhook Signature Verification**: Stripe webhooks verified via signature
8. **Cron Secret Protection**: Cron endpoints require bearer token

### Potential Audit Focus Areas

1. **Admin Secret in Environment**: `ADMIN_SECRET` should be rotated regularly
2. **Dispute Resolution**: Admin can resolve disputes; timelock provides some protection
3. **Cron Endpoints**: Authenticated via bearer token, should be restricted by IP in production
4. **Stripe Payment Flow**: Verify payment intent metadata cannot be tampered
5. **Privy Callback**: User creation/linking should prevent account takeover
6. **Collaborator Invites**: Wallet address matching is case-insensitive
7. **Token Launch**: Placeholder implementation, needs full security review when completed

---

## File References

### Solana Program
- `/Users/dasherxd/Desktop/App-Market/programs/app-market/src/lib.rs`

### Key API Route Files
- `/Users/dasherxd/Desktop/App-Market/app/api/auth/` - Authentication endpoints
- `/Users/dasherxd/Desktop/App-Market/app/api/listings/` - Listing management
- `/Users/dasherxd/Desktop/App-Market/app/api/transactions/` - Transaction handling
- `/Users/dasherxd/Desktop/App-Market/app/api/transfers/` - Transfer completion
- `/Users/dasherxd/Desktop/App-Market/app/api/disputes/` - Dispute resolution
- `/Users/dasherxd/Desktop/App-Market/app/api/offers/` - Offer management
- `/Users/dasherxd/Desktop/App-Market/app/api/bids/` - Bidding
- `/Users/dasherxd/Desktop/App-Market/app/api/admin/` - Admin operations
- `/Users/dasherxd/Desktop/App-Market/app/api/webhooks/` - Payment webhooks
- `/Users/dasherxd/Desktop/App-Market/app/api/cron/` - Scheduled jobs

---

*Report generated by entry-point-analyzer skill*
