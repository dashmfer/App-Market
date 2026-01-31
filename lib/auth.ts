import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/db";
import { verifyWalletSignature } from "@/lib/wallet-verification";
import { NextRequest } from "next/server";
import { getToken as nextAuthGetToken } from "next-auth/jwt";
import crypto from "crypto";
import { validateWalletSignatureMessage } from "@/lib/validation";

// SECURITY: Secret MUST be set in all environments
const secret = process.env.NEXTAUTH_SECRET;

if (!secret) {
  throw new Error("NEXTAUTH_SECRET must be set in environment variables");
}

// Session revocation - in-memory store (use Redis in production for multi-instance)
// Maps sessionId -> userId for active sessions
const activeSessions = new Map<string, { userId: string; createdAt: Date }>();

// Revoked session IDs (blacklist)
const revokedSessions = new Set<string>();

// Clean up old sessions periodically (every hour)
setInterval(() => {
  const now = Date.now();
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
  for (const [sessionId, data] of activeSessions.entries()) {
    if (now - data.createdAt.getTime() > maxAge) {
      activeSessions.delete(sessionId);
    }
  }
}, 60 * 60 * 1000);

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Revoke a specific session
 */
export function revokeSession(sessionId: string): void {
  revokedSessions.add(sessionId);
  activeSessions.delete(sessionId);
}

/**
 * Revoke all sessions for a user
 */
export function revokeAllUserSessions(userId: string): number {
  let count = 0;
  for (const [sessionId, data] of activeSessions.entries()) {
    if (data.userId === userId) {
      revokedSessions.add(sessionId);
      activeSessions.delete(sessionId);
      count++;
    }
  }
  return count;
}

/**
 * Check if a session is valid (not revoked)
 */
export function isSessionValid(sessionId: string): boolean {
  return !revokedSessions.has(sessionId);
}

// Helper function to get token from request with proper secret
export async function getAuthToken(req: NextRequest) {
  const cookieName = process.env.NODE_ENV === "production"
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";

  const token = await nextAuthGetToken({
    req,
    secret,
    cookieName,
  });

  // SECURITY: Check if session has been revoked
  if (token?.sessionId && !isSessionValid(token.sessionId as string)) {
    return null;
  }

  return token;
}

export const authOptions: NextAuthOptions = {
  // Don't use adapter with credentials provider + JWT
  // adapter: PrismaAdapter(prisma) as any,
  secret,
  providers: [
    // Wallet provider - direct wallet authentication
    CredentialsProvider({
      id: "wallet",
      name: "Solana Wallet",
      credentials: {
        publicKey: { label: "Public Key", type: "text" },
        signature: { label: "Signature", type: "text" },
        message: { label: "Message", type: "text" },
        referralCode: { label: "Referral Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.publicKey || !credentials?.signature || !credentials?.message) {
          throw new Error("Missing wallet credentials");
        }

        // SECURITY: Validate message format and timestamp (replay protection)
        const messageValidation = validateWalletSignatureMessage(
          credentials.message,
          credentials.publicKey,
          300 // 5 minute validity
        );
        if (!messageValidation.valid) {
          throw new Error(messageValidation.error || "Invalid signature message");
        }

        // Verify wallet signature directly (pass referral code for new users)
        const result = await verifyWalletSignature(
          credentials.publicKey,
          credentials.signature,
          credentials.message,
          credentials.referralCode || undefined
        );

        if (!result.success || !result.user) {
          throw new Error(result.error || "Wallet verification failed");
        }

        // Generate session ID for revocation support
        const sessionId = generateSessionId();
        activeSessions.set(sessionId, {
          userId: result.user.id,
          createdAt: new Date(),
        });

        return {
          id: result.user.id,
          email: result.user.email,
          name: result.user.username,
          walletAddress: result.user.walletAddress,
          sessionId,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // SECURITY: 7 days instead of 30
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production"
        ? "__Secure-next-auth.session-token"
        : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  debug: process.env.NODE_ENV === 'development',
  callbacks: {
    async jwt({ token, user }) {
      // When signing in, add user data to token
      if (user) {
        token.id = user.id;
        token.walletAddress = (user as any).walletAddress;
        token.sessionId = (user as any).sessionId; // For session revocation
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        (session.user as any).walletAddress = token.walletAddress;

        // Fetch additional user data from database
        if (token.id) {
          try {
            const user = await prisma.user.findUnique({
              where: { id: token.id as string },
              select: {
                name: true,
                displayName: true,
                username: true,
                walletAddress: true,
                isVerified: true,
                githubUsername: true,
                image: true,
                wallets: {
                  select: {
                    walletAddress: true,
                    isPrimary: true,
                  },
                },
              },
            });

            if (user) {
              // Determine which wallet to use - prefer Solana over ETH
              let walletAddress = user.walletAddress;

              // If primary wallet is ETH (0x...), try to find a Solana wallet
              if (walletAddress?.startsWith("0x")) {
                // First, look for a Solana wallet in UserWallet that's marked as primary
                const primarySolanaWallet = user.wallets.find(
                  (w) => w.isPrimary && !w.walletAddress.startsWith("0x")
                );

                // Otherwise, look for any Solana wallet in UserWallet
                const anySolanaWallet = user.wallets.find(
                  (w) => !w.walletAddress.startsWith("0x")
                );

                if (primarySolanaWallet) {
                  walletAddress = primarySolanaWallet.walletAddress;
                  console.log("[Auth Session] Using primary Solana wallet instead of ETH:", walletAddress);
                } else if (anySolanaWallet) {
                  walletAddress = anySolanaWallet.walletAddress;
                  console.log("[Auth Session] Using Solana wallet instead of ETH:", walletAddress);
                }
              }

              // Update session with latest user data
              session.user.name = user.displayName || user.name;
              (session.user as any).displayName = user.displayName;
              (session.user as any).username = user.username;
              (session.user as any).walletAddress = walletAddress;
              (session.user as any).isVerified = user.isVerified;
              (session.user as any).githubUsername = user.githubUsername;
              session.user.image = user.image;
            }
          } catch (error) {
            console.error('[Auth Session Callback] Database error:', error);
          }
        }
      }
      return session;
    },
  },
};

// Type augmentation for next-auth
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      username?: string | null;
      walletAddress?: string | null;
      isVerified?: boolean;
      githubUsername?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    walletAddress?: string;
    sessionId?: string;
  }
}
