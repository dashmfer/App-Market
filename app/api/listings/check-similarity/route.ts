import { NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import prisma from "@/lib/db";
import {
  calculateListingSimilarity,
  findSimilarListings,
  ListingForComparison,
} from "@/lib/similarity-detection";

// POST /api/listings/check-similarity - Check if a listing is similar to existing ones
export async function POST(request: NextRequest) {
  try {
    const token = await getAuthToken(request);
    if (!token?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = token.id as string;

    const body = await request.json();
    const { title, description, techStack, thumbnailUrl } = body;

    if (!title || !description) {
      return NextResponse.json(
        { error: "Title and description are required" },
        { status: 400 }
      );
    }

    // Create target listing object
    const targetListing: ListingForComparison = {
      id: "new",
      title,
      description,
      techStack: techStack || [],
      thumbnailUrl,
      sellerId: userId,
    };

    // Fetch existing active listings
    const existingListings = await prisma.listing.findMany({
      where: {
        status: {
          in: ["ACTIVE", "RESERVED"],
        },
        // Only check against other sellers' listings
        sellerId: {
          not: userId,
        },
      },
      select: {
        id: true,
        title: true,
        description: true,
        techStack: true,
        thumbnailUrl: true,
        sellerId: true,
      },
      take: 500, // Limit for performance
    });

    // Find similar listings
    const similarListings = await findSimilarListings(
      targetListing,
      existingListings,
      0.5 // Minimum 50% similarity to return
    );

    // Get the highest flag level
    let flagLevel: "none" | "soft" | "hard" = "none";
    const flaggedListings: Array<{
      id: string;
      title: string;
      similarity: number;
      flagLevel: "soft" | "hard";
      reasons: string[];
    }> = [];

    for (const { listing, result } of similarListings) {
      if (result.flagLevel === "hard") {
        flagLevel = "hard";
        flaggedListings.push({
          id: listing.id,
          title: listing.title,
          similarity: Math.round(result.overallSimilarity * 100),
          flagLevel: "hard",
          reasons: result.reasons,
        });
      } else if (result.flagLevel === "soft") {
        if (flagLevel === "none") flagLevel = "soft";
        flaggedListings.push({
          id: listing.id,
          title: listing.title,
          similarity: Math.round(result.overallSimilarity * 100),
          flagLevel: "soft",
          reasons: result.reasons,
        });
      }
    }

    // Only return top 5 similar listings
    const topSimilar = flaggedListings.slice(0, 5);

    return NextResponse.json({
      flagLevel,
      similarListings: topSimilar,
      canProceed: flagLevel !== "hard",
      message:
        flagLevel === "hard"
          ? "This listing is too similar to existing listings and requires manual review."
          : flagLevel === "soft"
          ? "This listing has some similarities to existing listings. Please ensure it is unique."
          : "No significant similarities detected.",
    });
  } catch (error: any) {
    console.error("Error checking similarity:", error);
    return NextResponse.json(
      { error: "Failed to check similarity" },
      { status: 500 }
    );
  }
}
