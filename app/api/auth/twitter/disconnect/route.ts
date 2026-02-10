import { NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import prisma from "@/lib/db";

// Force dynamic rendering for this route
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const token = await getAuthToken(request);
    if (!token?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Remove Twitter connection
    await prisma.user.update({
      where: { id: token.id as string },
      data: {
        twitterId: null,
        twitterUsername: null,
        twitterVerified: false,
        twitterLinkedAt: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Twitter disconnect error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect Twitter" },
      { status: 500 }
    );
  }
}
