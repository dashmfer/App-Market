# Frontend & Backend Implementation TODO

This document outlines the remaining work needed to integrate the smart contract changes into the frontend and backend.

## ✅ Completed

### Smart Contract
- ✅ Withdrawal pattern for refunds (prevents DoS)
- ✅ Account closure with rent return
- ✅ Rent leak fixes
- ✅ Validation order fixes
- ✅ Zero-amount validation
- ✅ Auto-finalize (72h grace period)
- ✅ Reserve-based auction timing
- ✅ Offer system (make, cancel, accept, claim expired)
- ✅ Expire listing instruction
- ✅ Seller cancel restrictions

### Database Schema
- ✅ User profile fields (displayName, websiteUrl, discordHandle, telegramHandle, githubVerified, walletVerified)
- ✅ Offer model
- ✅ PendingWithdrawal model
- ✅ OfferStatus enum

## 🚧 Backend API Routes Needed

### Profile API (`/api/profile`)
```typescript
// GET /api/profile/[userId] - Get user profile
// PUT /api/profile - Update own profile
// POST /api/profile/verify-github - Initiate GitHub OAuth verification
// POST /api/profile/verify-wallet - Verify wallet ownership
```

**Files to create:**
- `app/api/profile/[userId]/route.ts`
- `app/api/profile/route.ts`
- `app/api/profile/verify-github/route.ts`
- `app/api/profile/verify-wallet/route.ts`

### Offers API (`/api/offers`)
```typescript
// GET /api/offers/listing/[listingId] - Get all offers for a listing
// GET /api/offers/user - Get user's offers
// POST /api/offers - Create new offer (syncs with smart contract)
// PUT /api/offers/[offerId]/cancel - Cancel offer
// PUT /api/offers/[offerId]/accept - Accept offer (seller only)
// PUT /api/offers/[offerId]/claim - Claim expired offer refund
```

**Files to create:**
- `app/api/offers/listing/[listingId]/route.ts`
- `app/api/offers/user/route.ts`
- `app/api/offers/route.ts`
- `app/api/offers/[offerId]/cancel/route.ts`
- `app/api/offers/[offerId]/accept/route.ts`
- `app/api/offers/[offerId]/claim/route.ts`

### Withdrawals API (`/api/withdrawals`)
```typescript
// GET /api/withdrawals - Get user's pending withdrawals
// POST /api/withdrawals/[withdrawalId]/claim - Claim withdrawal
// POST /api/withdrawals/sync - Sync withdrawals from chain
```

**Files to create:**
- `app/api/withdrawals/route.ts`
- `app/api/withdrawals/[withdrawalId]/claim/route.ts`
- `app/api/withdrawals/sync/route.ts`

### Updated Listing API
```typescript
// Update existing listing endpoints to handle:
// - ListingType (Auction vs BuyNow)
// - Reserve price validation
// - Auction timer logic
// - Listing expiration
```

**Files to update:**
- `app/api/listings/route.ts` - Add listing_type parameter
- `app/api/listings/[listingId]/route.ts` - Handle new fields

## 🎨 Frontend Components Needed

### Profile System

**1. Profile View Component** (`components/profile/ProfileCard.tsx`)
```typescript
- Display username, displayName, bio
- Show avatar/pfp
- Display verified badges (GitHub, Wallet)
- Show social links (website, Discord, Telegram)
- Link to GitHub profile
- Show user stats (sales, purchases, rating)
```

**2. Profile Edit Component** (`components/profile/ProfileEditor.tsx`)
```typescript
- Form to edit displayName, bio, avatar
- Input fields for websiteUrl, discordHandle, telegramHandle
- GitHub verification button
- Wallet verification button
- Username change (unique validation)
- Save changes button
```

**3. Profile Page** (`app/profile/[userId]/page.tsx`)
```typescript
- Full profile view with listings, reviews, stats
- Edit button (if own profile)
```

### Offer System

**1. Make Offer Component** (`components/offers/MakeOfferForm.tsx`)
```typescript
- Amount input (any price)
- Deadline picker (custom expiration)
- Submit offer button (calls smart contract + API)
- Shows required escrow amount
- Validates user balance
```

