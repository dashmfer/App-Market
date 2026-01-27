import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/db";
import { verifyWalletSignature } from "@/lib/wallet-verification";
import { NextRequest } from "next/server";
import { getToken as nextAuthGetToken } from "next-auth/jwt";

// Get the secret - must be set in environment
const secret = process.env.NEXTAUTH_SECRET;

if (!secret && process.env.NODE_ENV === "production") {
  throw new Error("NEXTAUTH_SECRET must be set in production");
}

// Helper function to get token from request with proper secret
export async function getAuthToken(req: NextRequest) {
  const cookieName = process.env.NODE_ENV === "production"
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";

  return nextAuthGetToken({
    req,
    secret: secret || "development-secret-change-in-production",
    cookieName,
  });
}

export const authOptions: NextAuthOptions = {
  // Don't use adapter with credentials provider + JWT
  // adapter: PrismaAdapter(prisma) as any,
  secret: secret || "development-secret-change-in-production",
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

        return {
          id: result.user.id,
          email: result.user.email,
          name: result.user.username,
          walletAddress: result.user.walletAddress,
        };
      },
    }),
    // Privy provider - for email/Twitter users authenticated via Privy
    // This trusts that Privy has already verified the user
    CredentialsProvider({
      id: "privy",
      name: "Privy",
      credentials: {
        userId: { label: "User ID", type: "text" },
        walletAddress: { label: "Wallet Address", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.userId) {
          throw new Error("Missing user ID");
        }

        // Look up the user in our database
        const user = await prisma.user.findUnique({
          where: { id: credentials.userId },
          select: {
            id: true,
            email: true,
            username: true,
            walletAddress: true,
          },
        });

        if (!user) {
          throw new Error("User not found");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.username,
          walletAddress: user.walletAddress || credentials.walletAddress,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
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
  }
}
