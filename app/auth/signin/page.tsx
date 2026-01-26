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
  onTwitterClick,
  onAuthComplete,
  onAuthError,
}: {
  onEmailClick: () => void;
  onTwitterClick: () => void;
  onAuthComplete: () => void;
  onAuthError: (error: string) => void;
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
  return (
    <PrivyEnabledButtons
      onEmailClick={onEmailClick}
      onTwitterClick={onTwitterClick}
      onAuthComplete={onAuthComplete}
      onAuthError={onAuthError}
    />
  );
}

// This component only renders when Privy is configured
function PrivyEnabledButtons({
  onEmailClick,
  onTwitterClick,
  onAuthComplete,
  onAuthError,
}: {
  onEmailClick: () => void;
  onTwitterClick: () => void;
  onAuthComplete: () => void;
  onAuthError: (error: string) => void;
}) {
  // Dynamic import to avoid issues when Privy is not configured
  const { useLogin, usePrivy } = require("@privy-io/react-auth");
  const { authenticated, ready, getAccessToken, logout, user: privyUser } = usePrivy();
  const { signIn } = require("next-auth/react");
  const [isProcessing, setIsProcessing] = useState(false);

  // Try to get Solana wallet creation hook
  let createSolanaWallet: (() => Promise<any>) | null = null;
  try {
    const { useSolanaWallets } = require("@privy-io/react-auth/solana");
    const solanaWallets = useSolanaWallets();
    createSolanaWallet = solanaWallets?.createWallet;
  } catch (e) {
    console.log("Solana wallet hook not available");
  }

  // If already authenticated with Privy, complete the auth flow
  useEffect(() => {
    if (ready && authenticated && !isProcessing) {
      completePrivyAuth();
    }
  }, [ready, authenticated]);

  const completePrivyAuth = async () => {
    setIsProcessing(true);
    try {
      // Get the Privy access token
      const accessToken = await getAccessToken();
      if (!accessToken) {
        // If we can't get an access token, log out and let user re-auth
        await logout();
        setIsProcessing(false);
        return;
      }

      // Check if user has a Solana wallet, if not create one
      const hasSolanaWallet = privyUser?.linkedAccounts?.some(
        (account: any) =>
          account.type === "wallet" &&
          account.walletClientType === "privy" &&
          (account.chainType === "solana" || !account.address?.startsWith("0x"))
      );

      if (!hasSolanaWallet && createSolanaWallet) {
        console.log("[Signin] No Solana wallet found, creating one...");
        try {
          const newWallet = await createSolanaWallet();
          console.log("[Signin] Created Solana wallet:", newWallet?.address);
          // Wait a moment for wallet to be reflected in user data
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (walletError: any) {
          console.error("[Signin] Failed to create Solana wallet:", walletError);
          // Continue anyway - backend will handle missing wallet
        }
      }

      // Get fresh access token after wallet creation
      const freshAccessToken = await getAccessToken();

      // Call our backend to sync the user
      const response = await fetch("/api/auth/privy/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: freshAccessToken || accessToken }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to sync user");
      }

      const data = await response.json();

      // Sign in with NextAuth using the privy credential
      const result = await signIn("privy", {
        userId: data.user.id,
        walletAddress: data.user.walletAddress || "",
        redirect: false,
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      onAuthComplete();
    } catch (error: any) {
      console.error("Privy auth completion error:", error);
      // Log out of Privy so user can try again
      try {
        await logout();
      } catch (logoutError) {
        console.error("Failed to logout from Privy:", logoutError);
      }
      // Show the specific error message
      const errorMessage = error.message || "Authentication failed";
      onAuthError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const { login } = useLogin({
    onComplete: async (user: any, isNewUser: boolean, wasAlreadyAuthenticated: boolean) => {
      // After Privy authentication completes, sync with our backend
      await completePrivyAuth();
    },
    onError: (error: any) => {
      console.error("Privy login error:", error);
      onAuthError(error?.message || "Login failed");
    },
  });

  const handleEmailLogin = () => {
    onEmailClick();
    login();
  };

  const handleTwitterLogin = () => {
    onTwitterClick();
    login();
  };

  if (isProcessing) {
    return (
      <Button variant="secondary" size="lg" className="w-full" disabled>
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Setting up your account...
      </Button>
    );
  }

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
  const [privyError, setPrivyError] = useState<string | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (status === "authenticated") {
      router.push(callbackUrl);
    }
  }, [status, router, callbackUrl]);

  // Handlers for Privy authentication
  const handlePrivyAuthComplete = () => {
    // Redirect to dashboard after successful auth
    router.push(callbackUrl);
  };

  const handlePrivyAuthError = (errorMessage: string) => {
    setPrivyError(errorMessage);
  };

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
          {(error || privyError) && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">
                  {privyError || errorMessages[error!] || errorMessages.default}
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
                  onEmailClick={() => {
                    setPrivyError(null);
                    setAuthMethod("email");
                  }}
                  onTwitterClick={() => {
                    setPrivyError(null);
                    setAuthMethod("twitter");
                  }}
                  onAuthComplete={handlePrivyAuthComplete}
                  onAuthError={handlePrivyAuthError}
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