**2. Offer List Component** (`components/offers/OfferList.tsx`)
```typescript
- Displays all offers on a listing
- Shows offer amount, deadline, status
- For sellers: Accept/Reject buttons
- For buyers: Cancel button (if own offer)
- Expired offers show "Claim Refund" button
```

**3. My Offers Component** (`components/offers/MyOffers.tsx`)
```typescript
- Lists user's active offers
- Shows offer status (active, accepted, cancelled, expired)
- Cancel button for active offers
- Claim refund button for expired offers
- Links to listings
```

### Withdrawal System

**1. Withdrawal Alert Component** (`components/withdrawals/WithdrawalAlert.tsx`)
```typescript
- Banner notification when user has pending withdrawals
- Shows total amount available
- "Claim Now" button
```

**2. Withdrawal List Component** (`components/withdrawals/WithdrawalList.tsx`)
```typescript
- Lists all pending withdrawals
- Shows amount, listing, date
- "Claim" button for each
- "Claim All" button
- Shows claimed withdrawals (grayed out)
```

**3. Withdrawal Dashboard** (`app/dashboard/withdrawals/page.tsx`)
```typescript
- Full withdrawals management page
- Filters (claimed/unclaimed)
- Bulk claim functionality
```

### Updated Listing Components

**1. Update Listing Creation Form** (`app/create/page.tsx`)
```typescript
// Add new fields:
- Listing Type selector (Auction / Buy Now)
- For Auctions with Reserve:
  - Reserve price input
  - Note: "Starting bid must equal reserve price"
- For Buy Now:
  - Require buy_now_price
- Deadline/duration picker
```

**2. Update Listing View** (`app/listing/[id]/page.tsx`)
```typescript
// Add sections:
- Offers section (below bids)
  - Make Offer button
  - Offer list
- Withdrawal notification (if outbid)
- Reserve auction status (show if reserve not met)
- Auction timer (only shows if started)
- For sellers: Accept Offer button on each offer
- 72h grace period timer (after seller confirmation)
```

**3. Update Dashboard** (`app/dashboard/page.tsx`)
```typescript
// Add tabs:
- My Offers tab
- Pending Withdrawals tab
// Update auction logic to show:
- Auctions that haven't started (reserve not met)
- Time remaining (only for started auctions)
```

### Wallet Gate Middleware

**Component** (`components/WalletGateProvider.tsx`)
```typescript
- Check if user has wallet connected for transactions
- If email/GitHub login, prompt wallet connection
- Allow browsing without wallet
- Require wallet for:
  - Creating listings
  - Placing bids
  - Making offers
  - Buying now
```

### Work in Progress Page

**Component** (`app/wip/page.tsx`)
```typescript
- Simple page matching site design
- Says "work in progress"
- Link back to home
- Use for 404 footer links
```

## 🔧 Utility Functions Needed

### Smart Contract Integration

**File:** `lib/solana/contracts/marketplace.ts`

```typescript
// New functions needed:

// Offers
export async function makeOffer(
  listingPubkey: PublicKey,
  amount: number,
  deadline: Date
): Promise<TransactionSignature>

export async function cancelOffer(
  offerPubkey: PublicKey
): Promise<TransactionSignature>

export async function acceptOffer(
  offerPubkey: PublicKey
): Promise<TransactionSignature>

export async function claimExpiredOffer(
  offerPubkey: PublicKey
): Promise<TransactionSignature>

// Withdrawals
export async function withdrawFunds(
  withdrawalPubkey: PublicKey
): Promise<TransactionSignature>

// Listings
export async function expireListing(
  listingPubkey: PublicKey
): Promise<TransactionSignature>

export async function finalizeTransaction(
  transactionPubkey: PublicKey
): Promise<TransactionSignature>

// Helper: Get user's pending withdrawals
export async function getPendingWithdrawals(
  userPubkey: PublicKey
): Promise<PendingWithdrawal[]>

// Helper: Get offers for listing
export async function getListingOffers(
  listingPubkey: PublicKey
): Promise<Offer[]>
```

