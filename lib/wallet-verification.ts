import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";
import prisma from "@/lib/db";

export interface WalletVerificationResult {
  success: boolean;
  user?: {
    id: string;
    walletAddress: string;
    username: string;
    email: string;
  };
  error?: string;
}

/**
 * Verify wallet signature and get/create user
 * Shared logic used by both the API route and NextAuth provider
 */
export async function verifyWalletSignature(
  publicKey: string,
  signature: string,
  message: string
): Promise<WalletVerificationResult> {
  try {
    console.log("[Wallet Verification] Verifying signature for wallet:", publicKey);

    if (!publicKey || !signature || !message) {
      console.error("[Wallet Verification] Missing required fields");
      return { success: false, error: "Missing required fields" };
    }

    // Verify the signature
    const publicKeyObj = new PublicKey(publicKey);
    const signatureUint8 = bs58.decode(signature);
    const messageUint8 = new TextEncoder().encode(message);
    const publicKeyUint8 = publicKeyObj.toBytes();

    const verified = nacl.sign.detached.verify(
      messageUint8,
      signatureUint8,
      publicKeyUint8
    );

    console.log("[Wallet Verification] Signature verification result:", verified);

    if (!verified) {
      console.error("[Wallet Verification] Invalid signature");
      return { success: false, error: "Invalid signature" };
    }

    console.log("[Wallet Verification] Checking if user exists...");

    // Check if user exists with this wallet
    let user = await prisma.user.findUnique({
      where: { walletAddress: publicKey },
    });

    // If user doesn't exist, create one
    if (!user) {
      console.log("[Wallet Verification] User not found, creating new user...");

      // Generate a unique username from wallet address
      const baseUsername = `user_${publicKey.slice(0, 8).toLowerCase()}`;

      // Check if username exists
      const existingUser = await prisma.user.findFirst({
        where: { username: { startsWith: baseUsername } },
      });

      const username = existingUser
        ? `${baseUsername}_${Math.random().toString(36).slice(2, 6)}`
        : baseUsername;

      user = await prisma.user.create({
        data: {
          walletAddress: publicKey,
          username,
          // Create a placeholder email since it's required by schema
          email: `${publicKey.toLowerCase()}@wallet.placeholder`,
          isVerified: true, // Wallet ownership is verified
        },
      });

      console.log("[Wallet Verification] New user created:", { id: user.id, username: user.username });
    } else {
      console.log("[Wallet Verification] Existing user found:", { id: user.id, username: user.username });
    }

    console.log("[Wallet Verification] Verification successful");

    return {
      success: true,
      user: {
        id: user.id,
        walletAddress: user.walletAddress!,
        username: user.username!,
        email: user.email!,
      },
    };
  } catch (error) {
    console.error("[Wallet Verification] Error during verification:", error);
    return { success: false, error: "Verification failed" };
  }
}
