import { NextRequest, NextResponse } from "next/server";

// OpenAPI 3.0 Specification for AppMarket Agent API
const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "AppMarket Agent API",
    description: `
# AppMarket Agent API

API for AI agents and bots to interact with the AppMarket platform.

## Authentication

Two authentication methods are supported:

### 1. API Key Authentication
Include your API key in the Authorization header:
\`\`\`
Authorization: Bearer ak_live_xxxxxxxxxxxxx
\`\`\`

### 2. Wallet Signature Authentication
Sign a message with your Solana wallet and include in headers:
\`\`\`
X-Wallet-Address: <your-wallet-public-key>
X-Wallet-Signature: <signature>
X-Auth-Timestamp: <unix-timestamp-ms>
\`\`\`

The message to sign is: \`AppMarket Agent Auth\\nTimestamp: {timestamp}\`

## Rate Limiting

- Default: 100 requests per minute
- Custom limits can be set per API key
- Rate limit headers are included in responses

## Webhooks

Subscribe to real-time events via webhooks. Events are signed with HMAC-SHA256.
Verify signatures using the \`X-Webhook-Signature\` header.
    `,
    version: "1.0.0",
    contact: {
      name: "AppMarket Support",
      url: "https://appmarket.com/support",
    },
  },
  servers: [
    {
      url: "/api",
      description: "Production API",
    },
  ],
  tags: [
    { name: "Authentication", description: "API key and webhook management" },
    { name: "Listings", description: "Browse and create listings" },
    { name: "Bids", description: "Place and manage bids" },
    { name: "Offers", description: "Make and respond to offers" },
    { name: "Transactions", description: "Purchases and agreements" },
    { name: "Watchlist", description: "Track interesting listings" },
    { name: "Webhooks", description: "Real-time event notifications" },
  ],
  components: {
    securitySchemes: {
      apiKey: {
        type: "http",
        scheme: "bearer",
        description: "API key authentication (Bearer ak_live_xxx)",
      },
      walletSignature: {
        type: "apiKey",
        in: "header",
        name: "X-Wallet-Signature",
        description: "Wallet signature authentication",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          error: { type: "string", example: "Error message" },
          timestamp: { type: "integer", example: 1706900000000 },
        },
      },
      ApiKey: {
        type: "object",
        properties: {
          id: { type: "string", example: "clxxxxxxxxxx" },
          name: { type: "string", example: "My Trading Bot" },
          keyPrefix: { type: "string", example: "ak_live_7xKX" },
          permissions: {
            type: "array",
            items: { type: "string", enum: ["READ", "WRITE", "TRANSACTION", "ADMIN"] },
          },
          rateLimit: { type: "integer", example: 100 },
          isActive: { type: "boolean", example: true },
          lastUsedAt: { type: "string", format: "date-time", nullable: true },
          totalRequests: { type: "integer", example: 1234 },
          expiresAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Webhook: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string", example: "My Bot Notifications" },
          url: { type: "string", format: "uri", example: "https://mybot.com/webhook" },
          events: {
            type: "array",
            items: { type: "string" },
            example: ["BID_PLACED", "BID_OUTBID", "LISTING_ENDING_SOON"],
          },
          isActive: { type: "boolean" },
          totalDeliveries: { type: "integer" },
          successfulDeliveries: { type: "integer" },
          failedDeliveries: { type: "integer" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Listing: {
        type: "object",
        properties: {
          id: { type: "string" },
          slug: { type: "string", example: "my-awesome-saas" },
          title: { type: "string", example: "My Awesome SaaS" },
          tagline: { type: "string" },
          description: { type: "string" },
          categories: { type: "array", items: { type: "string" } },
          techStack: { type: "array", items: { type: "string" } },
          startingPrice: { type: "number", example: 100 },
          currentBid: { type: "number", nullable: true },
          buyNowPrice: { type: "number", nullable: true },
          currency: { type: "string", enum: ["SOL", "USDC", "APP"] },
          status: { type: "string", enum: ["ACTIVE", "ENDED", "SOLD"] },
          endTime: { type: "string", format: "date-time" },
          seller: {
            type: "object",
            properties: {
              id: { type: "string" },
              username: { type: "string" },
              displayName: { type: "string" },
              isVerified: { type: "boolean" },
            },
          },
        },
      },
      Bid: {
        type: "object",
        properties: {
          id: { type: "string" },
          amount: { type: "number", example: 50 },
          listingId: { type: "string" },
          bidderId: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Offer: {
        type: "object",
        properties: {
          id: { type: "string" },
          amount: { type: "number" },
          message: { type: "string" },
          status: { type: "string", enum: ["PENDING", "ACCEPTED", "REJECTED", "COUNTERED", "EXPIRED"] },
          listingId: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      WebhookEvent: {
        type: "object",
        properties: {
          id: { type: "string", example: "evt_1706900000_abc123" },
          type: { type: "string", example: "BID_PLACED" },
          timestamp: { type: "integer", example: 1706900000000 },
          data: { type: "object" },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: "Authentication required",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      RateLimited: {
        description: "Rate limit exceeded",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
    },
  },
  paths: {
    // API Keys
    "/agent/keys": {
      get: {
        tags: ["Authentication"],
        summary: "List API keys",
        security: [{ apiKey: [] }, { walletSignature: [] }],
        responses: {
          "200": {
            description: "List of API keys",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        keys: {
                          type: "array",
                          items: { $ref: "#/components/schemas/ApiKey" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        tags: ["Authentication"],
        summary: "Create API key",
        security: [{ apiKey: [] }, { walletSignature: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string", example: "My Trading Bot" },
                  permissions: {
                    type: "array",
                    items: { type: "string", enum: ["READ", "WRITE", "TRANSACTION", "ADMIN"] },
                    default: ["READ", "WRITE"],
                  },
                  rateLimit: { type: "integer", default: 100, minimum: 10, maximum: 1000 },
                  expiresAt: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "API key created (secret only shown once)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        key: { $ref: "#/components/schemas/ApiKey" },
                        secret: { type: "string", description: "Only shown once!" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Authentication"],
        summary: "Delete API key",
        security: [{ apiKey: [] }, { walletSignature: [] }],
        parameters: [
          { name: "id", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "API key deleted" },
          "404": { description: "API key not found" },
        },
      },
    },

    // Webhooks
    "/agent/webhooks": {
      get: {
        tags: ["Webhooks"],
        summary: "List webhooks",
        security: [{ apiKey: [] }, { walletSignature: [] }],
        responses: {
          "200": {
            description: "List of webhooks",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        webhooks: {
                          type: "array",
                          items: { $ref: "#/components/schemas/Webhook" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Webhooks"],
        summary: "Create webhook",
        security: [{ apiKey: [] }, { walletSignature: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "url", "events"],
                properties: {
                  name: { type: "string", example: "My Bot Notifications" },
                  url: { type: "string", format: "uri", example: "https://mybot.com/webhook" },
                  events: {
                    type: "array",
                    items: {
                      type: "string",
                      enum: [
                        "LISTING_CREATED", "LISTING_UPDATED", "LISTING_ENDED", "LISTING_ENDING_SOON",
                        "BID_PLACED", "BID_OUTBID", "BID_WON",
                        "TRANSACTION_INITIATED", "TRANSACTION_COMPLETED", "TRANSACTION_CANCELLED",
                        "AGREEMENT_REQUESTED", "AGREEMENT_SIGNED",
                        "OFFER_RECEIVED", "OFFER_ACCEPTED", "OFFER_REJECTED", "OFFER_COUNTERED",
                        "MESSAGE_RECEIVED",
                        "WATCHLIST_LISTING_UPDATED", "WATCHLIST_LISTING_ENDING_SOON",
                      ],
                    },
                    example: ["BID_PLACED", "BID_OUTBID", "LISTING_ENDING_SOON"],
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Webhook created (secret only shown once)",
          },
        },
      },
    },

    // Listings
    "/listings": {
      get: {
        tags: ["Listings"],
        summary: "Search listings",
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["ACTIVE", "ENDED", "SOLD"] } },
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "sort", in: "query", schema: { type: "string", enum: ["ending-soon", "newest", "price-low", "price-high", "most-bids"] } },
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "minPrice", in: "query", schema: { type: "number" } },
          { name: "maxPrice", in: "query", schema: { type: "number" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: {
          "200": {
            description: "List of listings",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    listings: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Listing" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Listings"],
        summary: "Create listing",
        security: [{ apiKey: [] }, { walletSignature: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "description", "categories", "startingPrice", "endTime"],
                properties: {
                  title: { type: "string" },
                  tagline: { type: "string" },
                  description: { type: "string" },
                  categories: { type: "array", items: { type: "string" } },
                  techStack: { type: "array", items: { type: "string" } },
                  startingPrice: { type: "number" },
                  buyNowPrice: { type: "number" },
                  currency: { type: "string", enum: ["SOL", "USDC", "APP"], default: "SOL" },
                  endTime: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Listing created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Listing" },
              },
            },
          },
        },
      },
    },

    "/listings/{slug}": {
      get: {
        tags: ["Listings"],
        summary: "Get listing details",
        parameters: [
          { name: "slug", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Listing details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Listing" },
              },
            },
          },
          "404": { description: "Listing not found" },
        },
      },
    },

    // Bids
    "/bids": {
      post: {
        tags: ["Bids"],
        summary: "Place a bid",
        security: [{ apiKey: [] }, { walletSignature: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["listingId", "amount"],
                properties: {
                  listingId: { type: "string" },
                  amount: { type: "number" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Bid placed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Bid" },
              },
            },
          },
          "400": { description: "Invalid bid (too low, auction ended, etc.)" },
        },
      },
    },

    // Offers
    "/offers": {
      post: {
        tags: ["Offers"],
        summary: "Make an offer",
        security: [{ apiKey: [] }, { walletSignature: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["listingId", "amount"],
                properties: {
                  listingId: { type: "string" },
                  amount: { type: "number" },
                  message: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Offer created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Offer" },
              },
            },
          },
        },
      },
    },

    "/offers/{id}/respond": {
      post: {
        tags: ["Offers"],
        summary: "Respond to an offer (accept/reject/counter)",
        security: [{ apiKey: [] }, { walletSignature: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["action"],
                properties: {
                  action: { type: "string", enum: ["accept", "reject", "counter"] },
                  counterAmount: { type: "number", description: "Required if action is 'counter'" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Offer response recorded" },
        },
      },
    },

    // Watchlist
    "/watchlist": {
      get: {
        tags: ["Watchlist"],
        summary: "Get watchlist",
        security: [{ apiKey: [] }, { walletSignature: [] }],
        responses: {
          "200": {
            description: "Watchlisted listings",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    listings: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Listing" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Watchlist"],
        summary: "Add to watchlist",
        security: [{ apiKey: [] }, { walletSignature: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["listingId"],
                properties: {
                  listingId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Added to watchlist" },
        },
      },
      delete: {
        tags: ["Watchlist"],
        summary: "Remove from watchlist",
        security: [{ apiKey: [] }, { walletSignature: [] }],
        parameters: [
          { name: "listingId", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Removed from watchlist" },
        },
      },
    },

    // Transactions
    "/transactions": {
      post: {
        tags: ["Transactions"],
        summary: "Initiate a purchase",
        security: [{ apiKey: [] }, { walletSignature: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["listingId"],
                properties: {
                  listingId: { type: "string" },
                  useBuyNow: { type: "boolean", default: false },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Transaction initiated" },
        },
      },
    },

    "/transactions/{id}/sign": {
      post: {
        tags: ["Transactions"],
        summary: "Sign transaction with wallet",
        security: [{ apiKey: [] }, { walletSignature: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["signature"],
                properties: {
                  signature: { type: "string", description: "Wallet signature of the transaction" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Transaction signed" },
        },
      },
    },

    "/transactions/{id}/agreements": {
      post: {
        tags: ["Transactions"],
        summary: "Sign legal agreement (NDA, APA, Non-Compete)",
        security: [{ apiKey: [] }, { walletSignature: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["agreementType", "signature"],
                properties: {
                  agreementType: { type: "string", enum: ["NDA", "APA", "NON_COMPETE"] },
                  signature: { type: "string", description: "Wallet signature of the agreement" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Agreement signed" },
        },
      },
    },
  },
};

export async function GET(request: NextRequest) {
  return NextResponse.json(openApiSpec, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    },
  });
}
