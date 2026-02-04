import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/db";
import { verifyWalletSignature } from "@/lib/wallet-verification";
import { NextRequest } from "next/server";
import { getToken as nextAuthGetToken } from "next-auth/jwt";
import crypto from "crypto";
import { validateWalletSignatureMessage } from "@/lib/validation";
import { AuthMethod } from "@/lib/prisma-enums";

/**
 * Map auth method string to Prisma enum
 */
function mapAuthMethod(method: string | undefined): AuthMethod {
  switch (method) {
    case "email":
      return "PRIVY_EMAIL";
    case "twitter":
      return "PRIVY_TWITTER";
    case "wallet":
    default:
      return "WALLET";
  }
}

/**
 * Generate a unique referral code for new users
 */
function generateUserReferralCode(): string {
  return crypto.randomBytes(4).toString("hex").toLowerCase();
}

// SECURITY: Secret MUST be set in all environments
const secret = process.env.NEXTAUTH_SECRET;

if (!secret) {
  throw new Error("NEXTAUTH_SECRET must be set in environment variables");
}

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Revoke a specific session (database-backed for multi-instance/serverless support)
 * Session revocations persist in the database to work across serverless function instances
 */
export async function revokeSession(sessionId: string, reason?: string): Promise<void> {
  // Session revocations expire after 7 days (max JWT lifetime)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.revokedSession.upsert({
    where: { sessionId },
    create: {
      sessionId,
      reason,
      expiresAt,
    },
    update: {
      reason,
      revokedAt: new Date(),
    },
  });
}

/**
 * Revoke all sessions for a user (database-backed)
 * Creates revocation records for all active sessions belonging to the user
 */
export async function revokeAllUserSessions(userId: string, reason?: string): Promise<number> {
  // Get all active JWT sessions for this user from the Session table
  const sessions = await prisma.session.findMany({
    where: { userId },
    select: { sessionToken: true },
  });

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Revoke each session
  const revocations = sessions.map(session =>
    prisma.revokedSession.upsert({
      where: { sessionId: session.sessionToken },
      create: {
        sessionId: session.sessionToken,
        userId,
        reason: reason || 'revoke_all_sessions',
        expiresAt,
      },
      update: {
        reason: reason || 'revoke_all_sessions',
        revokedAt: new Date(),
      },
    })
  );

  await Promise.all(revocations);

  // Also delete from Session table to prevent re-use
  await prisma.session.deleteMany({
    where: { userId },
  });

  return sessions.length;
}

/**
 * Check if a session has been revoked (database-backed)
 * NOTE: This only checks the revocation blacklist - it does NOT validate
 * that a session ID was ever created. For JWT-based auth, session validity
 * is determined by the JWT itself; this function only checks revocation.
 */
export async function isSessionNotRevoked(sessionId: string): Promise<boolean> {
  const revoked = await prisma.revokedSession.findUnique({
    where: { sessionId },
    select: { id: true },
  });
  return !revoked;
}

/**
 * Clean up expired revocation records (call from cron job or scheduled task)
 * Should be run periodically to prevent the revocation table from growing indefinitely
 */
