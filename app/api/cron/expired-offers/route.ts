import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyCronSecret } from "@/lib/cron-auth";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import {
  PROGRAM_ID,
  getConnection,
  getOfferPDA,
  getOfferEscrowPDA,
  getConfigPDA,
} from "@/lib/solana";

/**
 * Cron Job: Expired Offers Cleanup
 *
 * Two-phase cleanup process:
 * 1. Mark ACTIVE offers past their deadline as EXPIRED
 * 2. Delete EXPIRED offers that have been expired for 24+ hours
 *
 * Runs every 10 minutes.
 */

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// Retry wrapper for database operations
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.warn(`[Cron] ${operationName} attempt ${attempt}/${maxRetries} failed:`, error);

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
      }
    }
  }

  throw lastError;
}

// Load backend authority keypair from env (JSON array format: [1,2,3,...,64])
function getBackendAuthority(): Keypair | null {
  const secretKeyJson = process.env.BACKEND_AUTHORITY_SECRET_KEY;
  if (!secretKeyJson) {
    return null;
  }

  try {
    const keypairBytes = JSON.parse(secretKeyJson);
    return Keypair.fromSecretKey(Uint8Array.from(keypairBytes));
  } catch (error) {
    console.error("[Cron] Failed to parse BACKEND_AUTHORITY_SECRET_KEY:", error);
    return null;
  }
}

// Build the expire_offer instruction to refund escrowed funds on-chain
function buildExpireOfferInstruction(
  listingPubkey: PublicKey,
  buyerPubkey: PublicKey,
  offerSeed: number,
  callerPubkey: PublicKey,
): TransactionInstruction {
  const [offerPda] = getOfferPDA(listingPubkey, buyerPubkey, offerSeed);
  const [offerEscrowPda] = getOfferEscrowPDA(offerPda);
  const [configPda] = getConfigPDA();

  // Anchor instruction discriminator for expire_offer
  // SHA256("global:expire_offer")[0..8]
  const discriminator = Buffer.from([
    0xc9, 0x52, 0xa1, 0x6a, 0x6a, 0x4b, 0x1d, 0xc1,
  ]);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: offerPda, isSigner: false, isWritable: true },              // offer
      { pubkey: offerEscrowPda, isSigner: false, isWritable: true },        // offer_escrow
      { pubkey: listingPubkey, isSigner: false, isWritable: false },        // listing
      { pubkey: buyerPubkey, isSigner: false, isWritable: true },           // buyer (receives refund)
      { pubkey: configPda, isSigner: false, isWritable: false },            // config
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    ],
    data: discriminator,
  });
}

