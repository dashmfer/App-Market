"use client";

import { ReactNode, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  CoinbaseWalletAdapter,
  LedgerWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { WalletAuthProvider } from "./providers/WalletAuthProvider";
import { LocaleProvider } from "./providers/LocaleProvider";

// Import wallet adapter styles
import "@solana/wallet-adapter-react-ui/styles.css";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  // You can also provide a custom RPC endpoint
  const endpoint = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl("devnet");
    console.log("[Solana] RPC endpoint:", url);
    console.log("[Solana] NEXT_PUBLIC_SOLANA_RPC_URL:", process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "NOT SET");
    return url;
  }, []);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new CoinbaseWalletAdapter(),
      new LedgerWalletAdapter(),
    ],
    []
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <SessionProvider
        refetchInterval={5 * 60}
        refetchOnWindowFocus={true}
        basePath="/api/auth"
      >
        <ConnectionProvider endpoint={endpoint}>
          <WalletProvider wallets={wallets} autoConnect>
            <WalletModalProvider>
              <WalletAuthProvider>
                <LocaleProvider>
                  {children}
                </LocaleProvider>
              </WalletAuthProvider>
            </WalletModalProvider>
          </WalletProvider>
        </ConnectionProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
