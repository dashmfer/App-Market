# App Market - Security Audit Context Report

## Executive Summary

App Market is a Next.js-based marketplace for buying and selling software applications, with cryptocurrency payment support (Solana, USDC) and traditional Stripe payments. The platform uses an escrow-based transaction model with dispute resolution, referral systems, and collaborator revenue sharing.

**Key Technologies:**
- Next.js 14.1.3 with App Router
- Prisma ORM with PostgreSQL
- NextAuth for session management
- Privy for embedded wallet authentication
- Solana blockchain for escrow/payments
- Stripe for fiat payments

---

## 1. Architecture Overview

### 1.1 Module Structure

```
/Users/dasherxd/Desktop/App-Market/
├── app/
│   ├── api/                    # API Routes (all backend logic)
│   │   ├── auth/               # Authentication endpoints
│   │   ├── bids/               # Bidding system
│   │   ├── collaborators/      # Collaborator management
│   │   ├── disputes/           # Dispute handling
│   │   ├── listings/           # Listing CRUD
│   │   ├── messages/           # Messaging system
│   │   ├── notifications/      # Notification system
│   │   ├── offers/             # Offer management
│   │   ├── payments/           # Stripe payment intents
│   │   ├── transactions/       # Transaction management
│   │   ├── transfers/          # Asset transfer workflow
│   │   ├── webhooks/           # Stripe webhooks
│   │   └── withdrawals/        # Fund withdrawals
│   └── [pages]/                # Frontend pages
├── lib/
│   ├── auth.ts                 # NextAuth configuration
│   ├── config.ts               # Platform configuration (fees, etc.)
│   ├── db.ts                   # Prisma client singleton
│   ├── notifications.ts        # Notification helpers
│   ├── privy.ts                # Privy server-side client
│   ├── referral-earnings.ts    # Referral commission logic
│   ├── solana.ts               # Solana constants & helpers
│   ├── solana-contract.ts      # Smart contract interactions
│   └── wallet-verification.ts  # Wallet signature verification
├── hooks/
│   └── useAutoWalletAuth.ts    # Auto-auth on wallet connect
├── components/
│   └── providers/
│       └── WalletAuthProvider.tsx
└── prisma/
    └── schema.prisma           # Database schema
```

### 1.2 Actors

| Actor | Description | Capabilities |
|-------|-------------|--------------|
| **Anonymous User** | Unauthenticated visitor | View public listings, browse categories |
| **Authenticated User** | Logged in via wallet/Privy | Create listings, bid, make offers, buy |
| **Seller** | User with active listings | Manage listings, accept offers, transfer assets |
| **Buyer** | User who purchased a listing | Confirm transfers, open disputes |
| **Collaborator** | User with revenue share on listing | Accept/decline invites, receive payments |
| **Purchase Partner** | Co-buyer sharing purchase | Deposit share, confirm transfers |
| **Admin** | Platform administrator | Resolve disputes, emergency actions |

### 1.3 State Machines

#### Listing Status Flow
```
DRAFT -> PENDING_COLLABORATORS -> ACTIVE -> RESERVED -> SOLD
                                       -> ENDED
                                       -> CANCELLED
                                       -> EXPIRED
```

#### Transaction Status Flow
```
PENDING -> AWAITING_PARTNER_DEPOSITS -> PAID -> IN_ESCROW -> TRANSFER_PENDING
        -> TRANSFER_IN_PROGRESS -> AWAITING_CONFIRMATION -> COMPLETED
                                                         -> DISPUTED -> REFUNDED
                                                                     -> CANCELLED
```

#### Offer Status Flow
```
ACTIVE -> ACCEPTED
       -> CANCELLED
       -> EXPIRED
```

---

## 2. Authentication Flow Analysis

### 2.1 Authentication Methods

**File: `/Users/dasherxd/Desktop/App-Market/lib/auth.ts`**

The application supports two authentication providers:

#### A. Wallet Provider (Direct Solana Wallet)

**Purpose:** Authenticate users via Solana wallet signature verification.

**Inputs:**
- `publicKey`: Solana wallet public key (string)
- `signature`: Base58-encoded signature
- `message`: Message that was signed
- `referralCode`: Optional referral code for new users

