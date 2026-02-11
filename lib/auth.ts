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
  return crypto.randomBytes(4).toString("hex").toLowerCase();
}

// SECURITY: Secret MUST be set in all environments
const secret = process.env.NEXTAUTH_SECRET;

if (!secret) {
  throw new Error("NEXTAUTH_SECRET must be set in environment variables");
}

const KNOWN_DEFAULTS = [
  'your-super-secret-key-change-in-production',
  'your-admin-secret-change-in-production',
  'your-cron-secret-change-in-production',
];
if (process.env.NODE_ENV === 'production') {
  for (const envVar of ['NEXTAUTH_SECRET', 'ADMIN_SECRET', 'CRON_SECRET']) {
    const val = process.env[envVar];
    if (val && KNOWN_DEFAULTS.includes(val)) {
      throw new Error(`SECURITY: ${envVar} is using a known default value. Change it before deploying to production.`);
    }
  }
}

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * SECURITY [M5]: Redis keys for Edge-compatible session revocation.
 * Individual revocations are stored as `revoked:session:{id}` with 7-day TTL.
 * Bulk revocations use `revoked:user:{userId}` storing a timestamp — any JWT
 * issued before that timestamp is considered revoked (M7).
 */
const SESSION_REVOKE_PREFIX = "revoked:session:";
const USER_REVOKE_PREFIX = "revoked:user:";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days (matches JWT maxAge)

// Lazy-import Redis to avoid circular deps at module level
async function getRedis() {
  const { redis } = await import("@/lib/rate-limit");
  return redis;
}

/**
 * Revoke a specific session (database + Redis for Edge compatibility)
 */
export async function revokeSession(sessionId: string, reason?: string): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  // Database: durable record
  await prisma.revokedSession.upsert({
    where: { sessionId },
    create: { sessionId, reason, expiresAt },
    update: { reason, revokedAt: new Date() },
  });

  // SECURITY [M5]: Also write to Redis so Edge middleware can check revocation
  const redis = await getRedis();
  if (redis) {
    await redis.set(`${SESSION_REVOKE_PREFIX}${sessionId}`, "1", { ex: SESSION_TTL_SECONDS });
  }
}

/**
 * SECURITY [M7]: Revoke ALL sessions for a user via timestamp-based approach.
 * Instead of looking up sessions from the (empty) Session table, store a
 * "revoked before" timestamp in Redis and DB. Any JWT with iat < this timestamp
 * is considered revoked, regardless of whether we tracked its sessionId.
 */
export async function revokeAllUserSessions(userId: string, reason?: string): Promise<number> {
  const revokedAt = Date.now();
  const expiresAt = new Date(revokedAt + SESSION_TTL_SECONDS * 1000);

  // Store the revocation timestamp in DB for durability
  // Any existing per-session revocations for this user are redundant now
  await prisma.revokedSession.upsert({
    where: { sessionId: `user:${userId}` },
    create: {
      sessionId: `user:${userId}`,
      userId,
      reason: reason || "revoke_all_sessions",
      expiresAt,
    },
    update: {
      reason: reason || "revoke_all_sessions",
      revokedAt: new Date(),
      expiresAt,
    },
  });

  // SECURITY [M5/M7]: Write timestamp to Redis for Edge middleware
  const redis = await getRedis();
  if (redis) {
    await redis.set(`${USER_REVOKE_PREFIX}${userId}`, revokedAt.toString(), { ex: SESSION_TTL_SECONDS });
  }

  return 1; // Always succeeds — timestamp-based, not session-count-based
}

/**
 * Check if a session has been revoked (database-backed, used by API routes)
 * Checks both individual session revocation AND user-wide timestamp revocation.
 */
export async function isSessionNotRevoked(sessionId: string, userId?: string, iat?: number): Promise<boolean> {
  // Check individual session revocation
  const revoked = await prisma.revokedSession.findUnique({
    where: { sessionId },
    select: { id: true },
  });
  if (revoked) return false;

  // SECURITY [M7]: Check user-wide timestamp revocation
  if (userId && iat) {
    const userRevocation = await prisma.revokedSession.findUnique({
      where: { sessionId: `user:${userId}` },
      select: { revokedAt: true },
    });
    if (userRevocation && userRevocation.revokedAt && iat < Math.floor(userRevocation.revokedAt.getTime() / 1000)) {
      return false;
    }
  }

  return true;
}

// NOTE: isSessionNotRevokedEdge lives in lib/session-revocation-edge.ts
// to avoid pulling Prisma into the Edge Runtime bundle via this file.

/**
 * Clean up expired revocation records
 */
export async function cleanupExpiredRevocations(): Promise<number> {
  const result = await prisma.revokedSession.deleteMany({
    where: { expiresAt: { lt: new Date() } },
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
  // Passes userId + iat for M7 timestamp-based bulk revocation
  if (token?.sessionId && !(await isSessionNotRevoked(
    token.sessionId as string,
    token.id as string,
    token.iat as number | undefined
  ))) {
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

        try {
          const verifiedClaims = await privyClient.verifyAuthToken(privyToken);
          // Ensure the verified Privy user ID matches the claimed one
          if (verifiedClaims.userId !== credentials.privyUserId) {
            throw new Error("Privy user ID mismatch");
          }
        } catch (verifyError: any) {
          console.error("[Privy Auth] Token verification failed:", verifyError.message);
          throw new Error("Invalid Privy authentication token");
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

          console.log("[Privy Auth] Created new user");
        } else {
          // Update user with latest info from Privy
          const updateData: any = {};

          // SECURITY: Check uniqueness before linking wallet/email/twitter
          // Prevents one Privy account from claiming another user's identity
          if (credentials.walletAddress && !user.walletAddress) {
            const existing = await prisma.user.findUnique({
              where: { walletAddress: credentials.walletAddress },
              select: { id: true },
            });
            if (!existing) {
              updateData.walletAddress = credentials.walletAddress;
            }
          }
          if (credentials.email && !user.email) {
            const existing = await prisma.user.findUnique({
              where: { email: credentials.email },
              select: { id: true },
            });
            if (!existing) {
              updateData.email = credentials.email;
            }
          }
          if (credentials.twitterUsername && !user.twitterUsername) {
            const existing = await prisma.user.findFirst({
              where: { twitterUsername: credentials.twitterUsername },
              select: { id: true },
            });
            if (!existing) {
              updateData.twitterUsername = credentials.twitterUsername;
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
              (session.user as any).displayName = user.displayName;
              (session.user as any).username = user.username;
              (session.user as any).walletAddress = walletAddress;
              (session.user as any).isVerified = user.isVerified;
              (session.user as any).githubUsername = user.githubUsername;
              (session.user as any).isAdmin = user.isAdmin;
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
