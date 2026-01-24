"use client";

import { ReactNode } from "react";

interface PrivyAuthProviderProps {
  children: ReactNode;
}

export function PrivyAuthProvider({ children }: PrivyAuthProviderProps) {
  // Check if Privy is configured
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  // If Privy is not configured, just render children without the provider
  if (!privyAppId) {
    return <>{children}</>;
  }

  // Dynamically import PrivyProvider only when configured
  const { PrivyProvider } = require("@privy-io/react-auth");

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#22c55e",
          logo: "/logo.png",
          showWalletLoginFirst: false,
        },
        loginMethods: ["email", "twitter", "wallet"],
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
          noPromptOnSignature: false,
        },
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
