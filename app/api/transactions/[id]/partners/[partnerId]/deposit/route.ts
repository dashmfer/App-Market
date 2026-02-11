import { NextRequest, NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";
import prisma from "@/lib/prisma";
import { getAuthToken } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { validateCsrfRequest, csrfError } from '@/lib/csrf';

// POST - Mark partner as having deposited their share
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; partnerId: string } }
) {
  try {
    // SECURITY: Validate CSRF token
    const csrfValidation = validateCsrfRequest(request);
    if (!csrfValidation.valid) {
      return csrfError(csrfValidation.error || 'CSRF validation failed');
    }

    const token = await getAuthToken(request);
    if (!token?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { txHash } = body;

    const transaction = await prisma.transaction.findUnique({
      where: { id: params.id },
      include: {
        partners: {
          include: {
            user: { select: { id: true, username: true, displayName: true } },
          },
        },
        listing: { select: { title: true, slug: true } },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const partner = transaction.partners.find((p: { id: string }) => p.id === params.partnerId);
    if (!partner) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }

    // SECURITY: Only the partner themselves can mark as deposited.
    // If partner has a userId, they must match. If no userId, verify wallet address.
    if (partner.userId) {
      if (partner.userId !== token.id as string) {
        return NextResponse.json({ error: "Only the partner can confirm their deposit" }, { status: 403 });
      }
    } else {
      // No userId set — verify the session user's wallet matches the partner's wallet
      const currentUser = await prisma.user.findUnique({
        where: { id: token.id as string },
        select: { walletAddress: true },
      });
      if (!currentUser?.walletAddress || currentUser.walletAddress !== partner.walletAddress) {
        return NextResponse.json({ error: "Wallet address does not match partner record" }, { status: 403 });
      }
    }

    // Check if deposit deadline has passed
    if (transaction.partnerDepositDeadline && new Date() > transaction.partnerDepositDeadline) {
      return NextResponse.json({
        error: "Deposit deadline has passed. Transaction will be refunded."
      }, { status: 400 });
    }

    // Check if already deposited
    if (partner.depositStatus === "DEPOSITED") {
      return NextResponse.json({ error: "Already deposited" }, { status: 400 });
    }

    // SECURITY [C5]: Verify on-chain transaction before accepting deposit
    if (!txHash) {
      return NextResponse.json({ error: "Transaction hash is required" }, { status: 400 });
    }

    // SECURITY [H8]: Prefer server-only SOLANA_RPC_URL to avoid leaking API keys
    // via the NEXT_PUBLIC_ prefix (which is embedded in the client bundle).
    const rpcUrl = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
    const connection = new Connection(rpcUrl, "confirmed");
    const txInfo = await connection.getTransaction(txHash, { maxSupportedTransactionVersion: 0 });

    if (!txInfo || txInfo.meta?.err) {
      return NextResponse.json({ error: "Invalid or failed on-chain transaction" }, { status: 400 });
    }

    // SECURITY [H1]: Verify on-chain transfer amount, recipient, and sender
    const accountKeys = txInfo.transaction.message.getAccountKeys().staticAccountKeys.map((k: any) => k.toBase58());
    const preBalances = txInfo.meta!.preBalances;
    const postBalances = txInfo.meta!.postBalances;

    // Verify treasury wallet is in the transaction
    const treasuryWallet = process.env.NEXT_PUBLIC_TREASURY_WALLET;
    if (!treasuryWallet) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const treasuryIndex = accountKeys.indexOf(treasuryWallet);
    if (treasuryIndex === -1) {
      return NextResponse.json({ error: "Transaction does not involve the platform treasury" }, { status: 400 });
    }

    // Verify the partner's wallet is the sender
    if (!accountKeys.includes(partner.walletAddress)) {
      return NextResponse.json({ error: "Transaction sender does not match partner wallet" }, { status: 400 });
    }

    // Verify the transferred amount matches the partner's deposit amount
    const treasuryReceived = postBalances[treasuryIndex] - preBalances[treasuryIndex];
    const expectedLamports = Math.floor(Number(partner.depositAmount) * 1e9); // Convert SOL to lamports
    const tolerance = 10000; // Allow small tolerance for tx fees
    if (treasuryReceived < expectedLamports - tolerance) {
      return NextResponse.json({ error: "On-chain transfer amount does not match expected deposit amount" }, { status: 400 });
    }

    // SECURITY [H7]: Use serializable transaction to prevent race condition
    // in the "all deposited" check
    const result = await prisma.$transaction(async (tx) => {
      // Update partner deposit status
      await tx.transactionPartner.update({
        where: { id: params.partnerId },
        data: {
          depositStatus: "DEPOSITED",
          depositedAt: new Date(),
          depositTxHash: txHash || null,
        },
      });

      // Re-read all partners inside the transaction to avoid stale data
      const allPartners = await tx.transactionPartner.findMany({
        where: { transactionId: transaction.id },
      });

      const allDeposited = allPartners.every((p: { id: string; depositStatus: string }) =>
        p.id === params.partnerId ? true : p.depositStatus === "DEPOSITED"
      );

      // Check if total is 100%
      const totalPercentage = allPartners.reduce((sum: number, p: any) => sum + Number(p.percentage), 0);

      if (allDeposited && totalPercentage >= 100) {
        // All deposits complete! Move to next phase
        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            status: "PAID",
            paidAt: new Date(),
          },
        });
      }

      return { allDeposited, totalPercentage, allPartners };
    }, { isolationLevel: 'Serializable' });

    // Notify lead buyer (outside the transaction -- non-critical)
    const leadPartner = transaction.partners.find((p: { isLead: boolean }) => p.isLead);
    if (leadPartner?.userId && leadPartner.userId !== token.id as string) {
      await createNotification({
        userId: leadPartner.userId,
        type: "PURCHASE_PARTNER_DEPOSITED",
        listingTitle: transaction.listing.title,
        data: {
          partnerName: partner.user?.displayName || partner.user?.username || partner.walletAddress.slice(0, 8),
          percentage: partner.percentage,
          transactionId: params.id,
        },
      });
    }

    if (result.allDeposited && result.totalPercentage >= 100) {
      // Notify all partners
      for (const p of transaction.partners as Array<{ userId: string | null; id: string; depositStatus: string; isLead: boolean }>) {
        if (p.userId) {
          await createNotification({
            userId: p.userId,
            type: "PURCHASE_PARTNER_ALL_READY",
            listingTitle: transaction.listing.title,
            data: {
              listingSlug: transaction.listing.slug,
              transactionId: params.id,
            },
          });
        }
      }

      return NextResponse.json({
        success: true,
        allDeposited: true,
        message: "All deposits complete! Purchase is now locked in.",
      });
    }

    return NextResponse.json({
      success: true,
      allDeposited: false,
      deposited: result.allPartners.filter((p: { id: string; depositStatus: string }) =>
        p.id === params.partnerId || p.depositStatus === "DEPOSITED"
      ).length,
      total: result.allPartners.length,
      percentageDeposited: result.allPartners
        .filter((p: { id: string; depositStatus: string }) => p.id === params.partnerId || p.depositStatus === "DEPOSITED")
        .reduce((sum: number, p: any) => sum + Number(p.percentage), 0),
    });
  } catch (error) {
    console.error("Error processing deposit:", error);
    return NextResponse.json({ error: "Failed to process deposit" }, { status: 500 });
  }
}