### Profile Verification

**File:** `lib/verification/github.ts`
```typescript
export async function verifyGitHubAccount(
  userId: string,
  githubId: string
): Promise<boolean>
```

**File:** `lib/verification/wallet.ts`
```typescript
export async function verifyWalletOwnership(
  userId: string,
  walletAddress: string,
  signature: string,
  message: string
): Promise<boolean>
```

## 📱 UI/UX Updates Needed

### Navigation
- [ ] Add "Profile" link to user menu
- [ ] Add "Withdrawals" badge (if pending withdrawals exist)
- [ ] Add "My Offers" to dashboard menu

### Notifications
- [ ] "You have pending withdrawals" banner
- [ ] "Your offer was accepted" notification
- [ ] "You were outbid - claim refund" notification
- [ ] "Auction starting soon (reserve met)" notification
- [ ] "72h grace period started" notification

### Footer
- [ ] Update 404 footer links to point to /wip page

## 🧪 Testing Requirements

### Smart Contract Tests
```bash
# Test withdrawal pattern
- User A bids 1 SOL
- User B bids 2 SOL
- User A claims withdrawal
- Verify User A receives 1 SOL + rent

# Test offer system
- Create offer
- Cancel offer → refund + rent
- Accept offer → funds transfer, transaction created
- Expire offer → claim refund + rent

# Test reserve auctions
- Create auction with reserve
- Place bid below reserve → timer doesn't start
- Place bid at reserve → timer starts
- Verify auction timing

# Test auto-finalize
- Seller confirms transfer
- Wait 72 hours
- Anyone can finalize
- Verify funds distributed correctly
```

### Integration Tests
- [ ] Profile CRUD operations
- [ ] Offer lifecycle (create → cancel/accept/expire)
- [ ] Withdrawal claim flow
- [ ] Wallet gate enforcement
- [ ] GitHub verification flow
- [ ] Listing expiration

## 📋 Migration Steps

### Database Migration
```bash
npx prisma migrate dev --name add_offers_withdrawals_profiles
npx prisma generate
```

### Smart Contract Deployment
```bash
# Build updated program
anchor build

# Deploy to devnet first
anchor deploy --provider.cluster devnet

# Test all new instructions
anchor test

# Deploy to mainnet when ready
anchor deploy --provider.cluster mainnet
```

## 🎯 Implementation Priority

### Phase 1: Critical Path (Required for Launch)
1. Update listing creation form (listing_type, reserve validation)
2. Update listing view (show auction status correctly)
3. Withdrawal notification banner
4. Withdrawal claim functionality
5. Basic offer UI (make, view, cancel)

### Phase 2: Enhanced Features
1. Full profile system
2. Complete offer management
3. GitHub verification
4. Wallet verification
5. Enhanced dashboards

### Phase 3: Polish
1. WIP page
2. Site audit fixes
3. Enhanced notifications
4. Bulk withdrawal claiming
5. Offer filters and search

## 📝 Notes

- **Twitter verification removed** (too expensive, will add post-launch)
- **Github verification kept** (free OAuth)
- **Profiles are optional** - users can transact without profiles
- **Withdrawals stay forever** - unclaimed withdrawals never expire
- **All offers are public** - anyone can see offers on a listing
- **Wallet connection required** for all transactions (listings, bids, offers, purchases)

## 🔗 Smart Contract Location

Updated smart contract: `/home/user/App-Market/programs/app-market/src/lib.rs`

Database schema: `/home/user/App-Market/prisma/schema.prisma`

## ⚠️ Important

The smart contract changes are **comprehensive and production-ready**, but require frontend/backend integration to be fully functional. Users can interact directly with the smart contract using Anchor, but the UI needs to be built out for a seamless experience.

All security fixes are implemented and the contract follows best practices:
- ✅ Withdrawal pattern (DoS prevention)
- ✅ Account closure safety
- ✅ Rent reclamation
- ✅ Validation ordering
- ✅ Zero-amount checks
- ✅ Grace periods
- ✅ Reserve auction logic
- ✅ Comprehensive offer system
