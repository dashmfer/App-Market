"use client";

import { ReactNode, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
// clusterApiUrl removed — no devnet fallback allowed
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { PrivyAuthProvider } from "./providers/PrivyAuthProvider";
import { LocaleProvider } from "./providers/LocaleProvider";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  // SECURITY [H10]: NEXT_PUBLIC_SOLANA_RPC_URL is exposed to the client bundle.
  // Ensure this URL does not contain a private API key. Use a rate-limited
  // or public-tier RPC endpoint for client-side usage.
  // SECURITY: Never fall back to devnet — require explicit RPC URL configuration.
  const endpoint = useMemo(() => {
    const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    if (!rpc) {
      throw new Error("NEXT_PUBLIC_SOLANA_RPC_URL must be configured");
    }
    return rpc;
  }, []);

  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ], []);

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
              <PrivyAuthProvider>
                <LocaleProvider>
                  {children}
                </LocaleProvider>
              </PrivyAuthProvider>
            </WalletModalProvider>
          </WalletProvider>
        </ConnectionProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
