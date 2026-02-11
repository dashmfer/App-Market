import { useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSession, signIn } from 'next-auth/react';
import bs58 from 'bs58';

/**
 * Get referral code from cookie or URL params
 */
function getReferralCode(): string | null {
  if (typeof window === 'undefined') return null;

  // Try URL params first (/?ref=code)
  const urlParams = new URLSearchParams(window.location.search);
  const refFromUrl = urlParams.get('ref');
  if (refFromUrl) return refFromUrl;

  // SECURITY [L7]: The referral cookie is httpOnly, so this client-side read
  // will return undefined. The referral code is passed via URL params instead.
  // Try cookie (set by /r/[code] route)
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'referral_code') {
      return decodeURIComponent(value);
    }
  }

  return null;
}

/**
 * Automatically authenticate wallet connection with NextAuth
 * This creates a proper session when a wallet connects
 */
export function useAutoWalletAuth() {
  const { publicKey, signMessage, connected } = useWallet();
  const { data: session, status } = useSession();
  const isAuthenticating = useRef(false);
  const lastAuthenticatedWallet = useRef<string | null>(null);

  useEffect(() => {
    // Don't run if:
    // - Wallet not connected
    // - Already authenticated
    // - Currently authenticating
    // - No signMessage function
    // - Already authenticated this wallet
    if (
      !connected ||
      !publicKey ||
      !signMessage ||
      status === 'authenticated' ||
      status === 'loading' ||
      isAuthenticating.current ||
      lastAuthenticatedWallet.current === publicKey.toBase58()
    ) {
      return;
    }

    const authenticateWallet = async () => {
      isAuthenticating.current = true;

      try {
        console.log('[Auto Wallet Auth] Starting automatic authentication for wallet:', publicKey.toBase58());

        // Get referral code if present
        const referralCode = getReferralCode();
        if (referralCode) {
          console.log('[Auto Wallet Auth] Found referral code:', referralCode);
        }

        // Create message to sign
        const message = `Sign this message to authenticate with App Market.\n\nWallet: ${publicKey.toBase58()}\nTimestamp: ${new Date().toISOString()}`;
        const encodedMessage = new TextEncoder().encode(message);

        console.log('[Auto Wallet Auth] Requesting signature from wallet...');

        // Request signature from wallet
        const signature = await signMessage(encodedMessage);
        const signatureBase58 = bs58.encode(signature);

        console.log('[Auto Wallet Auth] Signature received, authenticating with NextAuth...');

        // Authenticate with NextAuth (include referral code if present)
        const result = await signIn('wallet', {
          publicKey: publicKey.toBase58(),
          signature: signatureBase58,
          message,
          referralCode: referralCode || '',
          redirect: false,
        });

        if (result?.error) {
          console.error('[Auto Wallet Auth] Authentication failed:', result.error);
        } else {
          console.log('[Auto Wallet Auth] Authentication successful!');
          lastAuthenticatedWallet.current = publicKey.toBase58();
        }
      } catch (error: any) {
        // Don't show error if user rejected signature
        if (!error.message?.includes('User rejected') && !error.message?.includes('rejected')) {
          console.error('[Auto Wallet Auth] Error:', error);
        } else {
          console.log('[Auto Wallet Auth] User rejected signature request');
        }
      } finally {
        isAuthenticating.current = false;
      }
    };

    // Small delay to ensure wallet is fully connected
    const timeout = setTimeout(() => {
      authenticateWallet();
    }, 500);

    return () => clearTimeout(timeout);
  }, [connected, publicKey, signMessage, status]);

  // Reset when wallet disconnects
  useEffect(() => {
    if (!connected) {
      lastAuthenticatedWallet.current = null;
    }
  }, [connected]);
}