**Process:**
1. Validates all required credentials present
2. Calls `verifyWalletSignature()` from `/lib/wallet-verification.ts`
3. Verifies signature using `nacl.sign.detached.verify()`
4. Creates/retrieves user from database
5. Returns user object to NextAuth

**Security-Critical Code:**
```typescript
// lib/wallet-verification.ts lines 44-61
const publicKeyObj = new PublicKey(publicKey);
const signatureUint8 = bs58.decode(signature);
const messageUint8 = new TextEncoder().encode(message);
const publicKeyUint8 = publicKeyObj.toBytes();

const verified = nacl.sign.detached.verify(
  messageUint8,
  signatureUint8,
  publicKeyUint8
);
```

**Invariants:**
- Message must be signed by the private key corresponding to publicKey
- Each wallet address maps to exactly one user account

**Potential Issues:**
1. Message format is not strictly validated (timestamp check missing)
2. No replay protection - same signature could theoretically be reused if message is identical

#### B. Privy Provider (Email/Twitter Users)

**Purpose:** Bridge Privy authentication to NextAuth session.

**File: `/Users/dasherxd/Desktop/App-Market/app/api/auth/privy/callback/route.ts`**

**Inputs:**
- `accessToken`: Privy JWT access token
- `createdWalletAddress`: Optional wallet address passed from client

**Process:**
1. Verifies Privy token via `privyClient.verifyAuthToken()`
2. Fetches full user data from Privy
3. Extracts email, Twitter info, and embedded wallet
4. Creates/updates user in database
5. Links pending collaborator/partner invites to user

**Security-Critical Observation:**
The Privy credentials provider in `lib/auth.ts` (lines 71-105) **trusts the userId without re-verification**:

```typescript
CredentialsProvider({
  id: "privy",
  credentials: {
    userId: { label: "User ID", type: "text" },
    walletAddress: { label: "Wallet Address", type: "text" },
  },
  async authorize(credentials) {
    // Just looks up user by ID - no token verification here
    let user = await prisma.user.findUnique({
      where: { id: credentials.userId },
    });
```

**CRITICAL FINDING:** The Privy callback (`/api/auth/privy/callback`) verifies the token, but the actual NextAuth credentials provider does NOT. If an attacker can call the NextAuth endpoint directly with a forged userId, they could impersonate any user. The flow depends on the frontend properly gating this.

### 2.2 Session Management

**Configuration:**
- Strategy: JWT
- Max Age: 30 days
- Cookie: `__Secure-next-auth.session-token` (production) or `next-auth.session-token` (dev)
- HttpOnly: true
- SameSite: lax
- Secure: true (production)

**Session Callback:**
- Fetches fresh user data from database on each session access
- Enriches session with: `walletAddress`, `username`, `isVerified`, `githubUsername`, `image`

### 2.3 Auto-Wallet Authentication Hook

**File: `/Users/dasherxd/Desktop/App-Market/hooks/useAutoWalletAuth.ts`**

**Purpose:** Automatically authenticate when a Solana wallet connects.

**Process:**
1. Detects wallet connection via `@solana/wallet-adapter-react`
2. Creates authentication message with wallet address and timestamp
3. Requests signature from wallet
4. Calls NextAuth `signIn('wallet', ...)` with credentials
5. Includes referral code from URL params or cookie

**Potential Issue:**
- Message includes timestamp but server doesn't validate timestamp freshness
- 500ms delay before authentication could be race-condition-prone

---

## 3. Payment/Transaction Flow Analysis

### 3.1 Payment Methods

The platform supports three payment methods:

| Method | Implementation | Escrow |
|--------|----------------|--------|
| Solana (SOL) | On-chain escrow via smart contract | On-chain PDA |
| Stripe (USD) | Stripe Payment Intents | Off-chain (database status) |
| USDC | SPL Token transfer | On-chain |

### 3.2 Stripe Payment Flow

**File: `/Users/dasherxd/Desktop/App-Market/app/api/payments/create-intent/route.ts`**

**Purpose:** Create Stripe PaymentIntent for fiat purchases.

**Inputs:**
- `listingId`: Target listing
- `paymentType`: "bid" or "buyNow"
- `bidAmount`: Required for bids

