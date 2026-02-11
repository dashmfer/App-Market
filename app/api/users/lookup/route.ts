import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withRateLimitAsync } from "@/lib/rate-limit";

// GET /api/users/lookup?q=<wallet_or_username>
// Lookup a user by wallet address or username for collaborator auto-population
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Rate limit to prevent user enumeration
    const rateLimitResult = await (withRateLimitAsync('read', 'user-lookup'))(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: 429, headers: rateLimitResult.headers }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q")?.trim();

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: "Query must be at least 2 characters" },
        { status: 400 }
      );
    }

    // Check if it looks like a Solana wallet address (base58, typically 32-44 chars)
    const isWalletAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(query);

    let user = null;

    if (isWalletAddress) {
      // Search by exact wallet address (exclude soft-deleted)
      user = await prisma.user.findFirst({
        where: { walletAddress: query, deletedAt: null },
        select: {
          id: true,
          username: true,
          displayName: true,
          name: true,
          image: true,
          walletAddress: true,
          isVerified: true,
          twitterUsername: true,
          twitterVerified: true,
          rating: true,
          totalSales: true,
        },
      });
    } else {
      // Search by username (exact match first, then partial; exclude soft-deleted)
      user = await prisma.user.findFirst({
        where: { username: query.toLowerCase(), deletedAt: null },
        select: {
          id: true,
          username: true,
          displayName: true,
          name: true,
          image: true,
          walletAddress: true,
          isVerified: true,
          twitterUsername: true,
          twitterVerified: true,
          rating: true,
          totalSales: true,
        },
      });

      // If no exact match, try case-insensitive partial match
      if (!user) {
        user = await prisma.user.findFirst({
          where: {
            deletedAt: null,
            OR: [
              { username: { contains: query, mode: "insensitive" } },
              { displayName: { contains: query, mode: "insensitive" } },
              { twitterUsername: { contains: query, mode: "insensitive" } },
            ],
          },
          select: {
            id: true,
            username: true,
            displayName: true,
            name: true,
            image: true,
            walletAddress: true,
            isVerified: true,
            twitterUsername: true,
            twitterVerified: true,
            rating: true,
            totalSales: true,
          },
        });
      }
    }

    if (!user) {
      // Return null but not an error - wallet might not be registered yet
      return NextResponse.json({
        user: null,
        isWalletAddress,
        message: isWalletAddress
          ? "No user found with this wallet address"
          : "No user found with this username"
      });
    }

    return NextResponse.json({
      user,
      isWalletAddress,
    });
  } catch (error) {
    console.error("Error looking up user:", error);
    return NextResponse.json(
      { error: "Failed to lookup user" },
      { status: 500 }
    );
  }
}

// POST /api/users/lookup - Search multiple users at once
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limit to prevent user enumeration
    const rateLimitResult = await (withRateLimitAsync('write', 'user-lookup-batch'))(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: 429, headers: rateLimitResult.headers }
      );
    }

    const { queries } = await request.json();

    if (!Array.isArray(queries) || queries.length === 0) {
      return NextResponse.json(
        { error: "queries must be a non-empty array" },
        { status: 400 }
      );
    }

    if (queries.length > 10) {
      return NextResponse.json(
        { error: "Maximum 10 queries per request" },
        { status: 400 }
      );
    }

    const results = await Promise.all(
      queries.map(async (query: string) => {
        const trimmed = query?.trim();
        if (!trimmed || trimmed.length < 2) {
          return { query, user: null, error: "Invalid query" };
        }

        const isWalletAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed);

        let user = null;

        if (isWalletAddress) {
          user = await prisma.user.findFirst({
            where: { walletAddress: trimmed, deletedAt: null },
            select: {
              id: true,
              username: true,
              displayName: true,
              name: true,
              image: true,
              walletAddress: true,
              isVerified: true,
              twitterUsername: true,
              twitterVerified: true,
              rating: true,
              totalSales: true,
            },
          });
        } else {
          user = await prisma.user.findFirst({
            where: {
              deletedAt: null,
              OR: [
                { username: { equals: trimmed, mode: "insensitive" } },
                { displayName: { equals: trimmed, mode: "insensitive" } },
              ],
            },
            select: {
              id: true,
              username: true,
              displayName: true,
              name: true,
              image: true,
              walletAddress: true,
              isVerified: true,
              twitterUsername: true,
              twitterVerified: true,
              rating: true,
              totalSales: true,
            },
          });
        }

        return { query: trimmed, user, isWalletAddress };
      })
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Error looking up users:", error);
    return NextResponse.json(
      { error: "Failed to lookup users" },
      { status: 500 }
    );
  }
}
