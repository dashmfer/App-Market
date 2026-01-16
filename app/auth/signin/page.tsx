"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { motion } from "framer-motion";
import {
  Wallet,
  Loader2,
  AlertCircle,
  Lock,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const error = searchParams.get("error");

  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [walletState, setWalletState] = useState<"disconnected" | "connecting" | "locked" | "ready">("disconnected");

  const { connected, publicKey, signMessage, connecting, wallet } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();

  // Detect wallet state
  useEffect(() => {
    if (connecting) {
      setWalletState("connecting");
    } else if (connected && publicKey && signMessage) {
      setWalletState("ready");
    } else if (connected && publicKey && !signMessage) {
      // Wallet is connected but can't sign - likely locked
      setWalletState("locked");
    } else {
      setWalletState("disconnected");
    }
  }, [connected, publicKey, signMessage, connecting]);

  // Auto-trigger authentication when wallet becomes ready
  useEffect(() => {
    if (walletState === "ready" && !isLoading) {
      handleWalletAuth();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletState]);

  const handleWalletAuth = async () => {
    if (!publicKey || !signMessage) {
      setFormError("Wallet not properly connected. Please reconnect.");
      return;
    }

    setIsLoading(true);
    setFormError(null);

    try {
      // Create a message to sign
      const message = `Sign this message to authenticate with App Market.\n\nWallet: ${publicKey.toBase58()}\nTimestamp: ${new Date().toISOString()}`;
      const encodedMessage = new TextEncoder().encode(message);

      // Request signature from wallet
      const signature = await signMessage(encodedMessage);

      // Convert signature to base58
      const bs58 = await import("bs58");
      const signatureBase58 = bs58.default.encode(signature);

      // Authenticate with NextAuth using wallet credentials
      const result = await signIn("wallet", {
        publicKey: publicKey.toBase58(),
        signature: signatureBase58,
        message,
        redirect: false,
      });

      if (result?.error) {
        setFormError("Authentication failed. Please try again.");
        setIsLoading(false);
      } else {
        router.push(callbackUrl);
      }
    } catch (error: any) {
      if (error.message?.includes("User rejected") || error.message?.includes("rejected")) {
        setFormError("Signature request was rejected. Please try again.");
      } else if (error.message?.includes("locked") || error.message?.includes("Locked")) {
        setWalletState("locked");
        setFormError(null);
      } else {
        setFormError(`Authentication failed: ${error.message || "Unknown error"}`);
      }
      setIsLoading(false);
    }
  };

  const handleConnectWallet = () => {
    setFormError(null);
    setWalletModalVisible(true);
  };

  const errorMessages: Record<string, string> = {
    OAuthSignin: "Error starting sign in",
    OAuthCallback: "Error during callback",
    OAuthCreateAccount: "Error creating account",
    Callback: "Error during callback",
    OAuthAccountNotLinked: "This account is linked to another wallet",
    default: "Unable to sign in",
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-display text-2xl font-semibold"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <span className="text-white text-lg font-bold">A</span>
            </div>
            <span>App Market</span>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl shadow-black/5 p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              Welcome back
            </h1>
            <p className="mt-2 text-zinc-500">
              Connect your wallet to sign in
            </p>
          </div>

          {/* Error Message */}
          {(error || formError) && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">
                  {formError || errorMessages[error!] || errorMessages.default}
                </span>
              </div>
            </div>
          )}

          {/* Locked Wallet Warning */}
          {walletState === "locked" && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-700 dark:text-amber-400">
                    Wallet is locked
                  </p>
                  <p className="text-sm text-amber-600 dark:text-amber-500 mt-1">
                    Please unlock your {wallet?.adapter.name || "wallet"} to continue signing in.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Wallet Connect */}
          <div className="space-y-4">
            {walletState === "disconnected" && (
              <Button
                onClick={handleConnectWallet}
                variant="primary"
                size="lg"
                className="w-full"
                disabled={isLoading}
              >
                <Wallet className="w-5 h-5" />
                Connect Wallet
              </Button>
            )}

            {walletState === "connecting" && (
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                disabled
              >
                <Loader2 className="w-5 h-5 animate-spin" />
                Connecting...
              </Button>
            )}

            {walletState === "locked" && (
              <Button
                onClick={() => {
                  // Try to trigger unlock by requesting signature
                  handleWalletAuth();
                }}
                variant="secondary"
                size="lg"
                className="w-full"
                disabled={isLoading}
              >
                <RefreshCw className="w-5 h-5" />
                Try Again After Unlocking
              </Button>
            )}

            {walletState === "ready" && (
              <Button
                onClick={handleWalletAuth}
                variant="primary"
                size="lg"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <Wallet className="w-5 h-5" />
                    Sign Message to Continue
                  </>
                )}
              </Button>
            )}

            {/* Connected wallet info */}
            {(walletState === "ready" || walletState === "locked") && publicKey && (
              <div className="text-center">
                <p className="text-sm text-zinc-500">
                  Connected: {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
                </p>
                <button
                  onClick={handleConnectWallet}
                  className="text-sm text-green-600 dark:text-green-400 hover:underline mt-1"
                >
                  Change wallet
                </button>
              </div>
            )}
          </div>

          {/* Info about wallet auth */}
          <div className="mt-8 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              <strong>Why wallet?</strong> Your Solana wallet is your identity.
              Sign a message to prove ownership - no password needed!
            </p>
          </div>

          {/* Sign Up Link */}
          <p className="mt-8 text-center text-sm text-zinc-500">
            Don't have an account?{" "}
            <Link
              href="/auth/signup"
              className="font-medium text-green-600 dark:text-green-400 hover:underline"
            >
              Sign up
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-zinc-400">
          By signing in, you agree to our{" "}
          <Link href="/terms" className="underline hover:text-zinc-600">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-zinc-600">
            Privacy Policy
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <SignInContent />
    </Suspense>
  );
}
