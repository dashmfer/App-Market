import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import prisma from "@/lib/db";
import { verifyWalletSignature } from "@/lib/wallet-verification";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      profile(profile) {
        return {
          id: profile.id.toString(),
          name: profile.name || profile.login,
          email: profile.email,
          image: profile.avatar_url,
          githubId: profile.id.toString(),
          githubUsername: profile.login,
        };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_ID!,
      clientSecret: process.env.GOOGLE_SECRET!,
    }),
    CredentialsProvider({
      id: "credentials",
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.passwordHash) {
          throw new Error("Invalid credentials");
        }

        const isValid = await compare(credentials.password, user.passwordHash);

        if (!isValid) {
          throw new Error("Invalid credentials");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
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
    async jwt({ token, user, account }) {
      console.log('[Auth JWT Callback] Starting JWT callback', {
        hasToken: !!token,
        hasUser: !!user,
        hasAccount: !!account,
        tokenId: token?.id,
        userId: user?.id,
        accountProvider: account?.provider,
      });

      if (user) {
        token.id = user.id;
        console.log('[Auth JWT Callback] Set token.id from user:', token.id);
      }

      if (account?.provider === "github") {
        console.log('[Auth JWT Callback] Linking GitHub account');
        try {
          // Link GitHub account data
          await prisma.user.update({
            where: { id: token.id as string },
            data: {
              githubId: account.providerAccountId,
            },
          });
        } catch (error) {
          console.error('[Auth JWT Callback] Failed to link GitHub account:', error);
        }
      }

      console.log('[Auth JWT Callback] Final token.id:', token.id);
      return token;
    },
    async session({ session, token }) {
      console.log('[Auth Session Callback] Starting session callback', {
        hasSession: !!session,
        hasSessionUser: !!session?.user,
        hasToken: !!token,
        tokenId: token?.id,
      });

      if (session.user) {
        // First, set the ID from the token
        session.user.id = token.id as string;

        console.log('[Auth Session Callback] Set user ID from token:', session.user.id);

        // Only fetch additional data if we have a valid ID
        if (token.id) {
          try {
            // Fetch additional user data including image
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

            console.log('[Auth Session Callback] Database query result:', {
              found: !!user,
              username: user?.username,
              hasImage: !!user?.image,
            });

            if (user) {
              (session.user as any).username = user.username;
              (session.user as any).walletAddress = user.walletAddress;
              (session.user as any).isVerified = user.isVerified;
              (session.user as any).githubUsername = user.githubUsername;
              // Update session with current image from database
              session.user.image = user.image;
            } else {
              console.error('[Auth Session Callback] User not found in database:', token.id);
            }
          } catch (error) {
            console.error('[Auth Session Callback] Database error:', error);
            // Don't throw - allow session to continue with just the ID
          }
        } else {
          console.error('[Auth Session Callback] Token ID is missing!');
        }
      } else {
        console.error('[Auth Session Callback] session.user is missing!');
      }

      console.log('[Auth Session Callback] Final session:', {
        hasUser: !!session.user,
        userId: session.user?.id,
        userEmail: session.user?.email,
        userName: session.user?.name,
      });

      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // Generate username from email or name
      const baseUsername = (user.email?.split("@")[0] || user.name?.toLowerCase().replace(/\s/g, "_") || "user")
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