**Process:**
1. Validates user session
2. Fetches listing and validates status
3. Calculates amount based on payment type
4. **HARDCODED SOL/USD conversion rate** (line 81): `const solPriceUsd = 150;`
5. Creates PaymentIntent with metadata

**Critical Issue:**
```typescript
// Line 80-82 - Hardcoded exchange rate
const solPriceUsd = 150; // Placeholder - fetch real price
const amountUsd = amountInSol * solPriceUsd;
```
This creates significant pricing risk if SOL price fluctuates.

### 3.3 Stripe Webhook Handler

**File: `/Users/dasherxd/Desktop/App-Market/app/api/webhooks/stripe/route.ts`**

**Purpose:** Process Stripe payment events.

**Security:**
- Verifies webhook signature using `stripe.webhooks.constructEvent()`
- Requires `STRIPE_WEBHOOK_SECRET` environment variable

**Events Handled:**
- `payment_intent.succeeded`: Creates transaction, updates listing to SOLD
- `payment_intent.payment_failed`: Notifies buyer

**Potential Issue:**
- `handlePaymentSuccess()` updates seller stats even for bids (not just completed sales)
- Line 158-171: Stats are incremented before transfer is complete

### 3.4 Transaction Creation

**File: `/Users/dasherxd/Desktop/App-Market/app/api/transactions/route.ts`**

**POST Handler - Create Transaction:**

**Authorization:**
- Requires authenticated session via `getAuthToken()`
- User ID extracted from JWT

**Validation:**
1. Listing must exist
2. For Buy Now: `buyNowEnabled` must be true and `buyNowPrice` set
3. For Auction: Must be ended and caller must be winning bidder

**Critical Logic (lines 125-151):**
```typescript
if (paymentMethod === "BUY_NOW") {
  if (!listing.buyNowEnabled || !listing.buyNowPrice) {
    return NextResponse.json({ error: "Buy Now not available" }, { status: 400 });
  }
  salePrice = listing.buyNowPrice;
} else {
  // Auction win
  if (listing.status !== "ENDED" && new Date() < listing.endTime) {
    return NextResponse.json({ error: "Auction has not ended yet" }, { status: 400 });
  }
  const winningBid = listing.bids[0];
  if (!winningBid || winningBid.bidderId !== userId) {
    return NextResponse.json({ error: "You did not win this auction" }, { status: 400 });
  }
  salePrice = winningBid.amount;
}
```

**Fee Calculation:**
```typescript
const platformFee = calculatePlatformFee(salePrice, listing.currency);
// 5% for SOL/USDC, 3% for APP token
```

### 3.5 Transfer Completion

**File: `/Users/dasherxd/Desktop/App-Market/app/api/transfers/[id]/complete/route.ts`**

**Purpose:** Buyer confirms all assets received, releases escrow.

**Authorization:**
- Only buyer can complete (line 60-65)

**Validation:**
- All required checklist items must have `sellerConfirmed && buyerConfirmed`
- Transaction must not already be COMPLETED

**Post-Completion Actions:**
1. Updates transaction status to COMPLETED
2. Updates listing status to SOLD
3. Increments seller/buyer stats
4. Processes referral earnings
5. Calculates collaborator payment distribution
6. Creates notifications for all parties

**Collaborator Payment Distribution (lines 153-177):**
```typescript
for (const collab of collaborators) {
  const collaboratorAmount = (sellerProceeds * collab.percentage) / 100;
  collaboratorTotalPercentage += collab.percentage;
  // ...
}
const sellerPercentage = 100 - collaboratorTotalPercentage;
const sellerFinalAmount = (sellerProceeds * sellerPercentage) / 100;
```

**Critical Observation:**
- Payment distribution is calculated but **actual on-chain transfer is TODO** (line 95-103)
- Database status updates happen regardless of on-chain success

---

## 4. Data Model Analysis

### 4.1 Core Entities

**File: `/Users/dasherxd/Desktop/App-Market/prisma/schema.prisma`**

