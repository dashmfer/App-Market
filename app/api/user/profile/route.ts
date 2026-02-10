import { NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import { validateCsrfRequest, csrfError } from '@/lib/csrf';

export async function GET(req: NextRequest) {
  try {
    const token = await getAuthToken(req);
    if (!token?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: token.id as string },
      select: {
        id: true,
        username: true,
        name: true,
        displayName: true,
        bio: true,
        image: true,
        websiteUrl: true,
        discordHandle: true,
        githubUsername: true,
        githubVerified: true,
        walletAddress: true,
        walletVerified: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    // SECURITY: Validate CSRF token
    const csrfValidation = validateCsrfRequest(req);
    if (!csrfValidation.valid) {
      return csrfError(csrfValidation.error || 'CSRF validation failed');
    }

    const token = await getAuthToken(req);
    if (!token?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();

    // Validate and sanitize input
    const updateData: any = {};

    if (data.displayName !== undefined) {
      updateData.displayName = data.displayName.trim().slice(0, 50);
    }

    if (data.bio !== undefined) {
      updateData.bio = data.bio.trim().slice(0, 500);
    }

    if (data.websiteUrl !== undefined) {
      const url = data.websiteUrl.trim().slice(0, 200);
      if (url && !/^https?:\/\//i.test(url)) {
        return NextResponse.json({ error: "Website URL must start with http:// or https://" }, { status: 400 });
      }
      updateData.websiteUrl = url;
    }

    if (data.discordHandle !== undefined) {
      updateData.discordHandle = data.discordHandle.trim().slice(0, 50);
    }

    const updatedUser = await prisma.user.update({
      where: { id: token.id as string },
      data: updateData,
      select: {
        id: true,
        username: true,
        name: true,
        displayName: true,
        bio: true,
        image: true,
        websiteUrl: true,
        discordHandle: true,
        githubUsername: true,
        githubVerified: true,
        walletAddress: true,
        walletVerified: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Error updating user profile:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
