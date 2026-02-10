import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/db";
import { calculatePlatformFee } from "@/lib/solana";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature")!;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    // Handle the event
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSuccess(paymentIntent);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailed(paymentIntent);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const { listingId, buyerId, sellerId, amountSol, paymentType } = paymentIntent.metadata;

  // SECURITY: Idempotency check - prevent duplicate processing from Stripe retries
  const existingTransaction = await prisma.transaction.findFirst({
    where: { stripePaymentId: paymentIntent.id },
  });
  if (existingTransaction) {
    console.log("[Stripe Webhook] Already processed payment:", paymentIntent.id);
    return NextResponse.json({ received: true, status: "already_processed" });
  }

  const salePrice = parseFloat(amountSol);
  const platformFee = calculatePlatformFee(salePrice);
  const sellerProceeds = salePrice - platformFee;

  // Get listing
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { bids: true },
  });

  if (!listing) {
    // CRITICAL: Payment succeeded but listing doesn't exist
    // Log critical error for manual intervention and attempt refund
    console.error("CRITICAL: Payment succeeded but listing not found:", {
      listingId,
      paymentIntentId: paymentIntent.id,
      buyerId,
      amountSol,
    });

    // Attempt to refund the payment
    try {
      await stripe.refunds.create({
        payment_intent: paymentIntent.id,
        reason: 'requested_by_customer',
      });
      console.log("Refund initiated for missing listing:", paymentIntent.id);

      // Notify buyer about the refund
      await prisma.notification.create({
        data: {
          type: "SYSTEM",
          title: "Payment Refunded",
          message: "Your payment was refunded because the listing is no longer available.",
          userId: buyerId,
        },
      });
    } catch (refundError: any) {
      console.error("CRITICAL: Failed to refund payment for missing listing:", refundError);
      // Manual intervention required
    }
    return;
  }

  if (paymentType === "buyNow") {
    // Create transaction for Buy Now - using array format for consistency with transfers
    const transferChecklist = [
      {
        id: "github",
        label: "GitHub Repository",
        description: "Transfer ownership of the repository to buyer",
        iconType: "github",
        required: !!listing.githubRepo,
        sellerConfirmed: false,
        sellerConfirmedAt: null,
        sellerEvidence: null,
        buyerConfirmed: false,
        buyerConfirmedAt: null,
      },
      {
        id: "domain",
        label: "Domain",
        description: "Transfer domain ownership via registrar",
        iconType: "domain",
        required: listing.hasDomain,
        sellerConfirmed: false,
        sellerConfirmedAt: null,
        sellerEvidence: null,
        buyerConfirmed: false,
        buyerConfirmedAt: null,
      },
      {
        id: "database",
        label: "Database Access",
        description: "Provide database credentials and data export",
        iconType: "database",
        required: listing.hasDatabase,
        sellerConfirmed: false,
        sellerConfirmedAt: null,
        sellerEvidence: null,
        buyerConfirmed: false,
        buyerConfirmedAt: null,
      },
      {
        id: "hosting",
        label: "Hosting Access",
        description: "Transfer hosting account access",
        iconType: "hosting",
        required: listing.hasHosting,
        sellerConfirmed: false,
        sellerConfirmedAt: null,
        sellerEvidence: null,
        buyerConfirmed: false,
        buyerConfirmedAt: null,
      },
      {
        id: "apiKeys",
        label: "API Keys & Credentials",
        description: "Share all necessary API keys and service credentials",
        iconType: "apiKeys",
        required: listing.hasApiKeys,
        sellerConfirmed: false,
        sellerConfirmedAt: null,
        sellerEvidence: null,
        buyerConfirmed: false,
        buyerConfirmedAt: null,
      },
      {
        id: "designFiles",
        label: "Design Files",
        description: "Share Figma/Sketch files",
        iconType: "designFiles",
        required: listing.hasDesignFiles,
        sellerConfirmed: false,
        sellerConfirmedAt: null,
        sellerEvidence: null,
        buyerConfirmed: false,
        buyerConfirmedAt: null,
      },
      {
        id: "documentation",
        label: "Documentation",
        description: "Provide setup guides and documentation",
        iconType: "documentation",
        required: listing.hasDocumentation,
        sellerConfirmed: false,
        sellerConfirmedAt: null,
        sellerEvidence: null,
        buyerConfirmed: false,
        buyerConfirmedAt: null,
      },
    ];

    // Wrap critical DB operations in a transaction for atomicity
    await prisma.$transaction(async (tx: any) => {
      // Create transaction record
      await tx.transaction.create({
        data: {
          salePrice,
          platformFee,
          sellerProceeds,
          currency: "SOL",
          paymentMethod: "STRIPE",
          stripePaymentId: paymentIntent.id,
          status: "IN_ESCROW",
          transferChecklist,
          listingId,
          buyerId,
          sellerId,
          paidAt: new Date(),
        },
      });

      // Update listing status
      await tx.listing.update({
        where: { id: listingId },
        data: { status: "SOLD" },
      });
    });

    // Notifications are sent outside the transaction since they are non-critical
    // and should not cause a rollback of the payment processing
    await prisma.notification.create({
      data: {
        type: "PAYMENT_RECEIVED",
        title: "Payment Received!",
        message: `Payment of ${salePrice} SOL received for "${listing.title}". Please begin the transfer process.`,
        userId: sellerId,
      },
    });

    await prisma.notification.create({
      data: {
        type: "AUCTION_WON",
        title: "Purchase Successful!",
        message: `You've purchased "${listing.title}". The seller will begin transferring assets.`,
        userId: buyerId,
      },
    });
  } else {
    // Wrap bid operations in a transaction for atomicity
    await prisma.$transaction(async (tx: any) => {
      // Mark previous winning bid as outbid
      await tx.bid.updateMany({
        where: { listingId, isWinning: true },
        data: { isWinning: false, isOutbid: true },
      });

      // Create bid
      await tx.bid.create({
        data: {
          amount: salePrice,
          currency: "SOL",
          isWinning: true,
          listingId,
          bidderId: buyerId,
        },
      });
    });

    // Notify seller (non-critical, outside transaction)
    await prisma.notification.create({
      data: {
        type: "BID_PLACED",
        title: "New Bid Received!",
        message: `New bid of ${salePrice} SOL on "${listing.title}"`,
        userId: sellerId,
      },
    });
  }

  // NOTE: Stats are updated at payment time for simplicity.
  // Ideally, they should update after transfer completion.
  await prisma.user.update({
    where: { id: sellerId },
    data: {
      totalSales: { increment: 1 },
      totalVolume: { increment: salePrice },
    },
  });

  await prisma.user.update({
    where: { id: buyerId },
    data: {
      totalPurchases: { increment: 1 },
    },
  });
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const { buyerId, listingId } = paymentIntent.metadata;

  // Get listing title for notification
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { title: true },
  });

  // Notify buyer of failed payment
  await prisma.notification.create({
    data: {
      type: "SYSTEM",
      title: "Payment Failed",
      message: `Your payment for "${listing?.title || "this listing"}" failed. Please try again.`,
      userId: buyerId,
    },
  });
}
