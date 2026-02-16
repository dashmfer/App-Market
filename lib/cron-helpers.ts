/**
 * Shared helpers for cron jobs: backend authority, idempotency, and DB transaction wrappers.
 */

import { Keypair, Connection, PublicKey, Transaction as SolanaTransaction, TransactionInstruction, SystemProgram } from "@solana/web3.js";
import { getConnection, getEscrowPDA, getTransactionPDA, getOfferPDA, getOfferEscrowPDA, getConfigPDA, PROGRAM_ID, TREASURY_WALLET } from "@/lib/solana";
import prisma from "@/lib/db";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Retry wrapper for database operations
 */
export async function withRetry<T>(
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

/**
 * Load backend authority keypair from env (JSON array format: [1,2,3,...,64])
 */
export function getBackendAuthority(): Keypair | null {
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

/**
 * Get a Solana connection, returning null on failure
 */
export function getSolanaConnection(): Connection | null {
  try {
    return getConnection();
  } catch (error) {
    console.error("[Cron] Failed to get Solana connection:", error);
    return null;
  }
}

/**
 * Idempotent claim: atomically marks a record as being processed by this cron run.
 * Uses updateMany with a WHERE filter to ensure only unprocessed records are claimed.
 * Returns true if this run claimed the record, false if already processed.
 */
export async function claimTransaction(
  transactionId: string,
  targetStatus: string,
  fromStatuses: string[]
): Promise<boolean> {
  const result = await prisma.transaction.updateMany({
    where: {
      id: transactionId,
      status: { in: fromStatuses as any },
    },
    data: {
      status: targetStatus as any,
    },
  });
  return result.count > 0;
}

/**
 * Idempotent claim for offers: atomically marks an offer as EXPIRED.
 * Returns true if successfully claimed (status was ACTIVE).
 */
export async function claimOffer(offerId: string): Promise<boolean> {
  const result = await prisma.offer.updateMany({
    where: {
      id: offerId,
      status: "ACTIVE",
    },
    data: {
      status: "EXPIRED",
      expiredAt: new Date(),
    },
  });
  return result.count > 0;
}

/**
 * Execute on-chain escrow release (confirm_receipt) using backend authority.
 * This releases funds to the seller and platform fee to treasury.
 */
export async function executeOnChainRelease(
  connection: Connection,
  authority: Keypair,
  listingOnChainId: string,
  sellerWallet: string,
  buyerWallet: string
): Promise<string | null> {
  try {
    const listingPubkey = new PublicKey(listingOnChainId);
    const sellerPubkey = new PublicKey(sellerWallet);
    const buyerPubkey = new PublicKey(buyerWallet);
    const [transactionPda] = getTransactionPDA(listingPubkey);
    const [escrowPda] = getEscrowPDA(listingPubkey);
    const [configPda] = getConfigPDA();

    // Build confirm_receipt instruction (backend authority acts on behalf of buyer)
    const discriminator = Buffer.from([
      0x28, 0xd5, 0xc1, 0xb3, 0x19, 0x6e, 0x2d, 0x98,
    ]); // SHA256("global:confirm_receipt")[0..8]

    const instruction = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: transactionPda, isSigner: false, isWritable: true },
        { pubkey: escrowPda, isSigner: false, isWritable: true },
        { pubkey: listingPubkey, isSigner: false, isWritable: true },
        { pubkey: buyerPubkey, isSigner: false, isWritable: false },
        { pubkey: sellerPubkey, isSigner: false, isWritable: true },
        { pubkey: TREASURY_WALLET, isSigner: false, isWritable: true },
        { pubkey: configPda, isSigner: false, isWritable: false },
        { pubkey: authority.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: discriminator,
    });

    const tx = new SolanaTransaction().add(instruction);
    tx.feePayer = authority.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.sign(authority);

    const txSig = await connection.sendRawTransaction(tx.serialize());
    const confirmation = await connection.confirmTransaction(txSig, "confirmed");
    if (confirmation.value.err) {
      console.error("[Cron] On-chain release tx failed on-chain:", confirmation.value.err);
      return null;
    }
    return txSig;
  } catch (error) {
    console.error("[Cron] On-chain release failed:", error);
    return null;
  }
}