export async function GET(request: NextRequest) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const now = new Date();
    const cleanupThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

    // Phase 1: Mark ACTIVE offers past deadline as EXPIRED
    const expiredOffers = await prisma.offer.findMany({
      where: {
        status: "ACTIVE",
        deadline: {
          lt: now,
        },
      },
      include: {
        listing: {
          select: {
            title: true,
            onChainId: true,
          },
        },
        buyer: {
          select: {
            id: true,
            username: true,
            walletAddress: true,
          },
        },
      },
    });

    const results = {
      markedExpired: 0,
      deleted: 0,
      refundsInitiated: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process offers to mark as expired
    // Set up on-chain connection if backend authority is available
    const authority = getBackendAuthority();
    let connection: Connection | null = null;
    if (authority) {
      try {
        connection = getConnection();
      } catch (error) {
        console.error("[Cron] Failed to get Solana connection:", error);
      }
    } else {
      console.warn("[Cron] BACKEND_AUTHORITY_SECRET_KEY not set — on-chain offer refunds will be skipped");
    }

    for (const offer of expiredOffers) {
      try {
        // Attempt on-chain refund before marking as expired in DB
        let onChainRefundSucceeded = false;
        if (
          authority &&
          connection &&
          offer.onChainId &&
          offer.listing.onChainId &&
          offer.buyer.walletAddress
        ) {
          try {
            const listingPubkey = new PublicKey(offer.listing.onChainId);
            const buyerPubkey = new PublicKey(offer.buyer.walletAddress);
            const offerSeed = parseInt(offer.onChainId);

            const instruction = buildExpireOfferInstruction(
              listingPubkey,
              buyerPubkey,
              offerSeed,
              authority.publicKey,
            );

            const tx = new Transaction().add(instruction);
            tx.feePayer = authority.publicKey;
            tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
            tx.sign(authority);

            const txSig = await connection.sendRawTransaction(tx.serialize());
            await connection.confirmTransaction(txSig, "confirmed");

            console.log(`[Cron] On-chain expire_offer tx for offer ${offer.id}: ${txSig}`);
            onChainRefundSucceeded = true;
            results.refundsInitiated++;
          } catch (onChainError) {
            console.warn(
              `[Cron] On-chain refund failed for offer ${offer.id} — marking as expired in DB anyway. ` +
              `Funds may still be locked in escrow. Error:`,
              onChainError
            );
          }
        } else if (!offer.onChainId || !offer.listing.onChainId) {
          // No on-chain data — offer may have been created off-chain only
          console.log(`[Cron] Offer ${offer.id} has no on-chain data, skipping on-chain refund`);
        }

        // Always update offer status to EXPIRED in DB (do NOT block on on-chain success)
        await prisma.offer.update({
          where: { id: offer.id },
          data: {
            status: "EXPIRED",
            expiredAt: now,
          },
        });
        await prisma.notification.create({
          data: {
            type: "SYSTEM",
            title: "Offer Expired",
            message: onChainRefundSucceeded
              ? `Your offer of ${Number(offer.amount)} SOL on "${offer.listing.title}" has expired. Your escrowed funds have been returned to your wallet.`
              : `Your offer of ${Number(offer.amount)} SOL on "${offer.listing.title}" has expired. If you had funds in escrow, please contact support for assistance with your refund.`,
            data: {
              offerId: offer.id,
              listingId: offer.listingId,
              amount: Number(offer.amount),
              onChainRefundSucceeded,
            },
            userId: offer.buyerId,
          },
        });

        results.markedExpired++;
        console.log(`[Cron] Marked offer ${offer.id} as expired (on-chain refund: ${onChainRefundSucceeded ? "success" : "skipped/failed"})`);
      } catch (error) {
        results.failed++;
        const errorMsg = `Failed to expire offer ${offer.id}: ${error}`;
        results.errors.push(errorMsg);
        console.error(`[Cron] ${errorMsg}`);
      }
    }

    // Phase 2: Delete EXPIRED offers older than 24 hours
    // These are offers where:
    // - Status is EXPIRED
    // - expiredAt is more than 24 hours ago
    const offersToDelete = await prisma.offer.findMany({
      where: {
        status: "EXPIRED",
        expiredAt: {
          not: null,
          lt: cleanupThreshold,
        },
      },
      select: {
        id: true,
      },
    });

    if (offersToDelete.length > 0) {
      const deleteResult = await prisma.offer.deleteMany({
        where: {
          id: {
            in: offersToDelete.map((o: { id: string }) => o.id),
          },
        },
      });
      results.deleted = deleteResult.count;
      console.log(`[Cron] Deleted ${results.deleted} old expired offers`);
    }

    // Also clean up CANCELLED offers older than 24 hours
    const cancelledToDelete = await prisma.offer.findMany({
      where: {
        status: "CANCELLED",
        cancelledAt: {
          not: null,
          lt: cleanupThreshold,
        },
      },
      select: {
        id: true,
      },
    });

    if (cancelledToDelete.length > 0) {
      const deleteResult = await prisma.offer.deleteMany({
        where: {
          id: {
            in: cancelledToDelete.map((o: { id: string }) => o.id),
          },
        },
      });
      results.deleted += deleteResult.count;
      console.log(`[Cron] Deleted ${deleteResult.count} old cancelled offers`);
    }

    return NextResponse.json({
      success: true,
      message: `Offer cleanup complete: ${results.markedExpired} expired, ${results.deleted} deleted, ${results.refundsInitiated} refunds initiated`,
      processed: {
        activeOffersChecked: expiredOffers.length,
        staleOffersChecked: offersToDelete.length + cancelledToDelete.length,
      },
      results,
    });
  } catch (error) {
    console.error("[Cron] Expired offers cleanup error:", error);
    return NextResponse.json(
      { error: "Failed to process offer cleanup" },
      { status: 500 }
    );
  }
}
