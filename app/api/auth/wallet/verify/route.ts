import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";
import prisma from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    console.log("[Wallet Verify API] Request received");
    const { publicKey, signature, message } = await req.json();

    console.log("[Wallet Verify API] Payload:", {
      publicKey,
      signatureLength: signature?.length,
      messageLength: message?.length
    });

    if (!publicKey || !signature || !message) {
      console.error("[Wallet Verify API] Missing required fields");
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify the signature
    console.log("[Wallet Verify API] Verifying signature...");
    const publicKeyObj = new PublicKey(publicKey);
    const signatureUint8 = bs58.decode(signature);
    const messageUint8 = new TextEncoder().encode(message);
    const publicKeyUint8 = publicKeyObj.toBytes();

    const verified = nacl.sign.detached.verify(
      messageUint8,
      signatureUint8,
      publicKeyUint8
    );

    console.log("[Wallet Verify API] Signature verification result:", verified);

    if (!verified) {
      console.error("[Wallet Verify API] Invalid signature");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    console.log("[Wallet Verify API] Checking if user exists...");
    // Check if user exists with this wallet
    let user = await prisma.user.findUnique({
      where: { walletAddress: publicKey },
    });

    // If user doesn't exist, create one
    if (!user) {
      console.log("[Wallet Verify API] User not found, creating new user...");
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
          // Users can update this later in settings
          email: `${publicKey.toLowerCase()}@wallet.placeholder`,
          isVerified: true, // Wallet ownership is verified
        },
      });
      console.log("[Wallet Verify API] New user created:", { id: user.id, username: user.username });
    } else {
      console.log("[Wallet Verify API] Existing user found:", { id: user.id, username: user.username });
    }

    console.log("[Wallet Verify API] Verification successful");
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("[Wallet Verify API] Error during verification:", error);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}