#### User Model (lines 14-103)
| Field | Type | Security Relevance |
|-------|------|-------------------|
| `id` | cuid | Primary identifier |
| `email` | unique, optional | PII |
| `passwordHash` | optional | Not used (wallet auth) |
| `walletAddress` | unique, optional | Primary auth method |
| `githubId` | unique | OAuth identifier |
| `twitterId` | unique | OAuth identifier |
| `referralCode` | unique | Used for referral tracking |
| `referredBy` | userId | Tracks who referred this user |
| `referralEarnings` | Float | Accumulated earnings |

**Multi-Wallet Support:**
```prisma
model UserWallet {
  walletAddress String     @unique
  userId        String
  isPrimary     Boolean    @default(false)
  walletType    WalletType // PRIVY_EMAIL, PRIVY_TWITTER, EXTERNAL
}
```

#### Listing Model (lines 196-294)
- Contains comprehensive metadata about software projects
- Supports reservation system (`reservedBuyerWallet`, `reservedBuyerId`)
- `requiredBuyerInfo` JSON field for seller-defined transfer requirements
- `onChainId` links to Solana program state

#### Transaction Model (lines 423-491)
- Tracks complete purchase lifecycle
- `transferChecklist` JSON stores per-asset confirmation state
- `transferMethods` JSON stores native vs fallback transfer details
- Supports purchase partners via `TransactionPartner` relation

### 4.2 Entity Relationships

```
User 1---* Listing (seller)
User 1---* Bid (bidder)
User 1---* Transaction (buyer/seller)
User 1---* Offer (buyer)
User 1---* Review (author/subject)
User 1---* ListingCollaborator (collaborator)
User 1---* TransactionPartner (partner)
User 1---* Referral (referrer/referred)

Listing 1---* Bid
Listing 1---* Offer
Listing 1---1 Transaction
Listing 1---* ListingCollaborator
Listing 1---* PendingWithdrawal

Transaction 1---1 Dispute
Transaction 1---* Review
Transaction 1---* Upload
Transaction 1---* TransactionPartner
```

### 4.3 Important Enums

```prisma
enum TransactionStatus {
  PENDING
  AWAITING_PARTNER_DEPOSITS
  PAID
  IN_ESCROW
  TRANSFER_PENDING
  TRANSFER_IN_PROGRESS
  AWAITING_CONFIRMATION
  DISPUTED
  COMPLETED
  REFUNDED
  CANCELLED
}

enum DisputeResolution {
  FULL_REFUND
  PARTIAL_REFUND
  RELEASE_TO_SELLER
  EXTEND_DEADLINE
}
```

---

## 5. Trust Boundary Mapping

### 5.1 API Route Authorization Matrix

| Endpoint | Auth Required | Owner Check | Additional Checks |
|----------|---------------|-------------|-------------------|
| `GET /api/listings` | No | No | Public |
| `POST /api/listings` | Yes | N/A (creates) | None |
| `PUT /api/listings/[slug]` | Yes | Yes (seller) | None |
| `POST /api/bids` | Yes | No | Not seller, auction active |
| `POST /api/offers` | Yes | No | Not seller, listing active |
| `POST /api/offers/[id]/accept` | Yes | Yes (seller) | Offer active, not expired |
| `POST /api/transactions` | Yes | No | Various per payment type |
| `POST /api/transactions/[id]/confirm` | Yes | Yes (buyer or seller) | Role-based action |
| `POST /api/transfers/[id]/complete` | Yes | Yes (buyer only) | All items confirmed |
| `POST /api/disputes` | Yes | Yes (buyer or seller) | Valid transaction status |
| `POST /api/disputes/[id]` (resolve) | Yes | **WEAK** | Should be admin-only |
| `POST /api/withdrawals/[id]/claim` | Yes | Yes (owner) | Not already claimed |
| `POST /api/collaborators/[id]/respond` | Yes | Yes (collaborator) | Pending status |

### 5.2 Critical Trust Boundaries

#### 1. Authentication Boundary
- **Entry Points:** `/api/auth/[...nextauth]`, `/api/auth/privy/callback`
- **Trust Source:** Wallet signature, Privy token
- **Risk:** Privy credentials provider trusts userId without re-verification

#### 2. Payment Boundary
- **Entry Points:** `/api/payments/create-intent`, `/api/webhooks/stripe`
- **Trust Source:** Stripe webhook signature, session
- **Risk:** Hardcoded exchange rate, stats updated before transfer complete

