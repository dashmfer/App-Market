import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import {
  authenticateAgent,
  hasPermission,
  agentErrorResponse,
  agentSuccessResponse,
} from "@/lib/agent-auth";
import { ApiKeyPermission } from "@/lib/prisma-enums";
import { sanitizePagination, sanitizeSearchQuery } from "@/lib/validation";

// GET /api/agent/listings - List listings with optional filters
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAgent(request);
    if (!auth.success || !hasPermission(auth, ApiKeyPermission.READ)) {
      return agentErrorResponse(auth.error || "Unauthorized", auth.statusCode || 401);
    }

    const { searchParams } = new URL(request.url);

    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const sellerId = searchParams.get("sellerId");
    const sort = searchParams.get("sort") || "ending-soon";
    const search = searchParams.get("search");
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");

    const { page, limit } = sanitizePagination(
      searchParams.get("page"),
      searchParams.get("limit")
    );

    // Build where clause
    const where: any = {};

    if (status) {
      where.status = status.toUpperCase();
    } else if (!sellerId) {
      where.status = "ACTIVE";
    }

    if (!sellerId) {
      where.endTime = { gt: new Date() };
    }

    if (sellerId) {
      where.sellerId = sellerId;
    }

    if (category && category !== "all") {
      where.categories = { has: category.toUpperCase().replace("-", "_") };
    }

    const sanitizedSearch = sanitizeSearchQuery(search);
    if (sanitizedSearch) {
      where.OR = [
        { title: { contains: sanitizedSearch, mode: "insensitive" } },
        { tagline: { contains: sanitizedSearch, mode: "insensitive" } },
        { description: { contains: sanitizedSearch, mode: "insensitive" } },
      ];
    }

    if (minPrice) {
      where.startingPrice = { gte: parseFloat(minPrice) };
    }
    if (maxPrice) {
      where.startingPrice = { ...where.startingPrice, lte: parseFloat(maxPrice) };
    }

    // Build order by
    let orderBy: any = {};
    switch (sort) {
      case "ending-soon": orderBy = { endTime: "asc" }; break;
      case "newest": orderBy = { createdAt: "desc" }; break;
      case "price-low": orderBy = { startingPrice: "asc" }; break;
      case "price-high": orderBy = { startingPrice: "desc" }; break;
      default: orderBy = { endTime: "asc" };
    }

    const total = await prisma.listing.count({ where });

    const listings = await prisma.listing.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            displayName: true,
            username: true,
            image: true,
            isVerified: true,
            rating: true,
          },
        },
        bids: {
          orderBy: { amount: "desc" },
          take: 1,
        },
        _count: {
          select: { bids: true },
        },
      },
    });

    const transformedListings = listings.map((listing: typeof listings[number]) => {
      const isBuyNowOnly = listing.buyNowEnabled && (!listing.startingPrice || Number(listing.startingPrice) <= 0);
      return {
        id: listing.id,
        slug: listing.slug,
        title: listing.title,
        tagline: listing.tagline,
        thumbnailUrl: listing.thumbnailUrl,
        categories: listing.categories,
        status: listing.status,
        startingPrice: listing.startingPrice,
        currentBid: isBuyNowOnly ? null : (listing.bids[0]?.amount || listing.startingPrice),
        buyNowPrice: listing.buyNowEnabled ? listing.buyNowPrice : null,
        buyNowEnabled: listing.buyNowEnabled,
        currency: listing.currency,
        endTime: listing.endTime,
        bidCount: isBuyNowOnly ? 0 : listing._count.bids,
        seller: {
          id: listing.seller.id,
          name: listing.seller.name,
          displayName: listing.seller.displayName,
          username: listing.seller.username,
          image: listing.seller.image,
          isVerified: listing.seller.isVerified,
          rating: listing.seller.rating,
        },
      };
    });

    return agentSuccessResponse({
      listings: transformedListings,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("[Agent] Error fetching listings:", error);
    return agentErrorResponse("Failed to fetch listings", 500);
  }
}
