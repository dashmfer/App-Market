# Entry Points Audit -- App-Market

**Date:** 2026-03-05
**Scope:** All state-changing and read entry points across Next.js API routes and Solana on-chain program.

---

## 1. Next.js API Routes (`app/api/**`)

### Legend

| Tag | Meaning |
|-----|---------|
| **PUBLIC** | No authentication required |
| **AUTHENTICATED** | Requires session (via `getAuthToken` JWT or `getServerSession`) |
| **ADMIN** | Requires session + `isAdmin` flag on user record |
| **CRON** | Requires `Authorization: Bearer <CRON_SECRET>` (timing-safe comparison via `verifyCronSecret`) |
| **AGENT** | Requires API key via `authenticateAgent` (agent/bot auth) |
| **WEBHOOK** | Requires `Authorization: Bearer <WEBHOOK_SECRET>` (timing-safe comparison) |

---

### 1.1 Auth Routes

| Route | Methods | Auth | Notes |
|-------|---------|------|-------|
| `/api/auth/[...nextauth]` | GET, POST | **PUBLIC** | NextAuth handler. POST is rate-limited against brute-force. |
| `/api/auth/register` | POST | **PUBLIC** | User registration. Rate-limited. |
| `/api/auth/wallet/verify` | POST | **PUBLIC** | Wallet signature verification for sign-in. Rate-limited. |
| `/api/auth/twitter/connect` | GET | **AUTHENTICATED** | Initiates Twitter OAuth flow. Uses `getAuthToken`. |
| `/api/auth/twitter/callback` | GET | **PUBLIC** | Twitter OAuth callback. State validated via encrypted cookie. |
| `/api/auth/twitter/disconnect` | POST | **AUTHENTICATED** | Disconnects Twitter. Uses `getAuthToken`. |

### 1.2 Public / Unauthenticated Read Routes

| Route | Methods | Auth | Notes |
|-------|---------|------|-------|
| `/api/health` | GET | **PUBLIC** | Uptime monitor endpoint. Returns service health status. |
| `/api/csrf` | GET | **PUBLIC** | Returns CSRF token and sets cookie. |
| `/api/sol-price` | GET | **PUBLIC** | Returns current SOL/USD price. |
| `/api/og` | GET | **PUBLIC** | Open Graph image generation (edge runtime). |
| `/api/openapi` | GET | **PUBLIC** | OpenAPI 3.0 spec for the Agent API. |
| `/api/stats` | GET | **PUBLIC** | Platform-wide aggregate statistics. |
| `/api/categories` | GET | **PUBLIC** | Category counts for active listings. |
| `/api/leaderboard` | GET | **PUBLIC** | Top sellers/buyers/rated users. |
| `/api/listings` | GET | **PUBLIC** | Browse listings with filters. No auth required for read. |
| `/api/listings/[slug]` | GET | **PUBLIC** | Single listing detail. Auth optional (enriches with user context). |
| `/api/listings/[slug]/collaborators` | GET | **PUBLIC** | Collaborators for a listing. |
| `/api/listings/[slug]/purchase-partners` | GET | **PUBLIC** | Purchase partners for a listing. |
| `/api/listings/[slug]/nda` | GET | **PUBLIC** | NDA status check. Auth optional (returns signed status if logged in). |
| `/api/bids` | GET | **PUBLIC** | Bids for a listing (by listingId). |
| `/api/offers/listing/[listingId]` | GET | **PUBLIC** | Offers for a listing. |
| `/api/reviews` | GET | **PUBLIC** | Reviews for a user. |
| `/api/reviews/[id]/response` | GET | **PUBLIC** | Seller response to a review. |
| `/api/profile/[userId]` | GET | **PUBLIC** | Public user profile by ID. |
| `/api/users/[username]` | GET | **PUBLIC** | Public user profile by username. Auth optional (enriches context). |
| `/api/users/lookup` | GET, POST | **PUBLIC** | User lookup by wallet/username. Rate-limited to prevent enumeration. |

### 1.3 Authenticated User Routes

