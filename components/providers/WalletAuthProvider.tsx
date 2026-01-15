"use client";

import { useAutoWalletAuth } from '@/hooks/useAutoWalletAuth';

/**
 * Provider that automatically authenticates wallet connections
 * Place this high in the component tree after WalletProvider and SessionProvider
 */
export function WalletAuthProvider({ children }: { children: React.ReactNode }) {
  // This hook will automatically authenticate when wallet connects
  useAutoWalletAuth();

  return <>{children}</>;
}
