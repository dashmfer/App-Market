import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/db";
import { verifyWalletSignature } from "@/lib/wallet-verification";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    // Wallet provider - only authentication method
    CredentialsProvider({
      id: "wallet",
      name: "Solana Wallet",
      credentials: {
        publicKey: { label: "Public Key", type: "text" },
        signature: { label: "Signature", type: "text" },
        message: { label: "Message", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.publicKey || !credentials?.signature || !credentials?.message) {
          throw new Error("Missing wallet credentials");
        }

        // Verify wallet signature directly (no HTTP request needed)
        const result = await verifyWalletSignature(
          credentials.publicKey,
          credentials.signature,
          credentials.message
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
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    sessionToken: {
      name: `${process.env.NODE_ENV === 'production' ? '__Secure-' : ''}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
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
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;

        if (token.id) {
          try {
            const user = await prisma.user.findUnique({
              where: { id: token.id as string },
              select: {
                username: true,
                walletAddress: true,
                isVerified: true,
                githubUsername: true,
                image: true,
              },
            });

            if (user) {
              (session.user as any).username = user.username;
              (session.user as any).walletAddress = user.walletAddress;
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
  events: {
    async createUser({ user }) {
      // Generate username from wallet address or name
      const baseUsername = (user.name?.toLowerCase().replace(/\s/g, "_") || "user")
        .slice(0, 20);

      const existingUser = await prisma.user.findFirst({
        where: { username: { startsWith: baseUsername } },
      });

      const username = existingUser
        ? `${baseUsername}_${Math.random().toString(36).slice(2, 6)}`
        : baseUsername;

      await prisma.user.update({
        where: { id: user.id },
        data: { username },
      });
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
  }
}
