import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
      // SECURITY: Truncate before regex to prevent ReDoS, loop to prevent incomplete sanitization
      let displayName = String(data.displayName).slice(0, 100);
      let prev = "";
      while (prev !== displayName) {
        prev = displayName;
        displayName = displayName.replace(/<[^>]*>/g, "");
      }
      updateData.displayName = displayName.trim().slice(0, 50);
    }

    if (data.bio !== undefined) {
      let bio = String(data.bio).slice(0, 1000);
      let prev = "";
      while (prev !== bio) {
        prev = bio;
        bio = bio.replace(/<[^>]*>/g, "");
      }
      updateData.bio = bio.trim().slice(0, 500);
    }

    if (data.websiteUrl !== undefined) {
      const url = String(data.websiteUrl).trim().slice(0, 200);
      if (url && !/^https?:\/\//i.test(url)) {
        return NextResponse.json({ error: "Website URL must start with http:// or https://" }, { status: 400 });
      }
      updateData.websiteUrl = url;
    }

    if (data.discordHandle !== undefined) {
      let discordHandle = String(data.discordHandle).slice(0, 100);
      let prev = "";
      while (prev !== discordHandle) {
        prev = discordHandle;
        discordHandle = discordHandle.replace(/<[^>]*>/g, "");
      }
      updateData.discordHandle = discordHandle.trim().slice(0, 50);
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