| Route | Methods | Auth | Notes |
|-------|---------|------|-------|
| `/api/listings` | POST | **AUTHENTICATED** | Create a new listing. CSRF validated. Rate-limited. |
| `/api/listings/[slug]` | PUT | **AUTHENTICATED** | Update listing. Owner-only via `canEditListing`. |
| `/api/listings/[slug]/cancel` | POST | **AUTHENTICATED** | Cancel listing. Owner-only. |
| `/api/listings/[slug]/reserve` | POST, DELETE | **AUTHENTICATED** | Reserve/unreserve listing for a buyer. |
| `/api/listings/[slug]/nda` | POST | **AUTHENTICATED** | Sign NDA for a listing. |
| `/api/listings/[slug]/required-info` | GET, PATCH | **AUTHENTICATED** | Get/update required info fields (GET is session-gated). |
| `/api/listings/[slug]/collaborators` | POST, DELETE, PATCH | **AUTHENTICATED** | Manage collaborators (owner-only). |
| `/api/listings/reserved` | GET | **AUTHENTICATED** | Get listings reserved for current user. |
| `/api/listings/check-similarity` | POST | **AUTHENTICATED** | Check listing similarity before creation. |
| `/api/bids` | POST | **AUTHENTICATED** | Place a bid. CSRF validated. Rate-limited. |
| `/api/offers` | GET, POST | **AUTHENTICATED** | List own offers / create offer. CSRF validated. Rate-limited. |
| `/api/offers/[offerId]/accept` | POST | **AUTHENTICATED** | Accept an offer (seller-only). |
| `/api/offers/[offerId]/cancel` | POST | **AUTHENTICATED** | Cancel own offer. |
| `/api/purchases` | GET, POST | **AUTHENTICATED** | Purchase history / initiate purchase. |
| `/api/transactions` | GET, POST | **AUTHENTICATED** | Transaction list / create transaction. |
| `/api/transactions/[id]/confirm` | POST | **AUTHENTICATED** | Confirm transaction. |
| `/api/transactions/[id]/buyer-info` | GET, POST | **AUTHENTICATED** | Get/submit buyer information. |
| `/api/transactions/[id]/uploads` | POST | **AUTHENTICATED** | Upload transfer evidence files. |
| `/api/transactions/[id]/agreements` | GET, POST | **AUTHENTICATED** | View/create transaction agreements. |
| `/api/transactions/[id]/partners` | GET, POST, DELETE, PATCH | **AUTHENTICATED** | Manage purchase partners on a transaction. |
| `/api/transactions/[id]/partners/[partnerId]/deposit` | POST | **AUTHENTICATED** | Record partner deposit. |
| `/api/transactions/[id]/partners/[partnerId]/transfer-lead` | POST | **AUTHENTICATED** | Transfer lead partner role. |
| `/api/transfers/[id]` | GET | **AUTHENTICATED** | Get transfer details. |
| `/api/transfers/[id]/seller-confirm` | POST | **AUTHENTICATED** | Seller confirms asset transfer. |
| `/api/transfers/[id]/buyer-confirm` | POST | **AUTHENTICATED** | Buyer confirms receipt. |
| `/api/transfers/[id]/complete` | POST | **AUTHENTICATED** | Complete transfer process. |
| `/api/transfers/[id]/fallback` | POST | **AUTHENTICATED** | Fallback transfer process. |
| `/api/transfers/[id]/request-apa` | POST | **AUTHENTICATED** | Request Asset Purchase Agreement. |
| `/api/transfers/[id]/sign-apa` | POST | **AUTHENTICATED** | Sign APA. |
| `/api/transfers/[id]/request-non-compete` | POST | **AUTHENTICATED** | Request non-compete agreement. |
| `/api/transfers/[id]/sign-non-compete` | POST | **AUTHENTICATED** | Sign non-compete agreement. |
| `/api/disputes` | GET, POST | **AUTHENTICATED** | List disputes / open a dispute. |
| `/api/disputes/[id]` | POST | **ADMIN** | Resolve dispute. Checks `isAdmin`. |
| `/api/disputes/[id]` | PUT | **AUTHENTICATED** | Submit dispute evidence (buyer/seller). |
| `/api/messages` | GET, POST | **AUTHENTICATED** | List conversations / send message. |
| `/api/messages/[conversationId]` | GET, POST | **AUTHENTICATED** | Read conversation / send reply. |
| `/api/notifications` | GET, PATCH | **AUTHENTICATED** | Get notifications / mark as read. |
| `/api/watchlist` | GET, POST, DELETE | **AUTHENTICATED** | Manage watchlist. |
| `/api/reviews` | POST | **AUTHENTICATED** | Submit a review. CSRF validated. Rate-limited. |
| `/api/reviews/can-review` | GET | **AUTHENTICATED** | Check if user can leave a review. |
| `/api/reviews/[id]/response` | POST, PUT | **AUTHENTICATED** | Create/update seller response to review. |
| `/api/reviews/[id]/report` | POST | **AUTHENTICATED** | Report a review. |
| `/api/profile` | GET, PUT | **AUTHENTICATED** | Get/update own profile. |
| `/api/profile/upload-picture` | POST, DELETE | **AUTHENTICATED** | Upload/remove profile picture. |
| `/api/user/profile` | GET, PUT | **AUTHENTICATED** | Alternate profile endpoints (session-based). |
| `/api/user/profile/image` | POST, DELETE | **AUTHENTICATED** | Alternate profile image endpoints (session-based). |
| `/api/user/stats` | GET | **AUTHENTICATED** | Current user statistics. |
| `/api/referrals` | GET, PATCH | **AUTHENTICATED** | Referral info / generate code. |
| `/api/collaborators/invites` | GET | **AUTHENTICATED** | Pending collaborator invites. |
| `/api/collaborators/[id]/respond` | GET, POST | **AUTHENTICATED** | View/respond to collaborator invite. |
| `/api/purchase-partners/invites` | GET | **AUTHENTICATED** | Pending partner invites. |
| `/api/purchase-partners/[id]` | GET | **AUTHENTICATED** | Partner detail. |
| `/api/withdrawals` | GET | **AUTHENTICATED** | List on-chain withdrawal claims. |
| `/api/withdrawals/[withdrawalId]/claim` | POST | **AUTHENTICATED** | Claim withdrawal on-chain. |
| `/api/github/verify` | POST | **AUTHENTICATED** | Verify GitHub repo ownership. |
| `/api/token-launch` | GET, POST | **AUTHENTICATED** | List/create token launches (PATO). |
| `/api/token-launch/[id]` | GET, PATCH | **AUTHENTICATED** | Token launch details / update. |
| `/api/token-launch/deploy` | POST | **AUTHENTICATED** | Deploy token to Solana. |
| `/api/token-launch/claim-fees` | POST | **AUTHENTICATED** | Claim partner fees. Admin-gated for partner fee claims (`isAdmin` check at line 119). |

