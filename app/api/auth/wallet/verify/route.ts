import { NextRequest, NextResponse } from "next/server";
import { verifyWalletSignature } from "@/lib/wallet-verification";

/**
 * Wallet signature verification endpoint
 * Used by the signin page for manual wallet authentication
 */
export async function POST(req: NextRequest) {
  try {
    console.log("[Wallet Verify API] Request received");
    const { publicKey, signature, message } = await req.json();

    console.log("[Wallet Verify API] Payload:", {
      publicKey,
      signatureLength: signature?.length,
      messageLength: message?.length
    });

    // Use shared verification logic
    const result = await verifyWalletSignature(publicKey, signature, message);

    if (!result.success) {
      console.error("[Wallet Verify API] Verification failed:", result.error);
      return NextResponse.json(
        { error: result.error || "Verification failed" },
        { status: 401 }
      );
    }

    console.log("[Wallet Verify API] Verification successful");
    return NextResponse.json({
      success: true,
      user: result.user,
    });
  } catch (error) {
    console.error("[Wallet Verify API] Error during verification:", error);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}