#### 3. Escrow Boundary
- **Entry Points:** Solana smart contract, `/api/transfers/[id]/complete`
- **Trust Source:** On-chain state, database state
- **Risk:** Database and on-chain state can desync

#### 4. Dispute Resolution Boundary
- **Entry Points:** `/api/disputes`, `/api/disputes/[id]`
- **Trust Source:** Session (should be admin for resolution)
- **Risk:** No admin check on dispute resolution (TODO comment in code)

### 5.3 Permission Model per Role

| Action | Anonymous | User | Seller | Buyer | Collaborator | Admin |
|--------|-----------|------|--------|-------|--------------|-------|
| View listings | Y | Y | Y | Y | Y | Y |
| Create listing | N | Y | - | - | - | Y |
| Edit own listing | N | N | Y | N | Y (if canEdit) | Y |
| Place bid | N | Y | N (own) | Y | Y | Y |
| Make offer | N | Y | N (own) | Y | Y | Y |
| Accept offer | N | N | Y | N | N | Y |
| Confirm transfer | N | N | Y | Y | N | Y |
| Complete transfer | N | N | N | Y | N | Y |
| Open dispute | N | N | Y | Y | N | Y |
| Resolve dispute | N | N | N | N | N | **Y** |
| Claim withdrawal | N | Y (own) | - | - | - | - |

---

## 6. Security-Critical Paths

### 6.1 Authentication/Session Management

**Critical Files:**
- `/lib/auth.ts` - NextAuth configuration
- `/lib/privy.ts` - Privy server client
- `/lib/wallet-verification.ts` - Signature verification
- `/hooks/useAutoWalletAuth.ts` - Client-side auto-auth
- `/app/api/auth/privy/callback/route.ts` - Privy sync

**Findings:**

1. **[HIGH] Privy Provider Trust Issue**
   - Location: `/lib/auth.ts` lines 71-105
   - The `privy` credentials provider accepts `userId` directly without verifying the Privy token
   - If frontend is compromised, attacker could call signIn with arbitrary userId

2. **[MEDIUM] No Replay Protection**
   - Location: `/lib/wallet-verification.ts`
   - Signed message includes timestamp but server doesn't validate freshness
   - Same signature could be reused

3. **[LOW] Development Secret Fallback**
   - Location: `/lib/auth.ts` line 32
   - Falls back to `"development-secret-change-in-production"` if not set
   - Environment check exists but is defensive

### 6.2 Payment Processing

**Critical Files:**
- `/app/api/payments/create-intent/route.ts`
- `/app/api/webhooks/stripe/route.ts`
- `/lib/solana.ts`
- `/lib/config.ts`

**Findings:**

1. **[HIGH] Hardcoded Exchange Rate**
   - Location: `/app/api/payments/create-intent/route.ts` line 81
   - `const solPriceUsd = 150;` - no oracle integration
   - Could result in significant over/under payment

2. **[MEDIUM] Stats Updated Before Completion**
   - Location: `/app/api/webhooks/stripe/route.ts` lines 158-171
   - Seller stats incremented when payment received, not when transfer complete
   - Could inflate stats for disputed/cancelled transactions

3. **[MEDIUM] No Idempotency Check**
   - Webhook handler doesn't check if payment was already processed
   - Could double-process if webhook is retried

### 6.3 Escrow/Transfer Logic

**Critical Files:**
- `/lib/solana-contract.ts`
- `/app/api/transfers/[id]/complete/route.ts`
- `/app/api/transactions/[id]/confirm/route.ts`

**Findings:**

1. **[HIGH] On-Chain/Off-Chain Desync**
   - Location: `/app/api/transfers/[id]/complete/route.ts` lines 95-113
   - Database status updated without verifying on-chain transaction
   - Comment: `// TODO: Call smart contract to release escrow to seller`

2. **[MEDIUM] No Atomic Transaction**
   - Multiple database updates happen sequentially (not in transaction)
   - Partial failure could leave inconsistent state

3. **[LOW] Transfer Checklist Not Validated**
   - Checklist items can be confirmed by seller/buyer independently
   - No verification of actual asset transfer

### 6.4 User Data Handling

