import prisma from "@/lib/prisma";
import { signWebhookPayload } from "@/lib/agent-auth";
import { WebhookEventType, WebhookDeliveryStatus } from "@/lib/prisma-enums";

// ============================================
// TYPES
// ============================================

export interface WebhookPayload {
  id: string;
  type: WebhookEventType;
  timestamp: number;
  data: Record<string, any>;
}

interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  error?: string;
}

// ============================================
// WEBHOOK DISPATCHER
// ============================================

/**
 * Dispatch a webhook event to all subscribed webhooks
 */
export async function dispatchWebhookEvent(
  eventType: WebhookEventType,
  data: Record<string, any>,
  userId?: string
): Promise<void> {
  try {
    // Find all active webhooks subscribed to this event
    const whereClause: any = {
      isActive: true,
      events: { has: eventType },
    };

    // If userId is provided, only send to that user's webhooks
    // Otherwise, send to all webhooks subscribed to this event
    if (userId) {
      whereClause.userId = userId;
    }

    const webhooks = await prisma.webhook.findMany({
      where: whereClause,
      select: {
        id: true,
        url: true,
        secret: true,
      },
    });

    if (webhooks.length === 0) {
      return;
    }

    // Create webhook payload
    const payload: WebhookPayload = {
      id: generateEventId(),
      type: eventType,
      timestamp: Date.now(),
      data,
    };

    // Dispatch to all webhooks in parallel
    const deliveryPromises = webhooks.map((webhook: { id: string; url: string; secret: string }) =>
      deliverWebhook(webhook.id, webhook.url, webhook.secret, payload)
    );

    // Fire and forget - don't await
    Promise.allSettled(deliveryPromises).catch(console.error);
  } catch (error) {
    console.error("Error dispatching webhook event:", error);
  }
}

/**
 * Deliver a webhook to a single endpoint
 */
async function deliverWebhook(
  webhookId: string,
  url: string,
  secret: string,
  payload: WebhookPayload
): Promise<void> {
  const payloadString = JSON.stringify(payload);
  const signature = signWebhookPayload(payloadString, secret);

  // Create delivery record
  const delivery = await prisma.webhookDelivery.create({
    data: {
      webhookId,
      eventType: payload.type,
      payload: payload as any,
      status: WebhookDeliveryStatus.PENDING,
    },
  });

  // Attempt delivery
  const result = await attemptDelivery(url, payloadString, signature);

  // Update delivery record
  await prisma.webhookDelivery.update({
    where: { id: delivery.id },
    data: {
      status: result.success
        ? WebhookDeliveryStatus.SUCCESS
        : WebhookDeliveryStatus.FAILED,
      attempts: 1,
      responseStatus: result.statusCode,
      errorMessage: result.error,
      deliveredAt: result.success ? new Date() : null,
      nextRetryAt: result.success ? null : new Date(Date.now() + 60000), // Retry in 1 min
    },
  });

  // Update webhook stats
  await prisma.webhook.update({
    where: { id: webhookId },
    data: {
      totalDeliveries: { increment: 1 },
      successfulDeliveries: result.success ? { increment: 1 } : undefined,
      failedDeliveries: result.success ? undefined : { increment: 1 },
      lastDeliveryAt: new Date(),
      lastDeliveryStatus: result.success
        ? WebhookDeliveryStatus.SUCCESS
        : WebhookDeliveryStatus.FAILED,
    },
  });

  // Schedule retry if failed
  if (!result.success) {
    scheduleRetry(delivery.id);
  }
}

/**
 * Attempt to deliver a webhook payload
 */
async function attemptDelivery(
  url: string,
  payload: string,
  signature: string
): Promise<WebhookDeliveryResult> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Timestamp": Date.now().toString(),
        "User-Agent": "AppMarket-Webhooks/1.0",
      },
      body: payload,
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    // Consider 2xx responses as success
    if (response.ok) {
      return { success: true, statusCode: response.status };
    }

    return {
      success: false,
      statusCode: response.status,
      error: `HTTP ${response.status}: ${response.statusText}`,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: errorMessage };
  }
}

/**
 * Schedule a retry for a failed webhook delivery
 */
