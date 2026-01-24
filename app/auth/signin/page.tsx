"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { motion } from "framer-motion";
import {
  Wallet,
  Loader2,
  AlertCircle,
  Lock,
  Mail,
  Twitter,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Separate component for Privy login buttons to avoid hook issues
function PrivyLoginButtons({
  onEmailClick,
  onTwitterClick
}: {
  onEmailClick: () => void;
  onTwitterClick: () => void;
}) {
  // Only import and use Privy hooks if configured
  const privyConfigured = typeof window !== 'undefined' && !!process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!privyConfigured) {
    return (
      <>
        <Button
          onClick={() => alert("Email login is not configured yet. Please use wallet login.")}
          variant="secondary"
          size="lg"
          className="w-full justify-between"
        >
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5" />
            <span>Continue with Email</span>
          </div>
          <ArrowRight className="w-4 h-4" />
        </Button>

        <Button
          onClick={() => alert("Twitter login is not configured yet. Please use wallet login.")}
          variant="secondary"
          size="lg"
          className="w-full justify-between"
        >
          <div className="flex items-center gap-3">
            <Twitter className="w-5 h-5" />
            <span>Continue with X</span>
          </div>
          <ArrowRight className="w-4 h-4" />
        </Button>
      </>
    );
  }

  // When Privy is configured, render the real buttons
  return <PrivyEnabledButtons onEmailClick={onEmailClick} onTwitterClick={onTwitterClick} />;
}

// This component only renders when Privy is configured
function PrivyEnabledButtons({
  onEmailClick,
  onTwitterClick
}: {
  onEmailClick: () => void;
  onTwitterClick: () => void;
}) {
  // Dynamic import to avoid issues when Privy is not configured
  const { useLogin } = require("@privy-io/react-auth");
  const { login } = useLogin();

  const handleEmailLogin = () => {
    onEmailClick();
    login();
  };

  const handleTwitterLogin = () => {
    onTwitterClick();
    login();
  };

  return (
    <>
      <Button
        onClick={handleEmailLogin}
        variant="secondary"
        size="lg"
        className="w-full justify-between"
      >
        <div className="flex items-center gap-3">
          <Mail className="w-5 h-5" />
          <span>Continue with Email</span>
        </div>
        <ArrowRight className="w-4 h-4" />
      </Button>

      <Button
        onClick={handleTwitterLogin}
        variant="secondary"
        size="lg"
        className="w-full justify-between"
      >
        <div className="flex items-center gap-3">
          <Twitter className="w-5 h-5" />
          <span>Continue with X</span>
        </div>
        <ArrowRight className="w-4 h-4" />
      </Button>
    </>
  );
}

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const error = searchParams.get("error");

  const { status } = useSession();
  const { connected, publicKey, signMessage, connecting, wallet } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();

  const [authMethod, setAuthMethod] = useState<"wallet" | "email" | "twitter" | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (status === "authenticated") {
      router.push(callbackUrl);
    }
  }, [status, router, callbackUrl]);

  // Detect wallet states
  const isWalletLocked = connected && publicKey && !signMessage;
  const isWalletReady = connected && publicKey && signMessage;

  const handleConnectWallet = () => {
    setAuthMethod("wallet");
    setWalletModalVisible(true);
  };

  const errorMessages: Record<string, string> = {
    OAuthSignin: "Error starting sign in",
    OAuthCallback: "Error during callback",
    Callback: "Error during callback",
    default: "Unable to sign in",
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
              Welcome to App Market
            </h1>
            <p className="mt-2 text-zinc-500">
              Sign in or create an account to get started
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">
                  {errorMessages[error] || errorMessages.default}
                </span>
              </div>
            </div>
          )}

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

          {/* Auth Options */}
          <div className="space-y-3">
            {/* Wallet Option */}
            {!connected && !connecting && (
              <Button
                onClick={handleConnectWallet}
                variant="primary"
                size="lg"
                className="w-full justify-between"
              >
                <div className="flex items-center gap-3">
                  <Wallet className="w-5 h-5" />
                  <span>Continue with Wallet</span>
                </div>
                <ArrowRight className="w-4 h-4" />
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
                Signing in...
              </Button>
            )}

            {/* Divider */}
            {!connecting && !isWalletReady && (
              <>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-200 dark:border-zinc-700" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-3 bg-white dark:bg-zinc-900 text-zinc-500">
                      or
                    </span>
                  </div>
                </div>

                {/* Email & Twitter Options */}
                <PrivyLoginButtons
                  onEmailClick={() => setAuthMethod("email")}
                  onTwitterClick={() => setAuthMethod("twitter")}
                />
              </>
            )}

            {/* Change wallet option when connected */}
            {connected && publicKey && !isWalletReady && (
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

          {/* New to crypto info */}
          <div className="mt-8 p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-300 text-sm">
                  New to crypto?
                </p>
                <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                  No wallet? No problem. Sign up with email or X and we'll create one for you automatically.
                </p>
              </div>
            </div>
          </div>
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
