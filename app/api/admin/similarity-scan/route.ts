import { NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import prisma from "@/lib/db";
import {
  calculateListingSimilarity,
  SimilarityResult,
} from "@/lib/similarity-detection";
import { validateCsrfRequest, csrfError } from '@/lib/csrf';

// POST /api/admin/similarity-scan - Run similarity scan on all active listings (admin only)
export async function POST(request: NextRequest) {
  try {
    // SECURITY [M7]: Validate CSRF token for state-changing request
    const csrfValidation = validateCsrfRequest(request);
    if (!csrfValidation.valid) {
      return csrfError(csrfValidation.error || 'CSRF validation failed');
    }

    const token = await getAuthToken(request);
    if (!token?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: token.id as string },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Fetch all active listings
    const listings = await prisma.listing.findMany({
      where: {
        status: {
          in: ["ACTIVE", "RESERVED"],
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
    });

    const similarities: Array<{
      listingId: string;
      similarListingId: string;
      result: SimilarityResult;
    }> = [];

    // Compare each pair of listings
    for (let i = 0; i < listings.length; i++) {
      for (let j = i + 1; j < listings.length; j++) {
        const result = calculateListingSimilarity(listings[i], listings[j]);

        // Only store if there's some similarity
        if (result.flagLevel !== "none") {
          similarities.push({
            listingId: listings[i].id,
            similarListingId: listings[j].id,
            result,
          });
        }
      }
    }

    // Store results in database
    const storedResults = [];
    for (const sim of similarities) {
      // Check if this pair already exists
      const existing = await prisma.listingSimilarity.findFirst({
        where: {
          OR: [
            { listingId: sim.listingId, similarListingId: sim.similarListingId },
            { listingId: sim.similarListingId, similarListingId: sim.listingId },
          ],
        },
      });

      // Map flagLevel to flagType enum
      const flagType = sim.result.flagLevel === "hard" ? "HARD" : sim.result.flagLevel === "soft" ? "SOFT" : "INFO";

      if (existing) {
        // Update existing
        const updated = await prisma.listingSimilarity.update({
          where: { id: existing.id },
          data: {
            overallSimilarity: sim.result.overallSimilarity,
            titleSimilarity: sim.result.titleSimilarity,
            descriptionSimilarity: sim.result.descriptionSimilarity,
            screenshotSimilarity: sim.result.imageSimilarity,
            flagType,
            analyzedAt: new Date(),
          },
        });
        storedResults.push(updated);
      } else {
        // Create new
        const created = await prisma.listingSimilarity.create({
          data: {
            listingId: sim.listingId,
            similarListingId: sim.similarListingId,
            overallSimilarity: sim.result.overallSimilarity,
            titleSimilarity: sim.result.titleSimilarity,
            descriptionSimilarity: sim.result.descriptionSimilarity,
            screenshotSimilarity: sim.result.imageSimilarity,
            flagType,
          },
        });
        storedResults.push(created);
      }
    }

    // Get summary
    const hardFlags = storedResults.filter((r) => r.flagType === "HARD").length;
    const softFlags = storedResults.filter((r) => r.flagType === "SOFT").length;

    return NextResponse.json({
      success: true,
      listingsScanned: listings.length,
      pairsAnalyzed: (listings.length * (listings.length - 1)) / 2,
      similaritiesFound: storedResults.length,
      hardFlags,
      softFlags,
    });
  } catch (error) {
    console.error("Error running similarity scan:", error);
    return NextResponse.json(
      { error: "Failed to run similarity scan" },
      { status: 500 }
    );
  }
}

// GET /api/admin/similarity-scan - Get flagged similar listings (admin only)
export async function GET(request: NextRequest) {
  try {
    const token = await getAuthToken(request);
    if (!token?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: token.id as string },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const flagType = searchParams.get("flagType") || searchParams.get("flagLevel");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where: any = {};

    if (flagType) {
      where.flagType = flagType.toUpperCase();
    }

    const [similarities, total] = await Promise.all([
      prisma.listingSimilarity.findMany({
        where,
        orderBy: { overallSimilarity: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          listing: {
            select: {
              id: true,
              title: true,
              slug: true,
              thumbnailUrl: true,
              seller: {
                select: {
                  id: true,
                  username: true,
                },
              },
            },
          },
          similarListing: {
            select: {
              id: true,
              title: true,
              slug: true,
              thumbnailUrl: true,
              seller: {
                select: {
                  id: true,
                  username: true,
                },
              },
            },
          },
        },
      }),
      prisma.listingSimilarity.count({ where }),
    ]);

    return NextResponse.json({
      similarities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching similarities:", error);
    return NextResponse.json(
      { error: "Failed to fetch similarities" },
      { status: 500 }
    );
  }
}
