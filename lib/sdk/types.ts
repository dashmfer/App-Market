/**
 * AppMarket Agent SDK Type Definitions
 */

// ============================================
// AUTHENTICATION
// ============================================

export type AuthMethod = "api-key" | "wallet-signature";

export interface ApiKeyAuth {
  type: "api-key";
  apiKey: string;
}

export interface WalletSignatureAuth {
  type: "wallet-signature";
  walletAddress: string;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
}

export type AuthConfig = ApiKeyAuth | WalletSignatureAuth;

// ============================================
// SDK CONFIGURATION
// ============================================

export interface AppMarketConfig {
  baseUrl: string;
  auth: AuthConfig;
  timeout?: number;
  debug?: boolean;
}

// ============================================
// API RESPONSES
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================
// API KEYS
// ============================================

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: ApiKeyPermission[];
  rateLimit: number;
  requestCount: number;
  lastUsedAt: string | null;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface ApiKeyWithSecret extends ApiKey {
  key: string;
}

export type ApiKeyPermission =
  | "LISTINGS_READ"
  | "LISTINGS_WRITE"
  | "BIDS_READ"
  | "BIDS_WRITE"
  | "OFFERS_READ"
  | "OFFERS_WRITE"
  | "TRANSACTIONS_READ"
  | "TRANSACTIONS_WRITE"
  | "WEBHOOKS_READ"
  | "WEBHOOKS_WRITE"
  | "PROFILE_READ"
  | "PROFILE_WRITE";

export interface CreateApiKeyParams {
  name: string;
  permissions?: ApiKeyPermission[];
  rateLimit?: number;
  expiresAt?: string;
}

export interface UpdateApiKeyParams {
  name?: string;
  isActive?: boolean;
  permissions?: ApiKeyPermission[];
  rateLimit?: number;
}

// ============================================
// WEBHOOKS
// ============================================

export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: WebhookEventType[];
  isActive: boolean;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  lastDeliveryAt: string | null;
  lastDeliveryStatus: WebhookDeliveryStatus | null;
  createdAt: string;
}

export interface WebhookWithSecret extends Webhook {
  secret: string;
}

export type WebhookEventType =
  | "LISTING_CREATED"
  | "LISTING_UPDATED"
  | "LISTING_ENDED"
  | "LISTING_ENDING_SOON"
  | "BID_PLACED"
  | "BID_OUTBID"
  | "BID_WON"
  | "OFFER_RECEIVED"
  | "OFFER_ACCEPTED"
  | "OFFER_REJECTED"
  | "OFFER_COUNTERED"
  | "TRANSACTION_INITIATED"
  | "TRANSACTION_COMPLETED"
  | "TRANSACTION_CANCELLED"
  | "MESSAGE_RECEIVED"
  | "AGREEMENT_REQUESTED"
  | "AGREEMENT_SIGNED"
  | "WATCHLIST_LISTING_UPDATED"
  | "WATCHLIST_LISTING_ENDING_SOON";

export type WebhookDeliveryStatus =
  | "PENDING"
  | "SUCCESS"
  | "FAILED"
  | "RETRYING";

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: WebhookEventType;
  payload: Record<string, unknown>;
  status: WebhookDeliveryStatus;
  attempts: number;
  maxAttempts: number;
  responseStatus: number | null;
  errorMessage: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export interface WebhookPayload {
  id: string;
  type: WebhookEventType;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface CreateWebhookParams {
  name: string;
  url: string;
  events: WebhookEventType[];
}

export interface UpdateWebhookParams {
  name?: string;
  url?: string;
  events?: WebhookEventType[];
  isActive?: boolean;
}

// ============================================
// LISTINGS
// ============================================

export type ListingStatus =
  | "DRAFT"
  | "ACTIVE"
  | "PAUSED"
  | "SOLD"
  | "EXPIRED"
  | "CANCELLED";

export type ListingType = "AUCTION" | "FIXED_PRICE" | "BOTH";

export interface Listing {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  status: ListingStatus;
  listingType: ListingType;
  startingPrice: number;
  buyNowPrice: number | null;
  currentBid: number | null;
  bidCount: number;
  viewCount: number;
  watchCount: number;
  categories: string[];
  techStack: string[];
  images: string[];
  startTime: string | null;
  endTime: string | null;
  sellerId: string;
  seller: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatar: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ListingDetail extends Listing {
  metrics: {
    monthlyRevenue: number | null;
    monthlyProfit: number | null;
    monthlyUsers: number | null;
    growthRate: number | null;
  };
  urls: {
    website: string | null;
    demo: string | null;
    repository: string | null;
  };
}

export interface ListingFilters {
  status?: ListingStatus;
  listingType?: ListingType;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  sortBy?: "createdAt" | "endTime" | "currentBid" | "bidCount" | "viewCount";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

// ============================================
// BIDS
// ============================================

export interface Bid {
  id: string;
  amount: number;
  listingId: string;
  bidderId: string;
  bidder: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatar: string | null;
  };
  isWinning: boolean;
  createdAt: string;
}

export interface PlaceBidParams {
  listingId: string;
  amount: number;
}

// ============================================
// OFFERS
// ============================================

export type OfferStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "COUNTERED"
  | "EXPIRED"
  | "WITHDRAWN";

export interface Offer {
  id: string;
  amount: number;
  message: string | null;
  status: OfferStatus;
  listingId: string;
  listing: {
    id: string;
    slug: string;
    title: string;
  };
  buyerId: string;
  buyer: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatar: string | null;
  };
  expiresAt: string;
  createdAt: string;
}

export interface CreateOfferParams {
  listingId: string;
  amount: number;
  message?: string;
  expiresInHours?: number;
}

export interface CounterOfferParams {
  offerId: string;
  amount: number;
  message?: string;
}

// ============================================
// TRANSACTIONS
// ============================================

export type TransactionStatus =
  | "INITIATED"
  | "ESCROW_FUNDED"
  | "ASSETS_TRANSFERRED"
  | "COMPLETED"
  | "DISPUTED"
  | "CANCELLED"
  | "REFUNDED";

export interface Transaction {
  id: string;
  status: TransactionStatus;
  amount: number;
  escrowAddress: string | null;
  listingId: string;
  listing: {
    id: string;
    slug: string;
    title: string;
  };
  buyerId: string;
  sellerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionDetail extends Transaction {
  buyer: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatar: string | null;
  };
  seller: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatar: string | null;
  };
  agreements: Agreement[];
  timeline: TransactionEvent[];
}

export interface Agreement {
  id: string;
  type: string;
  signedByBuyer: boolean;
  signedBySeller: boolean;
  buyerSignedAt: string | null;
  sellerSignedAt: string | null;
}

export interface TransactionEvent {
  id: string;
  type: string;
  description: string;
  createdAt: string;
}

// ============================================
// WATCHLIST
// ============================================

export interface WatchlistItem {
  id: string;
  listingId: string;
  listing: Listing;
  createdAt: string;
}

// ============================================
// USER PROFILE
// ============================================

export interface UserProfile {
  id: string;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  avatar: string | null;
  walletAddress: string | null;
  isVerified: boolean;
  createdAt: string;
}

export interface UpdateProfileParams {
  username?: string;
  displayName?: string;
  bio?: string;
}