**Critical Files:**
- `/app/api/profile/route.ts`
- `/app/api/user/profile/route.ts`
- `/app/api/messages/route.ts`

**Findings:**

1. **[MEDIUM] Wallet Address Exposure**
   - Full wallet addresses exposed in some API responses
   - Location: `/app/api/listings/[slug]/route.ts` - seller wallet visible

2. **[LOW] Email as Placeholder**
   - Location: `/lib/wallet-verification.ts` line 120
   - `email: \`${publicKey.toLowerCase()}@wallet.placeholder\``
   - Placeholder emails could cause issues if email features are added

### 6.5 Dispute Resolution

**Critical Files:**
- `/app/api/disputes/route.ts`
- `/app/api/disputes/[id]/route.ts`

**Findings:**

1. **[CRITICAL] Missing Admin Authorization**
   - Location: `/app/api/disputes/[id]/route.ts` lines 48-52
   ```typescript
   // For now, only admin can resolve disputes
   // TODO: Add admin check
   ```
   - Currently anyone authenticated can resolve disputes

2. **[MEDIUM] Buyer Deposit Escrow Not Implemented**
   - Schema defines `buyerDepositRequired`, `buyerDepositAmount`
   - Not enforced in dispute creation

---

## 7. Function Documentation

### 7.1 Core Authentication Functions

#### `verifyWalletSignature(publicKey, signature, message, referralCode?)`
**File:** `/lib/wallet-verification.ts`

**Purpose:** Verify Solana wallet signature and create/retrieve user.

**Inputs:**
- `publicKey: string` - Solana public key (base58)
- `signature: string` - Base58-encoded signature
- `message: string` - Signed message
- `referralCode?: string` - Optional referral code for new users

**Outputs:**
```typescript
{
  success: boolean;
  user?: { id, walletAddress, username, email };
  error?: string;
}
```

**Effects:**
- Creates new user if wallet not found
- Creates Referral record if valid referral code provided
- Generates unique referral code for new users

**Assumptions:**
- Message was recently generated (no timestamp validation)
- PublicKey is valid Solana address format

**Dependencies:**
- `@solana/web3.js` PublicKey
- `tweetnacl` for signature verification
- Prisma for database operations

---

#### `verifyPrivyToken(accessToken)`
**File:** `/lib/privy.ts`

**Purpose:** Verify Privy JWT and return claims.

**Inputs:**
- `accessToken: string` - Privy access token

**Outputs:**
- `AuthTokenClaims | null` - Verified claims or null on failure

**Dependencies:**
- `@privy-io/server-auth` PrivyClient

---

### 7.2 Payment Functions

#### `calculatePlatformFee(amount, currency?)`
**File:** `/lib/solana.ts` and `/lib/config.ts`

**Purpose:** Calculate platform fee based on currency.

**Inputs:**
- `amount: number` - Sale price
- `currency?: string` - Currency type (APP gets discount)

**Outputs:**
- `number` - Fee amount

**Logic:**
- APP token: 3% (300 bps)
- Others: 5% (500 bps)

---

#### `calculateSellerProceeds(salePrice, currency?)`
**File:** `/lib/solana.ts`

**Purpose:** Calculate seller's net proceeds after fees.

**Outputs:**
```typescript
{
  fee: number;
  proceeds: number;
  feeBps: number;
}
```

---

### 7.3 Referral Functions

#### `processReferralEarnings(transactionId, salePrice, buyerId, sellerId)`
**File:** `/lib/referral-earnings.ts`

**Purpose:** Calculate and record referral commissions on transaction completion.

**Inputs:**
- `transactionId: string` - Completed transaction ID
- `salePrice: number` - Sale amount
- `buyerId: string` - Buyer's user ID
- `sellerId: string` - Seller's user ID

**Outputs:**
```typescript
{
  buyerReferralEarning: number;
  sellerReferralEarning: number;
  totalReferralPayout: number;
  platformFeeAfterReferrals: number;
}
```

**Logic:**
- Only pays on FIRST transaction for each referred user
- 2% commission rate (from 5% platform fee)
- Both buyer and seller referrers can earn simultaneously

**Effects:**
- Creates ReferralEarning records
- Updates Referral status to ACTIVE
- Increments referrer's `referralEarnings`
- Creates notifications

