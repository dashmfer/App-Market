"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { ReactNode } from "react";

interface PrivyAuthProviderProps {
  children: ReactNode;
}

export function PrivyAuthProvider({ children }: PrivyAuthProviderProps) {
  const router = useRouter();

  // Check if Privy is configured
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  // If Privy is not configured, just render children without the provider
  if (!privyAppId) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      onSuccess={() => {
        // Redirect to dashboard after successful login
        router.push("/dashboard");
      }}
      config={{
        // Appearance
        appearance: {
          theme: "dark",
          accentColor: "#22c55e", // Green to match the app theme
          logo: "/logo.png",
          showWalletLoginFirst: false,
        },
        // Login methods - email, twitter, and external wallets
        loginMethods: ["email", "twitter", "wallet"],
        // Embedded wallet config for Solana
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
          noPromptOnSignature: false,
        },
        // Solana config
        solanaClusters: [
          {
            name: "mainnet-beta",
            rpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
          },
          {
            name: "devnet",
            rpcUrl: "https://api.devnet.solana.com",
          },
        ],
        // Legal
        legal: {
          termsAndConditionsUrl: "/terms",
          privacyPolicyUrl: "/privacy",
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
