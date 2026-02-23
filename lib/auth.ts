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
import { PrivyClient } from "@privy-io/server-auth";

const privyClient = process.env.PRIVY_APP_ID && process.env.PRIVY_APP_SECRET
  ? new PrivyClient(process.env.PRIVY_APP_ID, process.env.PRIVY_APP_SECRET)
  : null;

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
  // 8 bytes = 64 bits of entropy (consistent with wallet-verification.ts)
  return crypto.randomBytes(8).toString("hex").toLowerCase();
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
  const revocations = sessions.map((session: { sessionToken: string }) =>
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
        const messageValidation = await validateWalletSignatureMessage(
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
        privyToken: { label: "Privy Token", type: "text" },
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

        // SECURITY: Verify the Privy auth token server-side
        if (!privyClient) {
          throw new Error("Privy is not configured on the server");
        }

        // The client should send the Privy auth token for verification
        const privyToken = credentials.privyToken;
        if (!privyToken) {
          throw new Error("Missing Privy authentication token");
        }

        // SECURITY: Verify Privy token AND fetch server-side user data
        // Never trust client-supplied wallet/email/twitter — only use Privy-verified values
        let verifiedWallet: string | null = null;
        let verifiedEmail: string | null = null;
        let verifiedTwitter: string | null = null;

        try {
          const verifiedClaims = await privyClient.verifyAuthToken(privyToken);
          // Ensure the verified Privy user ID matches the claimed one
          if (verifiedClaims.userId !== credentials.privyUserId) {
            throw new Error("Privy user ID mismatch");
          }

          // SECURITY: Fetch the user's linked accounts from Privy's server
          // This is the authoritative source — client-supplied values are IGNORED
          const privyUser = await privyClient.getUser(verifiedClaims.userId);

          verifiedWallet = privyUser.wallet?.address || null;
          verifiedEmail = privyUser.email?.address || null;
          verifiedTwitter = privyUser.twitter?.username || null;
        } catch (verifyError: any) {
          console.error("[Privy Auth] Token verification failed:", verifyError.message);
          throw new Error("Invalid Privy authentication token");
        }

        // Find or create user by Privy ID
        let user = await prisma.user.findUnique({
          where: { privyUserId: credentials.privyUserId },
        });

        if (!user) {
          // Check if user exists by wallet address (only use Privy-verified wallet)
          if (verifiedWallet) {
            user = await prisma.user.findUnique({
              where: { walletAddress: verifiedWallet },
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

          // Check if user exists by email (only use Privy-verified email)
          if (!user && verifiedEmail) {
            user = await prisma.user.findUnique({
              where: { email: verifiedEmail },
            });

            if (user) {
              // Link existing email user to Privy
              user = await prisma.user.update({
                where: { id: user.id },
                data: {
                  privyUserId: credentials.privyUserId,
                  authMethod: mapAuthMethod(credentials.authMethod),
                  walletAddress: verifiedWallet || user.walletAddress,
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

          // Generate username from Privy-verified sources only
          let username = verifiedTwitter
            || verifiedEmail?.split("@")[0]
            || `user_${Date.now().toString(36)}`;

          // Ensure username is unique
          const existingUser = await prisma.user.findUnique({ where: { username } });
          if (existingUser) {
            username = `${username}_${Date.now().toString(36)}`;
          }

          user = await prisma.user.create({
            data: {
              privyUserId: credentials.privyUserId,
              walletAddress: verifiedWallet,
              email: verifiedEmail,
              twitterUsername: verifiedTwitter,
              twitterVerified: !!verifiedTwitter,
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
        } else {
          // Update user with latest Privy-verified info
          const updateData: any = {};

          // SECURITY: Only use Privy-verified values, check uniqueness before linking
          if (verifiedWallet && !user.walletAddress) {
            const existing = await prisma.user.findUnique({
              where: { walletAddress: verifiedWallet },
              select: { id: true },
            });
            if (!existing) {
              updateData.walletAddress = verifiedWallet;
            }
          }
          if (verifiedEmail && !user.email) {
            const existing = await prisma.user.findUnique({
              where: { email: verifiedEmail },
              select: { id: true },
            });
            if (!existing) {
              updateData.email = verifiedEmail;
            }
          }
          if (verifiedTwitter && !user.twitterUsername) {
            const existing = await prisma.user.findFirst({
              where: { twitterUsername: verifiedTwitter },
              select: { id: true },
            });
            if (!existing) {
              updateData.twitterUsername = verifiedTwitter;
              updateData.twitterVerified = true;
            }
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
    async jwt({ token, user, trigger }) {
      // When signing in, add user data to token
      if (user) {
        token.id = user.id;
        token.walletAddress = (user as any).walletAddress;
        token.sessionId = (user as any).sessionId; // For session revocation

        // Fetch isAdmin status at sign-in
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { isAdmin: true },
        });
        token.isAdmin = dbUser?.isAdmin ?? false;
      }

      // Re-check isAdmin from database on every JWT refresh
      // Prevents stale admin status if role is revoked between token refreshes
      if (token.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { isAdmin: true },
          });
          token.isAdmin = dbUser?.isAdmin || false;
        } catch {
          token.isAdmin = false;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.walletAddress = token.walletAddress;

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
                isAdmin: true,
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
                } else if (anySolanaWallet) {
                  walletAddress = anySolanaWallet.walletAddress;
                }
              }

              // Update session with latest user data
              session.user.name = user.displayName || user.name;
              session.user.displayName = user.displayName;
              session.user.username = user.username;
              session.user.walletAddress = walletAddress;
              session.user.isVerified = user.isVerified;
              session.user.githubUsername = user.githubUsername;
              session.user.isAdmin = user.isAdmin;
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
      displayName?: string | null;
      username?: string | null;
      walletAddress?: string | null;
      isVerified?: boolean;
      githubUsername?: string | null;
      isAdmin?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    walletAddress?: string;
    sessionId?: string;
    isAdmin?: boolean;
  }
}