export async function cleanupExpiredRevocations(): Promise<number> {
  const result = await prisma.revokedSession.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
  return result.count;
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

  // SECURITY: Check if session has been revoked (database lookup)
  if (token?.sessionId && !(await isSessionNotRevoked(token.sessionId as string))) {
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
        // Session ID is stored in JWT, revocations are tracked in database
        const sessionId = generateSessionId();

        return {
          id: result.user.id,
          email: result.user.email,
          name: result.user.username,
          walletAddress: result.user.walletAddress,
          sessionId,
        };
      },
    }),

    // Privy provider - unified auth (wallet, email, twitter)
    CredentialsProvider({
      id: "privy",
      name: "Privy",
      credentials: {
        privyUserId: { label: "Privy User ID", type: "text" },
        walletAddress: { label: "Wallet Address", type: "text" },
        email: { label: "Email", type: "text" },
        twitterUsername: { label: "Twitter Username", type: "text" },
        authMethod: { label: "Auth Method", type: "text" },
        referralCode: { label: "Referral Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.privyUserId) {
          throw new Error("Missing Privy user ID");
        }

        // Find or create user by Privy ID
        let user = await prisma.user.findUnique({
          where: { privyUserId: credentials.privyUserId },
        });

        if (!user) {
          // Check if user exists by wallet address
          if (credentials.walletAddress) {
            user = await prisma.user.findUnique({
              where: { walletAddress: credentials.walletAddress },
            });

            if (user) {
              // Link existing wallet user to Privy
              user = await prisma.user.update({
                where: { id: user.id },
                data: {
                  privyUserId: credentials.privyUserId,
                  authMethod: mapAuthMethod(credentials.authMethod),
                },
              });
            }
          }

          // Check if user exists by email
          if (!user && credentials.email) {
            user = await prisma.user.findUnique({
              where: { email: credentials.email },
            });

            if (user) {
              // Link existing email user to Privy
              user = await prisma.user.update({
                where: { id: user.id },
                data: {
                  privyUserId: credentials.privyUserId,
                  authMethod: mapAuthMethod(credentials.authMethod),
                  walletAddress: credentials.walletAddress || user.walletAddress,
                },
              });
            }
          }
        }

        if (!user) {
          // Create new user
          const referralCode = generateUserReferralCode();

          // Handle referral
          let referrerId: string | undefined;
          if (credentials.referralCode) {
            const referrer = await prisma.user.findUnique({
              where: { referralCode: credentials.referralCode.toLowerCase() },
              select: { id: true },
            });
            if (referrer) {
              referrerId = referrer.id;
            }
          }

          // Generate username
          let username = credentials.twitterUsername
            || credentials.email?.split("@")[0]
            || `user_${Date.now().toString(36)}`;

          // Ensure username is unique
          const existingUser = await prisma.user.findUnique({ where: { username } });
          if (existingUser) {
            username = `${username}_${Date.now().toString(36)}`;
          }

          user = await prisma.user.create({
            data: {
              privyUserId: credentials.privyUserId,
              walletAddress: credentials.walletAddress || null,
              email: credentials.email || null,
              twitterUsername: credentials.twitterUsername || null,
              twitterVerified: !!credentials.twitterUsername,
              username,
              referralCode,
              authMethod: mapAuthMethod(credentials.authMethod),
              referredBy: referrerId,
            },
          });

          // Create referral record if applicable
          if (referrerId) {
            await prisma.referral.create({
              data: {
                referrerId,
                referredUserId: user.id,
                status: "REGISTERED",
              },
            });
          }

          console.log("[Privy Auth] Created new user:", user.id);
        } else {
          // Update user with latest info from Privy
          const updateData: any = {};

          if (credentials.walletAddress && !user.walletAddress) {
            updateData.walletAddress = credentials.walletAddress;
          }
          if (credentials.email && !user.email) {
            updateData.email = credentials.email;
          }
          if (credentials.twitterUsername && !user.twitterUsername) {
            updateData.twitterUsername = credentials.twitterUsername;
            updateData.twitterVerified = true;
          }

          if (Object.keys(updateData).length > 0) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: updateData,
            });
          }
        }

        // Generate session ID for revocation support
        // Session ID is stored in JWT, revocations are tracked in database
        const sessionId = generateSessionId();

        return {
          id: user.id,
          email: user.email,
          name: user.username,
          walletAddress: user.walletAddress,
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
                  (w: { isPrimary: boolean; walletAddress: string }) => w.isPrimary && !w.walletAddress.startsWith("0x")
                );

                // Otherwise, look for any Solana wallet in UserWallet
                const anySolanaWallet = user.wallets.find(
                  (w: { walletAddress: string }) => !w.walletAddress.startsWith("0x")
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
