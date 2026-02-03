/**
 * AppMarket Agent SDK Client
 *
 * A TypeScript SDK for AI agents and automated systems to interact with the AppMarket API.
 *
 * @example
 * ```typescript
 * // Using API key authentication
 * const client = new AppMarketClient({
 *   baseUrl: 'https://www.appmrkt.xyz',
 *   auth: {
 *     type: 'api-key',
 *     apiKey: 'am_live_...'
 *   }
 * });
 *
 * // Get active listings
 * const listings = await client.listings.list({ status: 'ACTIVE' });
 *
 * // Place a bid
 * const bid = await client.bids.place({
 *   listingId: 'listing_123',
 *   amount: 1500
 * });
 * ```
 */

import {
  AppMarketConfig,
  ApiResponse,
  PaginatedResponse,
  ApiKey,
  ApiKeyWithSecret,
  CreateApiKeyParams,
  UpdateApiKeyParams,
  Webhook,
  WebhookWithSecret,
  WebhookDelivery,
  CreateWebhookParams,
  UpdateWebhookParams,
  Listing,
  ListingDetail,
  ListingFilters,
  Bid,
  PlaceBidParams,
  Offer,
  CreateOfferParams,
  CounterOfferParams,
  Transaction,
  TransactionDetail,
  WatchlistItem,
  UserProfile,
  UpdateProfileParams,
} from "./types";
import { encodeBase64 } from "./utils";

// ============================================
// CLIENT CLASS
// ============================================

export class AppMarketClient {
  private config: AppMarketConfig;

  // API Modules
  public readonly keys: KeysAPI;
  public readonly webhooks: WebhooksAPI;
  public readonly listings: ListingsAPI;
  public readonly bids: BidsAPI;
  public readonly offers: OffersAPI;
  public readonly transactions: TransactionsAPI;
  public readonly watchlist: WatchlistAPI;
  public readonly profile: ProfileAPI;

  constructor(config: AppMarketConfig) {
    this.config = {
      timeout: 30000,
      debug: false,
      ...config,
    };

    // Initialize API modules
    this.keys = new KeysAPI(this);
    this.webhooks = new WebhooksAPI(this);
    this.listings = new ListingsAPI(this);
    this.bids = new BidsAPI(this);
    this.offers = new OffersAPI(this);
    this.transactions = new TransactionsAPI(this);
    this.watchlist = new WatchlistAPI(this);
    this.profile = new ProfileAPI(this);
  }

  /**
   * Make an authenticated request to the API
   */
  async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      query?: Record<string, string | number | boolean | undefined>;
    } = {}
  ): Promise<ApiResponse<T>> {
    const url = new URL(path, this.config.baseUrl);

    // Add query parameters
    if (options.query) {
      Object.entries(options.query).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    // Build headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "AppMarket-SDK/1.0",
    };

    // Add authentication
    if (this.config.auth.type === "api-key") {
      headers["Authorization"] = `Bearer ${this.config.auth.apiKey}`;
    } else if (this.config.auth.type === "wallet-signature") {
      const timestamp = Date.now();
      const nonce = crypto.randomUUID();
      const message = `AppMarket Agent Authentication\nTimestamp: ${timestamp}\nNonce: ${nonce}`;
      const messageBytes = new TextEncoder().encode(message);

      const signature = await this.config.auth.signMessage(messageBytes);
      const signatureBase64 = encodeBase64(signature);

      headers["X-Wallet-Address"] = this.config.auth.walletAddress;
      headers["X-Wallet-Signature"] = signatureBase64;
      headers["X-Signature-Timestamp"] = String(timestamp);
      headers["X-Signature-Nonce"] = nonce;
    }

    if (this.config.debug) {
      console.log(`[AppMarket SDK] ${method} ${url.toString()}`);
    }

    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(this.config.timeout!),
      });

      const data = await response.json();

      if (this.config.debug) {
        console.log(`[AppMarket SDK] Response:`, response.status, data);
      }

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
          statusCode: response.status,
        };
      }

      return {
        success: true,
        data,
        statusCode: response.status,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      if (this.config.debug) {
        console.error(`[AppMarket SDK] Error:`, error);
      }

      return {
        success: false,
        error: errorMessage,
        statusCode: 0,
      };
    }
  }
}

// ============================================
// API MODULES
// ============================================

class BaseAPI {
  protected client: AppMarketClient;

  constructor(client: AppMarketClient) {
    this.client = client;
  }
}

/**
 * API Key Management
 */
class KeysAPI extends BaseAPI {
  /**
   * List all API keys for the authenticated user
   */
  async list(): Promise<ApiResponse<ApiKey[]>> {
    return this.client.request<ApiKey[]>("GET", "/api/agent/keys");
  }

