"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { motion } from "framer-motion";
import {
  Wallet,
  Loader2,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SignUpPage() {
  const router = useRouter();
  const { status } = useSession();
  const { connected, publicKey, signMessage, connecting, wallet } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();

  // Redirect if already authenticated
  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  // Detect wallet states
  const isWalletLocked = connected && publicKey && !signMessage;
  const isWalletReady = connected && publicKey && signMessage;

  const handleConnectWallet = () => {
    setWalletModalVisible(true);
  };

  // Show loading while session is being established
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4 py-12">
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
              Create your account
            </h1>
            <p className="mt-2 text-zinc-500">
              Connect your wallet to get started
            </p>
          </div>

          {/* Locked Wallet Warning */}
          {isWalletLocked && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-700 dark:text-amber-400">
                    Wallet is locked
                  </p>
                  <p className="text-sm text-amber-600 dark:text-amber-500 mt-1">
                    Please unlock your {wallet?.adapter.name || "wallet"} to continue.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Wallet Connect */}
          <div className="space-y-4">
            {!connected && !connecting && (
              <Button
                onClick={handleConnectWallet}
                variant="primary"
                size="lg"
                className="w-full"
              >
                <Wallet className="w-5 h-5" />
                Connect Wallet
              </Button>
            )}

            {connecting && (
              <Button variant="primary" size="lg" className="w-full" disabled>
                <Loader2 className="w-5 h-5 animate-spin" />
                Connecting...
              </Button>
            )}

            {isWalletReady && (
              <Button variant="primary" size="lg" className="w-full" disabled>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating account...
              </Button>
            )}

            {isWalletLocked && (
              <Button
                onClick={handleConnectWallet}
                variant="secondary"
                size="lg"
                className="w-full"
              >
                <Wallet className="w-5 h-5" />
                Change Wallet
              </Button>
            )}

            {/* Connected wallet info */}
            {connected && publicKey && (
              <div className="text-center">
                <p className="text-sm text-zinc-500">
                  Connected: {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
                </p>
                {!isWalletLocked && (
                  <button
                    onClick={handleConnectWallet}
                    className="text-sm text-green-600 dark:text-green-400 hover:underline mt-1"
                  >
                    Change wallet
                  </button>
                )}
              </div>
            )}
          </div>

          {/* How it works */}
          <div className="mt-8 space-y-3">
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">How it works:</h3>
            <div className="space-y-2">
              <div className="flex items-start gap-3 text-sm">
                <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-green-600 dark:text-green-400 font-medium text-xs">1</span>
                </div>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Connect your Solana wallet (Phantom, Solflare, etc.)
                </p>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-green-600 dark:text-green-400 font-medium text-xs">2</span>
                </div>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Sign a message to prove wallet ownership
                </p>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-green-600 dark:text-green-400 font-medium text-xs">3</span>
                </div>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Start buying and selling apps!
                </p>
              </div>
            </div>
          </div>

          {/* Sign In Link */}
          <p className="mt-8 text-center text-sm text-zinc-500">
            Already have an account?{" "}
            <Link
              href="/auth/signin"
              className="font-medium text-green-600 dark:text-green-400 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>

        {/* Benefits */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          {[
            { icon: "🔒", text: "Secure escrow" },
            { icon: "⚡", text: "Instant settlement" },
            { icon: "🌍", text: "Global access" },
          ].map((benefit) => (
            <div key={benefit.text} className="text-sm text-zinc-500">
              <span className="text-2xl block mb-1">{benefit.icon}</span>
              {benefit.text}
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-zinc-400">
          By signing up, you agree to our{" "}
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
