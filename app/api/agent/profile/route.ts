import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import {
  authenticateAgent,
  hasPermission,
  agentErrorResponse,
  agentSuccessResponse,
} from "@/lib/agent-auth";
import { ApiKeyPermission } from "@/lib/prisma-enums";

// GET /api/agent/profile - Get the authenticated user's profile
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAgent(request);
    if (!auth.success || !hasPermission(auth, ApiKeyPermission.READ)) {
      return agentErrorResponse(auth.error || "Unauthorized", auth.statusCode || 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        image: true,
        bio: true,
        displayName: true,
        websiteUrl: true,
        discordHandle: true,
        walletAddress: true,
        githubUsername: true,
        githubVerified: true,
        discordVerified: true,
        walletVerified: true,
        twitterUsername: true,
        twitterVerified: true,
        totalSales: true,
        totalPurchases: true,
        totalVolume: true,
        rating: true,
        ratingCount: true,
        createdAt: true,
      },
    });

    if (!user) {
      return agentErrorResponse("User not found", 404);
    }

    return agentSuccessResponse(user);
  } catch (error) {
    console.error("[Agent] Error fetching profile:", error);
    return agentErrorResponse("Failed to fetch profile", 500);
  }
}

// PATCH /api/agent/profile - Update the authenticated user's profile
export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateAgent(request);
    if (!auth.success || !hasPermission(auth, ApiKeyPermission.WRITE)) {
      return agentErrorResponse(auth.error || "Unauthorized", auth.statusCode || 401);
    }

    const userId = auth.userId!;
    const body = await request.json();
    const { displayName, username, bio, websiteUrl, discordHandle } = body;

    // Build update data (only include provided fields)
    const updateData: any = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (bio !== undefined) updateData.bio = bio;
    if (websiteUrl !== undefined) updateData.websiteUrl = websiteUrl;
    if (discordHandle !== undefined) updateData.discordHandle = discordHandle;

    // Validate username uniqueness if being updated
    if (username !== undefined) {
      if (username && (typeof username !== "string" || !/^[a-z0-9_]+$/.test(username))) {
        return agentErrorResponse("Username must be lowercase letters, numbers, and underscores only", 400);
      }
      if (username) {
        const existingUser = await prisma.user.findFirst({
          where: { username, id: { not: userId } },
        });
        if (existingUser) {
          return agentErrorResponse("Username is already taken", 400);
        }
      }
      updateData.username = username;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        image: true,
        bio: true,
        displayName: true,
        websiteUrl: true,
        discordHandle: true,
        walletAddress: true,
      },
    });

    return agentSuccessResponse(updatedUser);
  } catch (error) {
    console.error("[Agent] Error updating profile:", error);
    return agentErrorResponse("Failed to update profile", 500);
  }
}
