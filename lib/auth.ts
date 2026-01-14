import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import prisma from "@/lib/db";

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
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
      }
      if (account?.provider === "github") {
        // Link GitHub account data
        await prisma.user.update({
          where: { id: token.id as string },
          data: {
            githubId: account.providerAccountId,
          },
        });
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;

        // Fetch additional user data
        const user = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            username: true,
            walletAddress: true,
            isVerified: true,
            githubUsername: true,
          },
        });

        if (user) {
          (session.user as any).username = user.username;
          (session.user as any).walletAddress = user.walletAddress;
          (session.user as any).isVerified = user.isVerified;
          (session.user as any).githubUsername = user.githubUsername;
        }
      }
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