---

### 7.4 Notification Functions

#### `createNotification(params)`
**File:** `/lib/notifications.ts`

**Purpose:** Create user notification with proper formatting.

**Inputs:**
```typescript
{
  userId: string;
  type: NotificationType;
  title?: string;
  message?: string;
  listingId?: string;
  listingTitle?: string;
  amount?: number;
  data?: any;
}
```

**Effects:**
- Creates Notification record in database
- Auto-generates title/message based on type if not provided

---

## 8. Invariants and Business Rules

### 8.1 Listing Invariants

1. **Unique Slug:** Each listing has a unique, URL-safe slug
2. **Seller Ownership:** Only the seller can edit their listing
3. **Active Status Required:** Bids and offers only allowed on ACTIVE listings
4. **Collaborator Consensus:** Listing stays PENDING_COLLABORATORS until all accept
5. **Reservation Lock:** Reserved listings only purchasable by reserved buyer

### 8.2 Transaction Invariants

1. **Single Transaction per Listing:** `listingId` is unique on Transaction
2. **Buyer/Seller Distinct:** Same user cannot be both buyer and seller
3. **Transfer Before Completion:** All required checklist items must be confirmed
4. **Dispute Window:** Only certain statuses allow dispute creation

### 8.3 Financial Invariants

1. **Fee Calculation:** `salePrice = platformFee + sellerProceeds`
2. **Collaborator Split:** `sum(collaborator.percentage) + seller.percentage = 100`
3. **Referral Cap:** Referral earnings cannot exceed platform fee

### 8.4 Access Control Invariants

1. **Authentication Required:** All write operations require valid session
2. **Ownership Verification:** Users can only modify their own resources
3. **Role-Based Actions:** Certain actions restricted to buyer/seller role
4. **Admin Actions:** Dispute resolution should require admin role (NOT ENFORCED)

---

## 9. Security Recommendations

### 9.1 Critical Priority

1. **Implement Admin Check for Dispute Resolution**
   - Add admin role to User model
   - Verify admin status before allowing dispute resolution

2. **Verify Privy Token in Credentials Provider**
   - Store Privy token in session
   - Re-verify on sensitive operations

3. **Implement Oracle for Exchange Rates**
   - Integrate price feed (Pyth, Chainlink)
   - Add slippage tolerance

### 9.2 High Priority

1. **Add Message Timestamp Validation**
   - Reject signatures older than 5 minutes
   - Include nonce for replay protection

2. **Synchronize On-Chain/Off-Chain State**
   - Verify on-chain transaction before updating database
   - Add reconciliation job

3. **Implement Atomic Database Transactions**
   - Wrap related updates in Prisma transactions
   - Add rollback on failure

### 9.3 Medium Priority

1. **Add Idempotency to Webhooks**
   - Store processed payment intent IDs
   - Check before processing

2. **Rate Limit Sensitive Endpoints**
   - Auth endpoints
   - Bid/offer creation
   - Dispute filing

3. **Sanitize User Input**
   - Validate listing descriptions
   - Sanitize message content

### 9.4 Low Priority

1. **Audit Logging**
   - Log authentication events
   - Log financial transactions
   - Log admin actions

2. **Input Validation Enhancement**
   - Add Zod schemas to all endpoints
   - Validate JSON field structures

---

## 10. Appendix: Environment Variables

| Variable | Purpose | Security Impact |
|----------|---------|-----------------|
| `DATABASE_URL` | PostgreSQL connection | Database access |
| `NEXTAUTH_SECRET` | JWT signing | Session forgery if leaked |
| `PRIVY_APP_SECRET` | Privy server auth | Account takeover if leaked |
| `STRIPE_SECRET_KEY` | Stripe API | Payment manipulation |
| `STRIPE_WEBHOOK_SECRET` | Webhook verification | Fake payment events |
| `NEXT_PUBLIC_PROGRAM_ID` | Solana program address | Wrong escrow if incorrect |
| `NEXT_PUBLIC_TREASURY_WALLET` | Fee recipient | Fee theft if changed |

---

*Report generated: 2026-01-31*
*Codebase analyzed: /Users/dasherxd/Desktop/App-Market*