function scheduleRetry(deliveryId: string): void {
  // In production, use a job queue (Bull, etc.)
  // For now, use setTimeout
  setTimeout(async () => {
    await retryDelivery(deliveryId);
  }, 60000); // Retry after 1 minute
}

/**
 * Retry a failed webhook delivery
 */
async function retryDelivery(deliveryId: string): Promise<void> {
  try {
    const delivery = await prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        webhook: {
          select: {
            id: true,
            url: true,
            secret: true,
            isActive: true,
          },
        },
      },
    });

    if (!delivery || !delivery.webhook.isActive) {
      return;
    }

    if (delivery.attempts >= delivery.maxAttempts) {
      // Max retries reached
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: WebhookDeliveryStatus.FAILED,
          nextRetryAt: null,
        },
      });
      return;
    }

    const payload = delivery.payload as unknown as WebhookPayload;
    const payloadString = JSON.stringify(payload);
    const signature = signWebhookPayload(payloadString, delivery.webhook.secret);

    const result = await attemptDelivery(
      delivery.webhook.url,
      payloadString,
      signature
    );

    const newAttempts = delivery.attempts + 1;
    const shouldRetry = !result.success && newAttempts < delivery.maxAttempts;

    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: result.success
          ? WebhookDeliveryStatus.SUCCESS
          : shouldRetry
          ? WebhookDeliveryStatus.RETRYING
          : WebhookDeliveryStatus.FAILED,
        attempts: newAttempts,
        responseStatus: result.statusCode,
        errorMessage: result.error,
        deliveredAt: result.success ? new Date() : null,
        nextRetryAt: shouldRetry
          ? new Date(Date.now() + getRetryDelay(newAttempts))
          : null,
      },
    });

    // Update webhook stats
    if (result.success) {
      await prisma.webhook.update({
        where: { id: delivery.webhook.id },
        data: {
          successfulDeliveries: { increment: 1 },
          failedDeliveries: { decrement: 1 },
          lastDeliveryStatus: WebhookDeliveryStatus.SUCCESS,
        },
      });
    } else if (shouldRetry) {
      scheduleRetry(deliveryId);
    }
  } catch (error) {
    console.error("Error retrying webhook delivery:", error);
  }
}

/**
 * Get retry delay with exponential backoff
 */
function getRetryDelay(attempt: number): number {
  // 1 min, 2 min, 4 min (exponential backoff)
  return Math.min(60000 * Math.pow(2, attempt - 1), 240000);
}

/**
 * Generate a unique event ID
 */
function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================
// EVENT HELPERS
// ============================================

/**
 * Dispatch listing-related events
 */
export async function dispatchListingEvent(
  eventType:
    | "LISTING_CREATED"
    | "LISTING_UPDATED"
    | "LISTING_ENDED"
    | "LISTING_ENDING_SOON",
  listing: {
    id: string;
    slug: string;
    title: string;
    sellerId: string;
    currentBid?: number | null;
    startingPrice?: number;
    endTime?: Date;
  }
): Promise<void> {
  await dispatchWebhookEvent(
    WebhookEventType[eventType],
    {
      listingId: listing.id,
      slug: listing.slug,
      title: listing.title,
      currentBid: listing.currentBid,
      startingPrice: listing.startingPrice,
      endTime: listing.endTime?.toISOString(),
    },
    listing.sellerId
  );

  // Also notify users who have watchlisted this listing
  if (eventType === "LISTING_UPDATED" || eventType === "LISTING_ENDING_SOON") {
    const watchlistUsers = await prisma.watchlist.findMany({
      where: { listingId: listing.id },
      select: { userId: true },
    });

    const watchlistEventType =
      eventType === "LISTING_ENDING_SOON"
        ? WebhookEventType.WATCHLIST_LISTING_ENDING_SOON
        : WebhookEventType.WATCHLIST_LISTING_UPDATED;

    for (const { userId } of watchlistUsers) {
      await dispatchWebhookEvent(
        watchlistEventType,
        {
          listingId: listing.id,
          slug: listing.slug,
          title: listing.title,
          currentBid: listing.currentBid,
          endTime: listing.endTime?.toISOString(),
        },
        userId
      );
    }
  }
}

/**
 * Dispatch bid-related events
 */
