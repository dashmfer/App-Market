import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";
import prisma from "@/lib/db";
import crypto from "crypto";

export interface WalletVerificationResult {
  success: boolean;
  user?: {
    id: string;
    walletAddress: string;
    username: string;
    email: string | null;
  };
  error?: string;
}

/**
 * Verify a wallet signature without user lookup/creation
 * Used for verifying ownership claims (e.g., collaborator acceptance)
 */
export function verifyWalletOwnership(
  publicKey: string,
  signature: string,
  message: string
): { valid: boolean; error?: string } {
  try {
    if (!publicKey || !signature || !message) {
      return { valid: false, error: "Missing required fields" };
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

    if (!verified) {
      return { valid: false, error: "Invalid signature" };
    }

    return { valid: true };
  } catch (error) {
    console.error("[Wallet Ownership Verification] Error:", error);
    return { valid: false, error: "Verification failed" };
  }
}

/**
 * Generate a message for collaborator wallet verification
 */
export function generateCollaboratorVerificationMessage(
  collaboratorId: string,
  listingTitle: string,
  walletAddress: string
): string {
  const timestamp = new Date().toISOString();
  return `Accept collaboration for "${listingTitle}"

Collaborator ID: ${collaboratorId}
Wallet: ${walletAddress}
Timestamp: ${timestamp}

Sign this message to prove you own this wallet and accept the collaboration.`;
}

/**
 * Generate a unique referral code for new users
 */
function generateReferralCode(): string {
  // Generate a short, URL-friendly code (8 characters)
  return crypto.randomBytes(4).toString("hex").toLowerCase();
}

/**
 * Verify wallet signature and get/create user
 * Shared logic used by both the API route and NextAuth provider
 */
export async function verifyWalletSignature(
  publicKey: string,
  signature: string,
  message: string,
  referralCode?: string
): Promise<WalletVerificationResult> {
  try {
    console.log("[Wallet Verification] Verification attempt");

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

    console.log("[Wallet Verification] Signature verified:", verified);

    if (!verified) {
      console.error("[Wallet Verification] Invalid signature");
      return { success: false, error: "Invalid signature" };
    }

    console.log("[Wallet Verification] Looking up user");

    // Check if user exists with this wallet
    let user = await prisma.user.findUnique({
      where: { walletAddress: publicKey },
    });

    // If user doesn't exist, create one
    if (!user) {
      console.log("[Wallet Verification] Creating new user");

      // Generate a unique username from wallet address
      const baseUsername = `user_${publicKey.slice(0, 8).toLowerCase()}`;

      // Check if username exists
      const existingUser = await prisma.user.findFirst({
        where: { username: { startsWith: baseUsername } },
      });

      const username = existingUser
        ? `${baseUsername}_${Math.random().toString(36).slice(2, 6)}`
        : baseUsername;

      // Generate a unique referral code for the new user
      let newUserReferralCode = generateReferralCode();

      // Make sure the referral code is unique
      let attempts = 0;
      while (attempts < 5) {
        const existingCode = await prisma.user.findUnique({
          where: { referralCode: newUserReferralCode },
        });
        if (!existingCode) break;
        newUserReferralCode = generateReferralCode();
        attempts++;
      }

      // Find referrer if referral code was provided
      let referrerId: string | null = null;
      if (referralCode) {
        const referrer = await prisma.user.findUnique({
          where: { referralCode: referralCode.toLowerCase() },
          select: { id: true },
        });
        if (referrer) {
          referrerId = referrer.id;
          console.log("[Wallet Verification] Referrer found");
        } else {
          console.log("[Wallet Verification] Referral code not found");
        }
      }

      // Create the user with referral code
      user = await prisma.user.create({
        data: {
          walletAddress: publicKey,
          username,
          email: null,
          isVerified: true,
          referralCode: newUserReferralCode,
          referredBy: referrerId,
        },
      });

      console.log("[Wallet Verification] New user created");

      // If user was referred, create the Referral record
      if (referrerId) {
        try {
          await prisma.referral.create({
            data: {
              referrerId: referrerId,
              referredUserId: user.id,
              status: "REGISTERED",
            },
          });
          console.log("[Wallet Verification] Referral record created");
        } catch (error) {
          console.error("[Wallet Verification] Failed to create referral record:", error);
          // Don't fail the signup if referral creation fails
        }
      }
    } else {
      console.log("[Wallet Verification] Existing user found");

      // If existing user doesn't have a referral code, generate one
      if (!user.referralCode) {
        let newReferralCode = generateReferralCode();
        let attempts = 0;
        while (attempts < 5) {
          const existingCode = await prisma.user.findUnique({
            where: { referralCode: newReferralCode },
          });
          if (!existingCode) break;
          newReferralCode = generateReferralCode();
          attempts++;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { referralCode: newReferralCode },
        });
        console.log("[Wallet Verification] Generated referral code for existing user");
      }
    }

    console.log("[Wallet Verification] Verification successful");

    return {
      success: true,
      user: {
        id: user.id,
        walletAddress: user.walletAddress!,
        username: user.username!,
        email: user.email ?? null,
      },
    };
  } catch (error) {
    console.error("[Wallet Verification] Error during verification:", error);
    return { success: false, error: "Verification failed" };
  }
}
