"use client";

import { ReactNode, useMemo } from "react";
import { ConnectionProvider } from "@solana/wallet-adapter-react";
import { clusterApiUrl } from "@solana/web3.js";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { PrivyAuthProvider } from "./providers/PrivyAuthProvider";
import { LocaleProvider } from "./providers/LocaleProvider";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  // Solana RPC endpoint for transactions
  const endpoint = useMemo(() => {
    return process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl("devnet");
  }, []);

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
          <PrivyAuthProvider>
            <LocaleProvider>
              {children}
            </LocaleProvider>
          </PrivyAuthProvider>
        </ConnectionProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
