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
  const { toSolanaWalletConnectors } = require("@privy-io/react-auth/solana");

  // Initialize Solana wallet connectors
  const solanaConnectors = toSolanaWalletConnectors();

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#22c55e",
          logo: "/logo.png",
          showWalletLoginFirst: false,
          // This is the key setting - restricts to Solana only
          walletChainType: "solana-only",
        },
        loginMethods: ["email", "twitter", "wallet"],
        // Configure external Solana wallets
        externalWallets: {
          solana: {
            connectors: solanaConnectors,
          },
        },
        // Embedded wallet creation - will create Solana wallets due to walletChainType
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
