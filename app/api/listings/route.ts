import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getToken } from "next-auth/jwt";

// GET /api/listings - Get all listings with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const category = searchParams.get("category");
    const status = searchParams.get("status") || "ACTIVE";
    const sort = searchParams.get("sort") || "ending-soon";
    const search = searchParams.get("search");
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const featured = searchParams.get("featured");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // Build where clause
    const where: any = {
      status: status.toUpperCase(),
    };

    if (category && category !== "all") {
      where.category = category.toUpperCase().replace("-", "_");
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { tagline: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (minPrice) {
      where.startingPrice = { gte: parseFloat(minPrice) };
    }

    if (maxPrice) {
      where.startingPrice = { ...where.startingPrice, lte: parseFloat(maxPrice) };
    }

    if (featured === "true") {
      where.featured = true;
    }

    // Build order by clause
    let orderBy: any = {};
    switch (sort) {
      case "ending-soon":
        orderBy = { endTime: "asc" };
        break;
      case "newest":
        orderBy = { createdAt: "desc" };
        break;
      case "price-low":
        orderBy = { startingPrice: "asc" };
        break;
      case "price-high":
        orderBy = { startingPrice: "desc" };
        break;
      case "most-bids":
        orderBy = { bids: { _count: "desc" } };
        break;
      default:
        orderBy = { endTime: "asc" };
    }

    // Get total count for pagination
    const total = await prisma.listing.count({ where });

    // Get listings
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
            username: true,
            walletAddress: true,
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

    // Transform listings for response
    const transformedListings = listings.map((listing) => ({
      id: listing.id,
      slug: listing.slug,
      title: listing.title,
      tagline: listing.tagline,
      thumbnailUrl: listing.thumbnailUrl,
      category: listing.category,
      techStack: listing.techStack,
      currentBid: listing.bids[0]?.amount || listing.startingPrice,
      buyNowPrice: listing.buyNowEnabled ? listing.buyNowPrice : null,
      endTime: listing.endTime,
      bidCount: listing._count.bids,
      seller: {
        name: listing.seller.username || listing.seller.name || "Anonymous",
        rating: listing.seller.rating,
        verified: listing.seller.isVerified,
      },
    }));

    return NextResponse.json({
      listings: transformedListings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching listings:", error);
    return NextResponse.json(
      { error: "Failed to fetch listings" },
      { status: 500 }
    );
  }
}

// POST /api/listings - Create a new listing
export async function POST(request: NextRequest) {
  try {
    // Use getToken for JWT-based authentication (works better with credentials provider)
    const token = await getToken({ req: request });

    if (!token?.id) {
      return NextResponse.json(
        { error: "Unauthorized - please sign in with your wallet" },
        { status: 401 }
      );
    }

    const userId = token.id as string;

    const body = await request.json();
    const {
      title,
      tagline,
      description,
      category,
      techStack,
      githubRepo,
      hasDomain,
      domain,
      hasDatabase,
      databaseType,
      hasHosting,
      hostingProvider,
      hasSocialAccounts,
      socialAccounts,
      hasApiKeys,
      hasDesignFiles,
      hasDocumentation,
      additionalAssets,
      thumbnailUrl,
      screenshotUrls,
      demoUrl,
      videoUrl,
      monthlyUsers,
      monthlyRevenue,
      githubStars,
      startingPrice,
      reservePrice,
      buyNowEnabled,
      buyNowPrice,
      currency,
      duration,
    } = body;

    // Validate required fields (githubRepo is optional - can use code files instead)
    if (!title || !description || !category || !startingPrice) {
      return NextResponse.json(
        { error: "Missing required fields: title, description, category, and starting price are required" },
        { status: 400 }
      );
    }

    // Generate slug
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    
    const existingSlug = await prisma.listing.findFirst({
      where: { slug: { startsWith: baseSlug } },
      orderBy: { createdAt: "desc" },
    });

    const slug = existingSlug
      ? `${baseSlug}-${Date.now().toString(36)}`
      : baseSlug;

    // Calculate end time
    const durationDays = parseInt(duration) || 7;
    const endTime = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

    // Create listing
    const listing = await prisma.listing.create({
      data: {
        slug,
        title,
        tagline,
        description,
        category,
        techStack,
        githubRepo,
        hasDomain,
        domain,
        hasDatabase,
        databaseType,
        hasHosting,
        hostingProvider,
        hasSocialAccounts,
        socialAccounts: socialAccounts ? JSON.parse(socialAccounts) : null,
        hasApiKeys,
        hasDesignFiles,
        hasDocumentation,
        additionalAssets,
        thumbnailUrl,
        screenshotUrls,
        demoUrl,
        videoUrl,
        monthlyUsers: monthlyUsers ? parseInt(monthlyUsers) : null,
        monthlyRevenue: monthlyRevenue ? parseFloat(monthlyRevenue) : null,
        githubStars: githubStars ? parseInt(githubStars) : null,
        startingPrice: parseFloat(startingPrice),
        reservePrice: reservePrice ? parseFloat(reservePrice) : null,
        buyNowEnabled,
        buyNowPrice: buyNowPrice ? parseFloat(buyNowPrice) : null,
        currency,
        endTime,
        status: "ACTIVE",
        sellerId: userId,
        publishedAt: new Date(),
      },
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    });

    return NextResponse.json({ listing }, { status: 201 });
  } catch (error) {
    console.error("Error creating listing:", error);
    return NextResponse.json(
      { error: "Failed to create listing" },
      { status: 500 }
    );
  }
}
