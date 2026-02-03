import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthToken } from "@/lib/auth";
import {
  generateApiKey,
  hashApiKey,
  authenticateAgent,
  hasPermission,
  agentErrorResponse,
  agentSuccessResponse,
} from "@/lib/agent-auth";
import { ApiKeyPermission } from "@/lib/prisma-enums";

// GET /api/agent/keys - List user's API keys
export async function GET(request: NextRequest) {
  try {
    // Support both session auth (from dashboard) and agent auth
    let userId: string | undefined;

    // Try session auth first
    const token = await getAuthToken(request);
    if (token?.id) {
      userId = token.id as string;
    } else {
      // Try agent auth
      const agentAuth = await authenticateAgent(request);
      if (agentAuth.success && hasPermission(agentAuth, ApiKeyPermission.ADMIN)) {
        userId = agentAuth.userId;
      }
    }

    if (!userId) {
      return agentErrorResponse("Unauthorized", 401);
    }

    const apiKeys = await prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        rateLimit: true,
        isActive: true,
        lastUsedAt: true,
        totalRequests: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return agentSuccessResponse({ keys: apiKeys });
  } catch (error) {
    console.error("Error fetching API keys:", error);
    return agentErrorResponse("Failed to fetch API keys", 500);
  }
}

// POST /api/agent/keys - Create a new API key
export async function POST(request: NextRequest) {
  try {
    // Support both session auth and agent auth
    let userId: string | undefined;

    const token = await getAuthToken(request);
    if (token?.id) {
      userId = token.id as string;
    } else {
      const agentAuth = await authenticateAgent(request);
      if (agentAuth.success && hasPermission(agentAuth, ApiKeyPermission.ADMIN)) {
        userId = agentAuth.userId;
      }
    }

    if (!userId) {
      return agentErrorResponse("Unauthorized", 401);
    }

    const body = await request.json();
    const {
      name,
      permissions = [ApiKeyPermission.READ, ApiKeyPermission.WRITE],
      rateLimit = 100,
      expiresAt,
    } = body;

    if (!name || typeof name !== "string" || name.length < 1) {
      return agentErrorResponse("Name is required", 400);
    }

    // Validate permissions
    const validPermissions = Object.values(ApiKeyPermission);
    const requestedPermissions = permissions.filter((p: string) =>
      validPermissions.includes(p as ApiKeyPermission)
    );

    if (requestedPermissions.length === 0) {
      return agentErrorResponse("At least one valid permission is required", 400);
    }

    // Check key limit (max 10 keys per user)
    const existingCount = await prisma.apiKey.count({ where: { userId } });
    if (existingCount >= 10) {
      return agentErrorResponse("Maximum 10 API keys allowed per account", 400);
    }

    // Generate new key
    const { key, hash, prefix } = generateApiKey();

    // Create key in database
    const apiKey = await prisma.apiKey.create({
      data: {
        userId,
        name: name.trim(),
        keyHash: hash,
        keyPrefix: prefix,
        permissions: requestedPermissions,
        rateLimit: Math.min(Math.max(rateLimit, 10), 1000), // 10-1000 requests/min
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        rateLimit: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    // Return the plaintext key (only shown once!)
    return agentSuccessResponse({
      key: {
        ...apiKey,
        secret: key, // Only returned on creation
      },
      message: "API key created. Save the secret - it won't be shown again.",
    }, 201);
  } catch (error) {
    console.error("Error creating API key:", error);
    return agentErrorResponse("Failed to create API key", 500);
  }
}

// DELETE /api/agent/keys?id=xxx - Delete an API key
export async function DELETE(request: NextRequest) {
  try {
    let userId: string | undefined;

    const token = await getAuthToken(request);
    if (token?.id) {
      userId = token.id as string;
    } else {
      const agentAuth = await authenticateAgent(request);
      if (agentAuth.success && hasPermission(agentAuth, ApiKeyPermission.ADMIN)) {
        userId = agentAuth.userId;
      }
    }

    if (!userId) {
      return agentErrorResponse("Unauthorized", 401);
    }

    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get("id");

    if (!keyId) {
      return agentErrorResponse("Key ID is required", 400);
    }

    // Find and verify ownership
    const apiKey = await prisma.apiKey.findUnique({
      where: { id: keyId },
    });

    if (!apiKey) {
      return agentErrorResponse("API key not found", 404);
    }

    if (apiKey.userId !== userId) {
      return agentErrorResponse("Not authorized to delete this key", 403);
    }

    // Delete the key
    await prisma.apiKey.delete({
      where: { id: keyId },
    });

    return agentSuccessResponse({ message: "API key deleted" });
  } catch (error) {
    console.error("Error deleting API key:", error);
    return agentErrorResponse("Failed to delete API key", 500);
  }
}

// PATCH /api/agent/keys - Update an API key
export async function PATCH(request: NextRequest) {
  try {
    let userId: string | undefined;

    const token = await getAuthToken(request);
    if (token?.id) {
      userId = token.id as string;
    } else {
      const agentAuth = await authenticateAgent(request);
      if (agentAuth.success && hasPermission(agentAuth, ApiKeyPermission.ADMIN)) {
        userId = agentAuth.userId;
      }
    }

    if (!userId) {
      return agentErrorResponse("Unauthorized", 401);
    }

    const body = await request.json();
    const { id, name, isActive, permissions, rateLimit } = body;

    if (!id) {
      return agentErrorResponse("Key ID is required", 400);
    }

    // Find and verify ownership
    const apiKey = await prisma.apiKey.findUnique({
      where: { id },
    });

    if (!apiKey) {
      return agentErrorResponse("API key not found", 404);
    }

    if (apiKey.userId !== userId) {
      return agentErrorResponse("Not authorized to update this key", 403);
    }

    // Build update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (rateLimit !== undefined) {
      updateData.rateLimit = Math.min(Math.max(rateLimit, 10), 1000);
    }
    if (permissions !== undefined) {
      const validPermissions = Object.values(ApiKeyPermission);
      updateData.permissions = permissions.filter((p: string) =>
        validPermissions.includes(p as ApiKeyPermission)
      );
    }

    const updated = await prisma.apiKey.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        rateLimit: true,
        isActive: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return agentSuccessResponse({ key: updated });
  } catch (error) {
    console.error("Error updating API key:", error);
    return agentErrorResponse("Failed to update API key", 500);
  }
}
