/**
 * AppMarket Agent SDK
 *
 * A TypeScript SDK for AI agents and automated systems to interact with the AppMarket API.
 *
 * ## Installation
 *
 * ```bash
 * npm install @appmarket/sdk
 * # or
 * yarn add @appmarket/sdk
 * # or
 * pnpm add @appmarket/sdk
 * ```
 *
 * ## Quick Start
 *
 * ### API Key Authentication
 *
 * ```typescript
 * import { AppMarketClient } from '@appmarket/sdk';
 *
 * const client = new AppMarketClient({
 *   baseUrl: 'https://www.appmrkt.xyz',
 *   auth: {
 *     type: 'api-key',
 *     apiKey: process.env.APPMARKET_API_KEY!
 *   }
 * });
 *
 * // List active listings
 * const listings = await client.listings.list({ status: 'ACTIVE' });
 *
 * // Place a bid
 * const bid = await client.bids.place({
 *   listingId: 'listing_123',
 *   amount: 1500
 * });
 *
 * // Create a webhook
 * const webhook = await client.webhooks.create({
 *   name: 'My Agent Webhook',
 *   url: 'https://my-agent.example.com/webhook',
 *   events: ['BID_OUTBID', 'LISTING_ENDING_SOON']
 * });
 * ```
 *
 * ### Wallet Signature Authentication (Solana)
 *
 * ```typescript
 * import { AppMarketClient } from '@appmarket/sdk';
 * import { Keypair } from '@solana/web3.js';
 * import nacl from 'tweetnacl';
 *
 * const keypair = Keypair.fromSecretKey(/* your secret key *\/);
 *
 * const client = new AppMarketClient({
 *   baseUrl: 'https://www.appmrkt.xyz',
 *   auth: {
 *     type: 'wallet-signature',
 *     walletAddress: keypair.publicKey.toBase58(),
 *     signMessage: async (message) => {
 *       return nacl.sign.detached(message, keypair.secretKey);
 *     }
 *   }
 * });
 * ```
 *
 * ## Webhook Handling
 *
 * ```typescript
 * import { verifyWebhookSignature, parseWebhookPayload, isWebhookStale } from '@appmarket/sdk';
 *
 * app.post('/webhook', async (req, res) => {
 *   const signature = req.headers['x-webhook-signature'] as string;
 *   const payload = JSON.stringify(req.body);
 *
 *   // Verify signature
 *   const isValid = await verifyWebhookSignature(
 *     payload,
 *     signature,
 *     process.env.WEBHOOK_SECRET!
 *   );
 *
 *   if (!isValid) {
 *     return res.status(401).send('Invalid signature');
 *   }
 *
 *   // Parse and validate payload
 *   const event = parseWebhookPayload(req.body);
 *
 *   // Check for replay attacks
 *   if (isWebhookStale(event)) {
 *     return res.status(400).send('Stale webhook');
 *   }
 *
 *   // Handle event
 *   switch (event.type) {
 *     case 'BID_OUTBID':
 *       // React to being outbid
 *       break;
 *     case 'LISTING_ENDING_SOON':
 *       // Listing ending, maybe place final bid
 *       break;
 *   }
 *
 *   res.status(200).send('OK');
 * });
 * ```
 *
 * @module @appmarket/sdk
 */

// Main client
export { AppMarketClient } from "./client";

// Types
export type {
  // Auth
  AuthMethod,
  ApiKeyAuth,
  WalletSignatureAuth,
  AuthConfig,
  AppMarketConfig,
  // Responses
  ApiResponse,
  PaginatedResponse,
  // API Keys
  ApiKey,
  ApiKeyWithSecret,
  ApiKeyPermission,
  CreateApiKeyParams,
  UpdateApiKeyParams,
  // Webhooks
  Webhook,
  WebhookWithSecret,
  WebhookDelivery,
  WebhookPayload,
  WebhookEventType,
  WebhookDeliveryStatus,
  CreateWebhookParams,
  UpdateWebhookParams,
  // Listings
  Listing,
  ListingDetail,
  ListingStatus,
  ListingType,
  ListingFilters,
  // Bids
  Bid,
  PlaceBidParams,
  // Offers
  Offer,
  OfferStatus,
  CreateOfferParams,
  CounterOfferParams,
  // Transactions
  Transaction,
  TransactionDetail,
  TransactionStatus,
  Agreement,
  TransactionEvent,
  // Watchlist
  WatchlistItem,
  // Profile
  UserProfile,
  UpdateProfileParams,
} from "./types";

// Utilities
export {
  // Encoding
  encodeBase64,
  decodeBase64,
  // Webhook utilities
  verifyWebhookSignature,
  parseWebhookPayload,
  isWebhookStale,
  // Type guards
  isListingEvent,
  isBidEvent,
  isOfferEvent,
  isTransactionEvent,
  // Retry
  retry,
  // Formatting
  formatSOL,
  formatRelativeTime,
} from "./utils";
