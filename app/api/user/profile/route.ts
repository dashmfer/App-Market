import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
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
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();

    // Validate and sanitize input
    const updateData: any = {};

    if (data.displayName !== undefined) {
      // Strip HTML tags to prevent stored XSS
      updateData.displayName = data.displayName.replace(/<[^>]*>/g, "").trim().slice(0, 50);
    }

    if (data.bio !== undefined) {
      updateData.bio = data.bio.replace(/<[^>]*>/g, "").trim().slice(0, 500);
    }

    if (data.websiteUrl !== undefined) {
      const url = data.websiteUrl.trim().slice(0, 200);
      if (url && !/^https?:\/\//i.test(url)) {
        return NextResponse.json({ error: "Website URL must start with http:// or https://" }, { status: 400 });
      }
      updateData.websiteUrl = url;
    }

    if (data.discordHandle !== undefined) {
      updateData.discordHandle = data.discordHandle.replace(/<[^>]*>/g, "").trim().slice(0, 50);
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
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
