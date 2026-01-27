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

  // Try to import Solana wallet connectors (may not be available in all versions)
  let solanaConnectors: any = undefined;
  try {
    const solanaModule = require("@privy-io/react-auth/solana");
    if (solanaModule?.toSolanaWalletConnectors) {
      solanaConnectors = solanaModule.toSolanaWalletConnectors();
    }
  } catch (e) {
    console.warn("Solana wallet connectors not available:", e);
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#22c55e",
          showWalletLoginFirst: false,
          // This is the key setting - restricts to Solana only
          walletChainType: "solana-only",
        },
        loginMethods: ["email", "twitter", "wallet"],
        // Configure external Solana wallets (if connectors are available)
        ...(solanaConnectors && {
          externalWallets: {
            solana: {
              connectors: solanaConnectors,
            },
          },
        }),
        // Embedded wallet creation - use nested solana config for v3.0+
        // This explicitly creates Solana wallets instead of Ethereum
        embeddedWallets: {
          solana: {
            createOnLogin: "users-without-wallets",
          },
          noPromptOnSignature: false,
        },
        // Configure Solana cluster based on NEXT_PUBLIC_SOLANA_NETWORK
        // Only include the active network to avoid cross-network issues
        solanaClusters: [
          {
            name: process.env.NEXT_PUBLIC_SOLANA_NETWORK === "devnet" ? "devnet" : "mainnet-beta",
            rpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
              (process.env.NEXT_PUBLIC_SOLANA_NETWORK === "devnet"
                ? "https://api.devnet.solana.com"
                : "https://api.mainnet-beta.solana.com"),
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