  /**
   * Create a new API key
   * @returns The API key with secret (only shown once!)
   */
  async create(params: CreateApiKeyParams): Promise<ApiResponse<ApiKeyWithSecret>> {
    return this.client.request<ApiKeyWithSecret>("POST", "/api/agent/keys", {
      body: params,
    });
  }

  /**
   * Update an existing API key
   */
  async update(id: string, params: UpdateApiKeyParams): Promise<ApiResponse<ApiKey>> {
    return this.client.request<ApiKey>("PATCH", "/api/agent/keys", {
      query: { id },
      body: params,
    });
  }

  /**
   * Delete an API key
   */
  async delete(id: string): Promise<ApiResponse<void>> {
    return this.client.request<void>("DELETE", "/api/agent/keys", {
      query: { id },
    });
  }
}

/**
 * Webhook Management
 */
class WebhooksAPI extends BaseAPI {
  /**
   * List all webhooks for the authenticated user
   */
  async list(): Promise<ApiResponse<Webhook[]>> {
    return this.client.request<Webhook[]>("GET", "/api/agent/webhooks");
  }

  /**
   * Get webhook delivery history
   */
  async getDeliveries(
    webhookId: string,
    params?: { page?: number; pageSize?: number }
  ): Promise<ApiResponse<PaginatedResponse<WebhookDelivery>>> {
    return this.client.request<PaginatedResponse<WebhookDelivery>>(
      "GET",
      `/api/agent/webhooks/${webhookId}/deliveries`,
      { query: params }
    );
  }

  /**
   * Create a new webhook
   * @returns The webhook with secret (only shown once!)
   */
  async create(params: CreateWebhookParams): Promise<ApiResponse<WebhookWithSecret>> {
    return this.client.request<WebhookWithSecret>("POST", "/api/agent/webhooks", {
      body: params,
    });
  }

  /**
   * Update an existing webhook
   */
  async update(id: string, params: UpdateWebhookParams): Promise<ApiResponse<Webhook>> {
    return this.client.request<Webhook>("PATCH", "/api/agent/webhooks", {
      query: { id },
      body: params,
    });
  }

  /**
   * Delete a webhook
   */
  async delete(id: string): Promise<ApiResponse<void>> {
    return this.client.request<void>("DELETE", "/api/agent/webhooks", {
      query: { id },
    });
  }

  /**
   * Test a webhook by sending a test event
   */
  async test(id: string): Promise<ApiResponse<{ delivered: boolean }>> {
    return this.client.request<{ delivered: boolean }>(
      "POST",
      `/api/agent/webhooks/${id}/test`
    );
  }
}

/**
 * Listings API
 */
class ListingsAPI extends BaseAPI {
  /**
   * List listings with optional filters
   */
  async list(
    filters?: ListingFilters
  ): Promise<ApiResponse<PaginatedResponse<Listing>>> {
    return this.client.request<PaginatedResponse<Listing>>(
      "GET",
      "/api/agent/listings",
      { query: filters as Record<string, string | number | boolean | undefined> }
    );
  }

  /**
   * Get a single listing by ID or slug
   */
  async get(idOrSlug: string): Promise<ApiResponse<ListingDetail>> {
    return this.client.request<ListingDetail>(
      "GET",
      `/api/agent/listings/${idOrSlug}`
    );
  }

  /**
   * Get bids for a listing
   */
  async getBids(listingId: string): Promise<ApiResponse<Bid[]>> {
    return this.client.request<Bid[]>(
      "GET",
      `/api/agent/listings/${listingId}/bids`
    );
  }

  /**
   * Get offers for a listing (seller only)
   */
  async getOffers(listingId: string): Promise<ApiResponse<Offer[]>> {
    return this.client.request<Offer[]>(
      "GET",
      `/api/agent/listings/${listingId}/offers`
    );
  }
}

/**
 * Bids API
 */
class BidsAPI extends BaseAPI {
  /**
   * Place a bid on a listing
   */
  async place(params: PlaceBidParams): Promise<ApiResponse<Bid>> {
    return this.client.request<Bid>("POST", "/api/agent/bids", {
      body: params,
    });
  }

  /**
   * Get all bids placed by the authenticated user
   */
  async listMine(): Promise<ApiResponse<Bid[]>> {
    return this.client.request<Bid[]>("GET", "/api/agent/bids");
  }

  /**
   * Get a specific bid
   */
  async get(id: string): Promise<ApiResponse<Bid>> {
    return this.client.request<Bid>("GET", `/api/agent/bids/${id}`);
  }
}

/**
 * Offers API
 */