### 1.4 Admin Routes

| Route | Methods | Auth | Notes |
|-------|---------|------|-------|
| `/api/admin/audit-logs` | GET | **ADMIN** | View audit logs. Session + `isAdmin` check. |
| `/api/admin/reset-listings` | DELETE | **ADMIN** | Reset/delete listings. Session + `isAdmin` check. |
| `/api/admin/similarity-scan` | GET, POST | **ADMIN** | Run/view listing similarity scans. `getAuthToken` + `isAdmin` check. |
| `/api/disputes/[id]` | POST | **ADMIN** | Resolve dispute (session + `isAdmin`). |
| `/api/token-launch/claim-fees` | POST | **ADMIN** | Claim partner fees (admin branch at line 116-119). |

### 1.5 Cron Job Routes

All cron routes use `verifyCronSecret()` with timing-safe `Authorization: Bearer <CRON_SECRET>` validation.

| Route | Methods | Auth | Notes |
|-------|---------|------|-------|
| `/api/cron/escrow-auto-release` | GET | **CRON** | Auto-release escrow after transfer deadline (hourly). |
| `/api/cron/expired-offers` | GET | **CRON** | Expire offers past deadline, trigger on-chain refund (every 10 min). |
| `/api/cron/webhook-retries` | GET | **CRON** | Retry failed webhook deliveries (every 5 min). |
| `/api/cron/seller-transfer-deadline` | GET | **CRON** | Enforce seller transfer deadlines. |
| `/api/cron/buyer-info-deadline` | GET | **CRON** | Enforce buyer info submission deadlines (every 15 min). |
| `/api/cron/partner-deposit-deadline` | GET | **CRON** | Enforce partner deposit deadlines. |
| `/api/cron/expire-withdrawals` | GET | **CRON** | Expire unclaimed on-chain withdrawals. |
| `/api/cron/super-badge-qualification` | GET | **CRON** | Evaluate super-badge eligibility. |
| `/api/cron/check-graduations` | GET | **CRON** | Fallback check for token graduation (hourly). |

### 1.6 Webhook Endpoints

| Route | Methods | Auth | Notes |
|-------|---------|------|-------|
| `/api/webhooks/pool-graduation` | POST | **WEBHOOK** | Solana pool graduation webhook (Helius/QuickNode). Validates `Authorization: Bearer <WEBHOOK_SECRET>` via timing-safe comparison. |

### 1.7 Agent API Routes

All agent routes authenticate via `authenticateAgent()` which validates an API key (`X-API-Key` header) or wallet signature.