export async function dispatchBidEvent(
  eventType: "BID_PLACED" | "BID_OUTBID" | "BID_WON",
  bid: {
    id: string;
    amount: number;
    bidderId: string;
    listing: {
      id: string;
      slug: string;
      title: string;
      sellerId: string;
    };
  },
  previousBidderId?: string
): Promise<void> {
  // Notify the bidder
  await dispatchWebhookEvent(
    WebhookEventType[eventType],
    {
      bidId: bid.id,
      amount: bid.amount,
      listingId: bid.listing.id,
      slug: bid.listing.slug,
      title: bid.listing.title,
    },
    bid.bidderId
  );

  // Notify seller about new bids
  if (eventType === "BID_PLACED") {
    await dispatchWebhookEvent(
      WebhookEventType.BID_PLACED,
      {
        bidId: bid.id,
        amount: bid.amount,
        listingId: bid.listing.id,
        slug: bid.listing.slug,
        title: bid.listing.title,
      },
      bid.listing.sellerId
    );
  }

  // Notify previous bidder they were outbid
  if (eventType === "BID_PLACED" && previousBidderId) {
    await dispatchWebhookEvent(
      WebhookEventType.BID_OUTBID,
      {
        bidId: bid.id,
        amount: bid.amount,
        listingId: bid.listing.id,
        slug: bid.listing.slug,
        title: bid.listing.title,
      },
      previousBidderId
    );
  }
}

/**
 * Dispatch transaction-related events
 */
export async function dispatchTransactionEvent(
  eventType:
    | "TRANSACTION_INITIATED"
    | "TRANSACTION_COMPLETED"
    | "TRANSACTION_CANCELLED",
  transaction: {
    id: string;
    buyerId: string;
    sellerId: string;
    listing: {
      id: string;
      slug: string;
      title: string;
    };
    amount: number;
  }
): Promise<void> {
  const data = {
    transactionId: transaction.id,
    listingId: transaction.listing.id,
    slug: transaction.listing.slug,
    title: transaction.listing.title,
    amount: transaction.amount,
  };

  // Notify both buyer and seller
  await dispatchWebhookEvent(WebhookEventType[eventType], data, transaction.buyerId);
  await dispatchWebhookEvent(WebhookEventType[eventType], data, transaction.sellerId);
}

/**
 * Dispatch offer-related events
 */
export async function dispatchOfferEvent(
  eventType:
    | "OFFER_RECEIVED"
    | "OFFER_ACCEPTED"
    | "OFFER_REJECTED"
    | "OFFER_COUNTERED",
  offer: {
    id: string;
    amount: number;
    buyerId: string;
    listing: {
      id: string;
      slug: string;
      title: string;
      sellerId: string;
    };
  }
): Promise<void> {
  const data = {
    offerId: offer.id,
    amount: offer.amount,
    listingId: offer.listing.id,
    slug: offer.listing.slug,
    title: offer.listing.title,
  };

  if (eventType === "OFFER_RECEIVED") {
    // Notify seller
    await dispatchWebhookEvent(WebhookEventType[eventType], data, offer.listing.sellerId);
  } else {
    // Notify buyer
    await dispatchWebhookEvent(WebhookEventType[eventType], data, offer.buyerId);
  }
}

/**
 * Dispatch message event
 */
export async function dispatchMessageEvent(
  recipientId: string,
  message: {
    id: string;
    conversationId: string;
    senderId: string;
    preview: string;
  }
): Promise<void> {
  await dispatchWebhookEvent(
    WebhookEventType.MESSAGE_RECEIVED,
    {
      messageId: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      preview: message.preview,
    },
    recipientId
  );
}

/**
 * Dispatch agreement event
 */
export async function dispatchAgreementEvent(
  eventType: "AGREEMENT_REQUESTED" | "AGREEMENT_SIGNED",
  agreement: {
    transactionId: string;
    type: string;
    userId: string;
    listing: {
      id: string;
      slug: string;
      title: string;
    };
  }
): Promise<void> {
  await dispatchWebhookEvent(
    WebhookEventType[eventType],
    {
      transactionId: agreement.transactionId,
      agreementType: agreement.type,
      listingId: agreement.listing.id,
      slug: agreement.listing.slug,
      title: agreement.listing.title,
    },
    agreement.userId
  );
}
