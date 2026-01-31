import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { calculatePlatformFee } from "@/lib/solana";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

// POST /api/payments/create-intent - Create a payment intent for fiat payments
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { listingId, paymentType } = body; // paymentType: "bid" or "buyNow"

    // Get listing
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        seller: true,
        bids: {
          orderBy: { amount: "desc" },
          take: 1,
        },
      },
    });

    if (!listing) {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 }
      );
    }

    // Determine amount based on payment type
    let amountInSol: number;
    
    if (paymentType === "buyNow") {
      if (!listing.buyNowEnabled || !listing.buyNowPrice) {
        return NextResponse.json(
          { error: "Buy Now not available" },
          { status: 400 }
        );
      }
      amountInSol = listing.buyNowPrice;
    } else {
      // For bids, the user specifies the amount
      const { bidAmount } = body;
      if (!bidAmount) {
        return NextResponse.json(
          { error: "Bid amount required" },
          { status: 400 }
        );
      }
      
      const minBid = listing.bids[0]?.amount || listing.startingPrice;
      if (bidAmount <= minBid) {
        return NextResponse.json(
          { error: `Bid must be higher than ${minBid} SOL` },
          { status: 400 }
        );
      }
      
      amountInSol = bidAmount;
    }

    // Fetch real-time SOL price from CoinGecko
    let solPriceUsd: number;
    try {
      const priceResponse = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
        { next: { revalidate: 60 } } // Cache for 60 seconds
      );
      if (!priceResponse.ok) {
        throw new Error('Failed to fetch SOL price');
      }
      const priceData = await priceResponse.json();
      solPriceUsd = priceData.solana?.usd;
      if (!solPriceUsd || typeof solPriceUsd !== 'number') {
        throw new Error('Invalid price data');
      }
    } catch (priceError) {
      console.error('Error fetching SOL price:', priceError);
      return NextResponse.json(
        { error: 'Unable to fetch current SOL price. Please try again.' },
        { status: 503 }
      );
    }
    const amountUsd = amountInSol * solPriceUsd;
    const amountCents = Math.round(amountUsd * 100);

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      metadata: {
        listingId,
        buyerId: session.user.id,
        sellerId: listing.sellerId,
        amountSol: amountInSol.toString(),
        paymentType,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amountUsd: amountUsd.toFixed(2),
      amountSol: amountInSol,
    });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    return NextResponse.json(
      { error: "Failed to create payment" },
      { status: 500 }
    );
  }
}