/**
 * Execute on-chain emergency refund using backend authority.
 * This refunds the buyer's escrowed funds.
 */
export async function executeOnChainRefund(
  connection: Connection,
  authority: Keypair,
  listingOnChainId: string,
  buyerWallet: string
): Promise<string | null> {
  try {
    const listingPubkey = new PublicKey(listingOnChainId);
    const buyerPubkey = new PublicKey(buyerWallet);
    const [transactionPda] = getTransactionPDA(listingPubkey);
    const [escrowPda] = getEscrowPDA(listingPubkey);
    const [configPda] = getConfigPDA();

    // Build emergency_refund instruction
    const discriminator = Buffer.from([
      0xf2, 0x4e, 0x3a, 0x15, 0xd8, 0x72, 0x4c, 0x91,
    ]); // SHA256("global:emergency_refund")[0..8]

    const instruction = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: transactionPda, isSigner: false, isWritable: true },
        { pubkey: escrowPda, isSigner: false, isWritable: true },
        { pubkey: listingPubkey, isSigner: false, isWritable: true },
        { pubkey: buyerPubkey, isSigner: false, isWritable: true },
        { pubkey: configPda, isSigner: false, isWritable: false },
        { pubkey: authority.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: discriminator,
    });

    const tx = new SolanaTransaction().add(instruction);
    tx.feePayer = authority.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.sign(authority);

    const txSig = await connection.sendRawTransaction(tx.serialize());
    const confirmation = await connection.confirmTransaction(txSig, "confirmed");
    if (confirmation.value.err) {
      console.error("[Cron] On-chain refund tx failed on-chain:", confirmation.value.err);
      return null;
    }
    return txSig;
  } catch (error) {
    console.error("[Cron] On-chain refund failed:", error);
    return null;
  }
}

/**
 * Execute on-chain offer expiry (expire_offer) using backend authority.
 * Returns the escrowed offer funds to the buyer.
 */
export async function executeOnChainExpireOffer(
  connection: Connection,
  authority: Keypair,
  listingOnChainId: string,
  buyerWallet: string,
  offerOnChainSeed: number
): Promise<string | null> {
  try {
    const listingPubkey = new PublicKey(listingOnChainId);
    const buyerPubkey = new PublicKey(buyerWallet);
    const [offerPda] = getOfferPDA(listingPubkey, buyerPubkey, offerOnChainSeed);
    const [offerEscrowPda] = getOfferEscrowPDA(offerPda);
    const [configPda] = getConfigPDA();

    // Build expire_offer instruction
    const discriminator = Buffer.from([
      0xa5, 0x83, 0x27, 0xe9, 0x1b, 0xd4, 0x6f, 0x3a,
    ]); // SHA256("global:expire_offer")[0..8]

    const instruction = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: offerPda, isSigner: false, isWritable: true },
        { pubkey: offerEscrowPda, isSigner: false, isWritable: true },
        { pubkey: listingPubkey, isSigner: false, isWritable: false },
        { pubkey: buyerPubkey, isSigner: false, isWritable: true },
        { pubkey: configPda, isSigner: false, isWritable: false },
        { pubkey: authority.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: discriminator,
    });

    const tx = new SolanaTransaction().add(instruction);
    tx.feePayer = authority.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.sign(authority);

    const txSig = await connection.sendRawTransaction(tx.serialize());
    const confirmation = await connection.confirmTransaction(txSig, "confirmed");
    if (confirmation.value.err) {
      console.error("[Cron] On-chain expire offer tx failed on-chain:", confirmation.value.err);
      return null;
    }
    return txSig;
  } catch (error) {
    console.error("[Cron] On-chain expire offer failed:", error);
    return null;
  }
}