class OffersAPI extends BaseAPI {
  /**
   * Create a new offer on a listing
   */
  async create(params: CreateOfferParams): Promise<ApiResponse<Offer>> {
    return this.client.request<Offer>("POST", "/api/agent/offers", {
      body: params,
    });
  }

  /**
   * Get all offers made by the authenticated user
   */
  async listMine(): Promise<ApiResponse<Offer[]>> {
    return this.client.request<Offer[]>("GET", "/api/agent/offers");
  }

  /**
   * Get offers received on user's listings (seller)
   */
  async listReceived(): Promise<ApiResponse<Offer[]>> {
    return this.client.request<Offer[]>("GET", "/api/agent/offers/received");
  }

  /**
   * Get a specific offer
   */
  async get(id: string): Promise<ApiResponse<Offer>> {
    return this.client.request<Offer>("GET", `/api/agent/offers/${id}`);
  }

  /**
   * Accept an offer (seller only)
   */
  async accept(id: string): Promise<ApiResponse<Offer>> {
    return this.client.request<Offer>("POST", `/api/agent/offers/${id}/accept`);
  }

  /**
   * Reject an offer (seller only)
   */
  async reject(id: string): Promise<ApiResponse<Offer>> {
    return this.client.request<Offer>("POST", `/api/agent/offers/${id}/reject`);
  }

  /**
   * Counter an offer (seller only)
   */
  async counter(params: CounterOfferParams): Promise<ApiResponse<Offer>> {
    return this.client.request<Offer>(
      "POST",
      `/api/agent/offers/${params.offerId}/counter`,
      {
        body: { amount: params.amount, message: params.message },
      }
    );
  }

  /**
   * Withdraw an offer (buyer only)
   */
  async withdraw(id: string): Promise<ApiResponse<Offer>> {
    return this.client.request<Offer>(
      "POST",
      `/api/agent/offers/${id}/withdraw`
    );
  }
}

/**
 * Transactions API
 */
class TransactionsAPI extends BaseAPI {
  /**
   * List all transactions for the authenticated user
   */
  async list(): Promise<ApiResponse<Transaction[]>> {
    return this.client.request<Transaction[]>("GET", "/api/agent/transactions");
  }

  /**
   * Get a specific transaction
   */
  async get(id: string): Promise<ApiResponse<TransactionDetail>> {
    return this.client.request<TransactionDetail>(
      "GET",
      `/api/agent/transactions/${id}`
    );
  }

  /**
   * Sign an agreement
   */
  async signAgreement(
    transactionId: string,
    agreementId: string
  ): Promise<ApiResponse<void>> {
    return this.client.request<void>(
      "POST",
      `/api/agent/transactions/${transactionId}/agreements/${agreementId}/sign`
    );
  }

  /**
   * Confirm asset transfer (buyer confirms receipt)
   */
  async confirmTransfer(transactionId: string): Promise<ApiResponse<Transaction>> {
    return this.client.request<Transaction>(
      "POST",
      `/api/agent/transactions/${transactionId}/confirm`
    );
  }
}

/**
 * Watchlist API
 */
class WatchlistAPI extends BaseAPI {
  /**
   * Get all watchlisted items
   */
  async list(): Promise<ApiResponse<WatchlistItem[]>> {
    return this.client.request<WatchlistItem[]>("GET", "/api/agent/watchlist");
  }

  /**
   * Add a listing to watchlist
   */
  async add(listingId: string): Promise<ApiResponse<WatchlistItem>> {
    return this.client.request<WatchlistItem>("POST", "/api/agent/watchlist", {
      body: { listingId },
    });
  }

  /**
   * Remove a listing from watchlist
   */
  async remove(listingId: string): Promise<ApiResponse<void>> {
    return this.client.request<void>("DELETE", "/api/agent/watchlist", {
      query: { listingId },
    });
  }

  /**
   * Check if a listing is watchlisted
   */
  async check(listingId: string): Promise<ApiResponse<{ isWatchlisted: boolean }>> {
    return this.client.request<{ isWatchlisted: boolean }>(
      "GET",
      `/api/agent/watchlist/check`,
      { query: { listingId } }
    );
  }
}

/**
 * Profile API
 */
class ProfileAPI extends BaseAPI {
  /**
   * Get the authenticated user's profile
   */
  async get(): Promise<ApiResponse<UserProfile>> {
    return this.client.request<UserProfile>("GET", "/api/agent/profile");
  }

  /**
   * Update the authenticated user's profile
   */
  async update(params: UpdateProfileParams): Promise<ApiResponse<UserProfile>> {
    return this.client.request<UserProfile>("PATCH", "/api/agent/profile", {
      body: params,
    });
  }
}
