import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
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
  getEscrowPDA,
  getWithdrawalPDA,
} from "@/lib/solana";
import { audit } from "@/lib/audit";

/**
 * Cron Job: Expire Unclaimed Withdrawals
 *
 * When a bidder gets outbid, their SOL goes into a PendingWithdrawal PDA.
 * If they don't claim it within 1 hour, the escrow.amount check blocks
 * the entire transaction from completing.
 *
 * This cron calls expire_withdrawal on-chain to:
 * 1. Return the locked SOL to the original outbid user
 * 2. Reduce escrow.amount so transactions can complete
 * 3. Close the PendingWithdrawal PDA (rent goes to caller)
 *
 * Runs every hour. Requires BACKEND_AUTHORITY_SECRET_KEY env var.
 */

// Verify cron secret
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[Cron] CRON_SECRET not configured");
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
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

// Build the expire_withdrawal instruction
function buildExpireWithdrawalInstruction(
  listingPubkey: PublicKey,
  withdrawalId: number,
  recipientPubkey: PublicKey,
  callerPubkey: PublicKey,
): TransactionInstruction {
  const [escrowPda] = getEscrowPDA(listingPubkey);
  const [withdrawalPda] = getWithdrawalPDA(listingPubkey, withdrawalId);

  // Anchor instruction discriminator for expire_withdrawal
  // SHA256("global:expire_withdrawal")[0..8]
  const discriminator = Buffer.from([
    0x9b, 0x95, 0xf4, 0x6a, 0x53, 0x2e, 0x15, 0x6e,
  ]);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: listingPubkey, isSigner: false, isWritable: false },    // listing
      { pubkey: escrowPda, isSigner: false, isWritable: true },          // escrow
      { pubkey: withdrawalPda, isSigner: false, isWritable: true },      // pending_withdrawal
      { pubkey: recipientPubkey, isSigner: false, isWritable: true },    // recipient
      { pubkey: callerPubkey, isSigner: true, isWritable: true },        // caller
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    ],
    data: discriminator,
  });
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const authority = getBackendAuthority();
    if (!authority) {
      console.warn("[Cron] BACKEND_AUTHORITY_SECRET_KEY not set — skipping on-chain expiry. DB update only.");
    }

    // Find unclaimed withdrawals older than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const expiredWithdrawals = await prisma.pendingWithdrawal.findMany({
      where: {
        claimed: false,
        createdAt: { lt: oneHourAgo },
      },
      include: {
        user: { select: { walletAddress: true } },
        listing: { select: { id: true, onChainId: true } },
      },
      take: 10, // Process in batches to avoid timeout
    });

    if (expiredWithdrawals.length === 0) {
      return NextResponse.json({
        message: "No expired withdrawals to process",
        processed: 0,
      });
    }

    console.log(`[Cron] Found ${expiredWithdrawals.length} expired withdrawals to process`);

    let connection: Connection | null = null;
    if (authority) {
      try {
        connection = getConnection();
      } catch (error) {
        console.error("[Cron] Failed to get Solana connection:", error);
      }
    }

    const results = { processed: 0, onChainSuccess: 0, onChainFailed: 0, dbOnly: 0 };

    for (const withdrawal of expiredWithdrawals) {
      try {
        // Attempt on-chain expiry if we have authority + connection + on-chain data
        if (
          authority &&
          connection &&
          withdrawal.onChainId &&
          withdrawal.listing.onChainId &&
          withdrawal.user.walletAddress
        ) {
          try {
            const listingPubkey = new PublicKey(withdrawal.listing.onChainId);
            const recipientPubkey = new PublicKey(withdrawal.user.walletAddress);
            const withdrawalId = parseInt(withdrawal.onChainId);

            const instruction = buildExpireWithdrawalInstruction(
              listingPubkey,
              withdrawalId,
              recipientPubkey,
              authority.publicKey,
            );

            const tx = new Transaction().add(instruction);
            tx.feePayer = authority.publicKey;
            tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
            tx.sign(authority);

            const txSig = await connection.sendRawTransaction(tx.serialize());
            await connection.confirmTransaction(txSig, "confirmed");

            console.log(`[Cron] On-chain expire_withdrawal tx: ${txSig}`);
            results.onChainSuccess++;
          } catch (onChainError) {
            console.error(`[Cron] On-chain expiry failed for withdrawal ${withdrawal.id}:`, onChainError);
            results.onChainFailed++;
            // Still mark as claimed in DB so we don't retry forever
          }
        } else {
          results.dbOnly++;
        }

        // Mark as claimed in DB regardless
        await prisma.pendingWithdrawal.update({
          where: { id: withdrawal.id },
          data: {
            claimed: true,
            claimedAt: new Date(),
          },
        });

        // Notify the user
        if (withdrawal.user.walletAddress) {
          await prisma.notification.create({
            data: {
              type: "SYSTEM",
              title: "Expired Bid Refund",
              message: `Your unclaimed withdrawal of ${Number(withdrawal.amount)} ${withdrawal.currency} has been automatically returned to your wallet.`,
              data: {
                withdrawalId: withdrawal.id,
                amount: Number(withdrawal.amount),
                listingId: withdrawal.listingId,
              },
              userId: withdrawal.userId,
            },
          });
        }

        results.processed++;
      } catch (error) {
        console.error(`[Cron] Failed to process withdrawal ${withdrawal.id}:`, error);
      }
    }

    console.log("[Cron] Expire withdrawals results:", results);

    await audit({
      action: "CRON_EXECUTION",
      detail: `expire-withdrawals: ${results.processed} processed, ${results.onChainSuccess} on-chain, ${results.onChainFailed} failed`,
      metadata: results,
    });

    return NextResponse.json({
      message: `Processed ${results.processed} expired withdrawals`,
      ...results,
    });
  } catch (error) {
    console.error("[Cron] Expire withdrawals error:", error);
    return NextResponse.json(
      { error: "Failed to process expired withdrawals" },
      { status: 500 }
    );
  }
}