| Route | Methods | Auth | Notes |
|-------|---------|------|-------|
| `/api/agent/listings` | GET | **AGENT** | Browse listings. |
| `/api/agent/listings/[idOrSlug]` | GET | **AGENT** | Single listing detail. |
| `/api/agent/listings/[idOrSlug]/bids` | GET | **AGENT** | Bids for a listing. |
| `/api/agent/listings/[idOrSlug]/offers` | GET | **AGENT** | Offers for a listing. |
| `/api/agent/bids` | GET, POST | **AGENT** | List bids / place bid. |
| `/api/agent/bids/[id]` | GET | **AGENT** | Bid detail. |
| `/api/agent/offers` | GET, POST | **AGENT** | List offers / create offer. |
| `/api/agent/offers/[id]` | GET | **AGENT** | Offer detail. |
| `/api/agent/offers/[id]/accept` | POST | **AGENT** | Accept offer. |
| `/api/agent/offers/received` | GET | **AGENT** | Received offers. |
| `/api/agent/transactions` | GET | **AGENT** | List transactions. |
| `/api/agent/transactions/[id]` | GET | **AGENT** | Transaction detail. |
| `/api/agent/transactions/[id]/confirm` | POST | **AGENT** | Confirm transaction. |
| `/api/agent/transactions/[id]/agreements/[agreementId]/sign` | POST | **AGENT** | Sign agreement. |
| `/api/agent/profile` | GET, PATCH | **AGENT** | Get/update agent profile. |
| `/api/agent/watchlist` | GET, POST, DELETE | **AGENT** | Manage watchlist. |
| `/api/agent/watchlist/check` | GET | **AGENT** | Check if item is in watchlist. |
| `/api/agent/webhooks` | GET, POST, DELETE, PATCH | **AGENT** | CRUD agent webhooks. Also accepts session auth (`getAuthToken` fallback). |
| `/api/agent/webhooks/[id]/test` | POST | **AGENT** | Test webhook delivery. |
| `/api/agent/webhooks/[id]/deliveries` | GET | **AGENT** | Webhook delivery history. |
| `/api/agent/keys` | GET, POST, DELETE, PATCH | **AGENT** | Manage API keys. Also accepts session auth (`getAuthToken` fallback). |

---

## 2. Solana Program Instructions (`programs/app-market/src/lib.rs`)

Program ID: `9udUgupraga6dj92zfLec8bAdXUZsU3FGNN3Lf8XGzog`

### Access Control Legend (On-Chain)

| Tag | Meaning |
|-----|---------|
| **ADMIN** | `admin.key() == config.admin` (hardcoded expected admin for `initialize`) |
| **BACKEND** | `backend_authority.key() == config.backend_authority` |
| **SELLER** | `seller.key() == listing.seller` (signer) |
| **BUYER** | `buyer.key() == transaction.buyer` (signer) |
| **BIDDER** | Transaction signer (any wallet, with constraints) |
| **PARTY** | Buyer or seller of the transaction |
| **PERMISSIONLESS** | Anyone can call (with state constraints) |

### 2.1 Admin Instructions

| Instruction | Access Control | Notes |
|-------------|---------------|-------|
| `initialize` | **ADMIN** | One-time setup. `admin.key() == EXPECTED_ADMIN` (hardcoded pubkey). Sets config PDA. |
| `propose_treasury_change` | **ADMIN** | Step 1 of 48hr timelock. `admin.key() == config.admin`. |
| `execute_treasury_change` | **ADMIN** | Step 2 after 48hr timelock expires. |
| `propose_admin_change` | **ADMIN** | Step 1 of admin transfer (48hr timelock). |
| `execute_admin_change` | **ADMIN** | Step 2 of admin transfer after timelock. |
| `set_paused` | **ADMIN** | Emergency pause/unpause. No timelock. |
| `propose_dispute_resolution` | **ADMIN** | Propose resolution with 48hr timelock for parties to contest. |
| `execute_dispute_resolution` | **ADMIN** | Execute resolution after 48hr timelock (blocked if contested). |
| `admin_emergency_verify` | **ADMIN** | Emergency upload verification. Requires 30-day timeout from seller confirmation. |

### 2.2 Backend Authority Instructions

| Instruction | Access Control | Notes |
|-------------|---------------|-------|
| `verify_uploads` | **BACKEND** | Backend service verifies uploaded assets. `backend_authority.key() == config.backend_authority`. |

### 2.3 Seller Instructions

| Instruction | Access Control | Notes |
|-------------|---------------|-------|
| `create_listing` | **SELLER** | Any wallet (signer becomes seller). Checks `!config.paused`. |
| `cancel_auction` | **SELLER** | Only if no bids received. `seller.key() == listing.seller`. |
| `cancel_listing` | **SELLER** | Only if no bids. `seller.key() == listing.seller`. |
| `seller_confirm_transfer` | **SELLER** | Confirms asset transfer. `seller.key() == transaction.seller`. |
| `finalize_transaction` | **SELLER** | Releases escrow after 7-day grace period + upload verification. Seller must be signer. |
| `accept_offer` | **SELLER** | Accepts an active offer. `seller.key() == listing.seller`. |

