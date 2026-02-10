"use client";

import { PrivyProvider, usePrivy, useWallets } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { useEffect, useRef, useCallback, createContext, useContext, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

// Solana wallet connectors - required for Phantom, Solflare, etc.
const solanaConnectors = toSolanaWalletConnectors();

// Context for Privy auth state
interface PrivyAuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any;
  login: () => void;
  logout: () => Promise<void>;
  walletAddress: string | null;
  authMethod: "wallet" | "email" | "twitter" | null;
}

const PrivyAuthContext = createContext<PrivyAuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  login: () => {},
  logout: async () => {},
  walletAddress: null,
  authMethod: null,
});

export const usePrivyAuth = () => useContext(PrivyAuthContext);

// Inner component that uses Privy hooks
function PrivyAuthSync({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user, login, logout: privyLogout } = usePrivy();
  const { wallets } = useWallets();
  const { data: session, status: sessionStatus } = useSession();
  const isSyncing = useRef(false);
  const lastSyncedPrivyId = useRef<string | null>(null);
  const [authMethod, setAuthMethod] = useState<"wallet" | "email" | "twitter" | null>(null);

  // Get the active wallet address
  const getWalletAddress = useCallback((): string | null => {
    if (!wallets || wallets.length === 0) return null;

    // Prefer Solana wallet, then any wallet
    const solanaWallet = wallets.find(w => w.walletClientType === "solana");
    if (solanaWallet) return solanaWallet.address;

    // Return first wallet if no Solana wallet
    return wallets[0]?.address || null;
  }, [wallets]);

  // Determine auth method from Privy user
  const determineAuthMethod = useCallback((privyUser: any): "wallet" | "email" | "twitter" | null => {
    if (!privyUser) return null;

    // Check linked accounts
    if (privyUser.twitter) return "twitter";
    if (privyUser.email) return "email";
    if (privyUser.wallet) return "wallet";

    return "wallet"; // Default
  }, []);

  // Sync Privy auth with NextAuth
  useEffect(() => {
    const syncAuth = async () => {
      // Wait for Privy to be ready
      if (!ready) return;

      // Prevent concurrent syncs
      if (isSyncing.current) return;

      // If Privy is authenticated but NextAuth isn't
      if (authenticated && user && sessionStatus !== "loading") {
        // Skip if we already synced this Privy user
        if (lastSyncedPrivyId.current === user.id && sessionStatus === "authenticated") {
          return;
        }

        isSyncing.current = true;

        try {
          console.log("[Privy Auth] Syncing Privy user to NextAuth:", user.id);

          const walletAddress = getWalletAddress();
          const method = determineAuthMethod(user);
          setAuthMethod(method);

          // Get referral code from cookie/URL
          const referralCode = getReferralCode();

          // Sign in with our Privy credential provider
          const result = await signIn("privy", {
            privyUserId: user.id,
            walletAddress: walletAddress || "",
            email: user.email?.address || "",
            twitterUsername: user.twitter?.username || "",
            authMethod: method || "wallet",
            referralCode: referralCode || "",
            redirect: false,
          });

          if (result?.error) {
            console.error("[Privy Auth] Sync failed:", result.error);
          } else {
            console.log("[Privy Auth] Sync successful!");
            lastSyncedPrivyId.current = user.id;
          }
        } catch (error: any) {
          console.error("[Privy Auth] Sync error:", error);
        } finally {
          isSyncing.current = false;
        }
      }

      // If Privy logged out but NextAuth is still authenticated
      if (!authenticated && sessionStatus === "authenticated") {
        console.log("[Privy Auth] Privy logged out, signing out of NextAuth");
        lastSyncedPrivyId.current = null;
        await signOut({ redirect: false });
      }
    };

    syncAuth();
  }, [ready, authenticated, user, sessionStatus, getWalletAddress, determineAuthMethod]);

  // Handle logout
  const handleLogout = useCallback(async () => {
    lastSyncedPrivyId.current = null;
    await privyLogout();
    await signOut({ redirect: false });
  }, [privyLogout]);

  const contextValue: PrivyAuthContextType = {
    isAuthenticated: authenticated && sessionStatus === "authenticated",
    isLoading: !ready || sessionStatus === "loading",
    user,
    login,
    logout: handleLogout,
    walletAddress: getWalletAddress(),
    authMethod,
  };

  return (
    <PrivyAuthContext.Provider value={contextValue}>
      {children}
    </PrivyAuthContext.Provider>
  );
}

// Get referral code from cookie or URL params
function getReferralCode(): string | null {
  if (typeof window === "undefined") return null;

  // Try URL params first (/?ref=code)
  const urlParams = new URLSearchParams(window.location.search);
  const refFromUrl = urlParams.get("ref");
  if (refFromUrl) return refFromUrl;

  // Try cookie (set by /r/[code] route)
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === "referral_code") {
      return decodeURIComponent(value);
    }
  }

  return null;
}

interface PrivyAuthProviderProps {
  children: React.ReactNode;
}

export function PrivyAuthProvider({ children }: PrivyAuthProviderProps) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    console.error("NEXT_PUBLIC_PRIVY_APP_ID is not set");
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        // Login methods - wallet first, then email, then twitter
        loginMethods: ["wallet", "email", "twitter"],

        // Appearance - sleek dark theme with green accent, Solana wallets only
        appearance: {
          theme: "dark",
          accentColor: "#22c55e",
          walletChainType: "solana-only",
          // Only show wallets that are actually installed
          walletList: ["detected_solana_wallets"],
          landingHeader: "Sign in to App Market",
          loginMessage: "Connect your wallet or sign in with email",
        },

        // Embedded Solana wallet for email/twitter users
        embeddedWallets: {
          solana: {
            createOnLogin: "users-without-wallets",
          },
        },

        // External Solana wallets (Phantom, Solflare, Backpack, etc.)
        externalWallets: {
          solana: {
            connectors: solanaConnectors,
          },
        },

        // Legal
        legal: {
          termsAndConditionsUrl: "/terms",
          privacyPolicyUrl: "/privacy",
        },
      }}
    >
      <PrivyAuthSync>{children}</PrivyAuthSync>
    </PrivyProvider>
  );
}