### 2.4 Buyer Instructions

| Instruction | Access Control | Notes |
|-------------|---------------|-------|
| `buy_now` | **BUYER** | Instant purchase. Any signer except seller. `buyer.key() != listing.seller`. |
| `confirm_receipt` | **BUYER** | Releases escrow to seller. `buyer.key() == transaction.buyer`. Requires uploads verified. |
| `emergency_refund` | **BUYER** | Refund after transfer deadline if seller never confirmed. `buyer.key() == transaction.buyer`. |
| `emergency_auto_verify` | **BUYER** | Emergency upload verification after 30-day backend timeout. `buyer.key() == transaction.buyer`. |

### 2.5 Bidder Instructions

| Instruction | Access Control | Notes |
|-------------|---------------|-------|
| `place_bid` | **BIDDER** | Any signer except seller. Enforces min increment, anti-sniping, consecutive bid limits, DoS caps. |

### 2.6 Offer Instructions

| Instruction | Access Control | Notes |
|-------------|---------------|-------|
| `make_offer` | **BUYER** | Any signer except seller. Funds locked in offer escrow PDA. |
| `cancel_offer` | **BUYER** | `buyer.key() == offer.buyer`. Refunds from offer escrow. |
| `expire_offer` | **BUYER** | `caller.key() == offer.buyer`. Only after deadline. |

### 2.7 Dispute Instructions

| Instruction | Access Control | Notes |
|-------------|---------------|-------|
| `open_dispute` | **PARTY** | Buyer or seller of transaction. Requires dispute fee deposit. |
| `contest_dispute_resolution` | **PARTY** | Buyer or seller. Must be within 48hr timelock window. |

### 2.8 Permissionless Instructions

| Instruction | Access Control | Notes |
|-------------|---------------|-------|
| `settle_auction` | **PERMISSIONLESS** | Restricted to seller, winner, or admin. Called after auction ends. |
| `withdraw_funds` | **PERMISSIONLESS** | Withdrawal owner only (`user.key() == withdrawal.user`). Pull pattern. |
| `expire_withdrawal` | **PERMISSIONLESS** | Anyone can call after expiry. Funds go to original user. |
| `expire_listing` | **PERMISSIONLESS** | Anyone can call after end_time. Only if no bids. |
| `close_escrow` | **PERMISSIONLESS** | Anyone can call once `escrow.amount == 0` and transaction is terminal. Caller gets rent. |

---

## 3. Summary Statistics

| Category | Count |
|----------|-------|
| **API Routes (total unique paths)** | ~95 |
| **PUBLIC routes (no auth)** | ~22 |
| **AUTHENTICATED routes (session/JWT)** | ~55 |
| **ADMIN routes (session + isAdmin)** | 5 |
| **CRON routes (CRON_SECRET)** | 9 |
| **WEBHOOK routes (WEBHOOK_SECRET)** | 1 |
| **AGENT routes (API key / wallet sig)** | ~22 |
| **Solana instructions (total)** | 27 |
| **Solana admin instructions** | 9 |
| **Solana permissionless instructions** | 5 |

---

## 4. Key Security Observations

1. **Auth mechanisms used:**
   - `getAuthToken()` -- JWT-based auth (most routes). Returns decoded token with `id` field.
   - `getServerSession(authOptions)` -- NextAuth session-based auth (older routes, e.g., disputes, token-launch).
   - `authenticateAgent()` -- API key auth for agent/bot endpoints.
   - `verifyCronSecret()` -- Timing-safe CRON_SECRET comparison for all cron routes.
   - Timing-safe `WEBHOOK_SECRET` comparison for the pool-graduation webhook.

2. **CSRF protection:** State-changing authenticated routes validate CSRF tokens via `validateCsrfRequest()`.

3. **Rate limiting:** Applied to auth routes (registration, signin, wallet verify), write operations (bids, offers, listings), and user lookup.

4. **Admin role check pattern:** Admin routes use session auth then query `prisma.user.findUnique({ select: { isAdmin: true } })` -- the admin flag lives in the database, not in the JWT.

5. **On-chain admin controls:** All admin operations use 48-hour timelocks (treasury change, admin change, dispute resolution). Emergency pause has no timelock by design.

6. **Dual auth on agent routes:** `/api/agent/keys` and `/api/agent/webhooks` accept either session auth (`getAuthToken`) or agent auth (`authenticateAgent`), allowing both dashboard and API key access.
