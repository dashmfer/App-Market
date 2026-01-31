import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { ListingStatus, CollaboratorRole, CollaboratorRoleDescription, CollaboratorStatus } from "@prisma/client";
import { getAuthToken } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";

// GET /api/listings - Get all listings with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const category = searchParams.get("category");
    const blockchain = searchParams.get("blockchain");
    const status = searchParams.get("status");
    const sellerId = searchParams.get("sellerId");
    const sort = searchParams.get("sort") || "ending-soon";
    const search = searchParams.get("search");
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const featured = searchParams.get("featured");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // Build where clause
    const where: any = {};

    // Only filter by status if provided (allows getting all statuses for seller's own listings)
    if (status) {
      where.status = status.toUpperCase();
    } else if (!sellerId) {
      // Default to ACTIVE only for public listings
      where.status = "ACTIVE";
    }

    // Filter out expired listings for public views (but allow sellers to see their own expired listings)
    if (!sellerId) {
      where.endTime = { gt: new Date() };
    }

    // Filter by seller
    if (sellerId) {
      where.sellerId = sellerId;
    }

    if (category && category !== "all") {
      where.categories = { has: category.toUpperCase().replace("-", "_") };
    }

    if (blockchain && blockchain !== "all") {
      where.blockchain = blockchain.toUpperCase();
    }

    if (search) {
      // Map common search terms to categories for comprehensive search
      const categoryMappings: Record<string, string[]> = {
        "saas": ["SAAS"],
        "software": ["SAAS", "WEB_APP", "MOBILE_APP"],
        "ai": ["AI_ML"],
        "artificial intelligence": ["AI_ML"],
        "machine learning": ["AI_ML"],
        "ml": ["AI_ML"],
        "mobile": ["MOBILE_APP"],
        "app": ["MOBILE_APP", "WEB_APP"],
        "ios": ["MOBILE_APP"],
        "android": ["MOBILE_APP"],
        "web": ["WEB_APP"],
        "website": ["WEB_APP"],
        "extension": ["BROWSER_EXTENSION"],
        "chrome": ["BROWSER_EXTENSION"],
        "browser": ["BROWSER_EXTENSION"],
        "plugin": ["BROWSER_EXTENSION"],
        "crypto": ["CRYPTO_WEB3"],
        "web3": ["CRYPTO_WEB3"],
        "blockchain": ["CRYPTO_WEB3"],
        "nft": ["CRYPTO_WEB3"],
        "defi": ["CRYPTO_WEB3"],
        "solana": ["CRYPTO_WEB3"],
        "ethereum": ["CRYPTO_WEB3"],
        "ecommerce": ["ECOMMERCE"],
        "e-commerce": ["ECOMMERCE"],
        "shop": ["ECOMMERCE"],
        "store": ["ECOMMERCE"],
        "developer": ["DEVELOPER_TOOLS"],
        "dev tools": ["DEVELOPER_TOOLS"],
        "devtools": ["DEVELOPER_TOOLS"],
        "api": ["API", "DEVELOPER_TOOLS"],
        "game": ["GAMING"],
        "gaming": ["GAMING"],
        "games": ["GAMING"],
      };

      // Find matching categories for the search term
      const searchLower = search.toLowerCase();
      const matchedCategories: string[] = [];
      for (const [term, cats] of Object.entries(categoryMappings)) {
        if (searchLower.includes(term) || term.includes(searchLower)) {
          matchedCategories.push(...cats);
        }
      }
      const uniqueCategories = Array.from(new Set(matchedCategories));

      // Build OR conditions for text search and category matching
      const searchConditions: any[] = [
        { title: { contains: search, mode: "insensitive" } },
        { tagline: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { techStack: { has: search } },
      ];

      // Add category matching if we found related categories
      if (uniqueCategories.length > 0) {
        searchConditions.push({ categories: { hasSome: uniqueCategories } });
      }

      where.OR = searchConditions;
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
            displayName: true,
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
    const transformedListings = listings.map((listing) => {
      // Check if this is a Buy Now only listing (no valid starting price)
      const isBuyNowOnly = listing.buyNowEnabled && (!listing.startingPrice || listing.startingPrice <= 0);

      return {
        id: listing.id,
        slug: listing.slug,
        title: listing.title,
        tagline: listing.tagline,
        thumbnailUrl: listing.thumbnailUrl,
        categories: listing.categories,
        category: listing.categories[0], // Backwards compatibility
        blockchain: listing.blockchain,
        techStack: listing.techStack,
        status: listing.status,
        startingPrice: listing.startingPrice,
        currentBid: isBuyNowOnly ? null : (listing.bids[0]?.amount || listing.startingPrice),
        buyNowPrice: listing.buyNowEnabled ? listing.buyNowPrice : null,
        buyNowEnabled: listing.buyNowEnabled,
        currency: listing.currency,
        endTime: listing.endTime,
        bidCount: isBuyNowOnly ? 0 : listing._count.bids,
        _count: listing._count,
        seller: {
          id: listing.seller.id,
          name: listing.seller.name,
          displayName: listing.seller.displayName,
          username: listing.seller.username,
          image: listing.seller.image,
          rating: listing.seller.rating,
          verified: listing.seller.isVerified,
          isVerified: listing.seller.isVerified,
        },
      };
    });

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
    // Use getAuthToken for JWT-based authentication (works better with credentials provider)
    const token = await getAuthToken(request);

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
      categories,
      blockchain,
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
      requiredBuyerInfo,
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
      reservedBuyerWallet,
      collaborators,
    } = body;

    // Validate required fields
    // startingPrice is optional if buyNowEnabled is true (Buy Now only listing)
    const missingFields: string[] = [];
    if (!title) missingFields.push("title");
    if (!description) missingFields.push("description");
    // Support both categories array and legacy category field
    const finalCategories = categories && categories.length > 0
      ? categories
      : (category ? [category] : []);
    if (finalCategories.length === 0) missingFields.push("category");
    if (!startingPrice && !buyNowEnabled) missingFields.push("starting price or enable Buy Now");
    if (buyNowEnabled && !buyNowPrice) missingFields.push("buy now price");

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(", ")}` },
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

    // Handle reservation if a buyer wallet is provided
    let reservedBuyerId = null;
    let listingStatus: ListingStatus = ListingStatus.ACTIVE;

    // Check if there are collaborators - listing needs their approval first
    const hasCollaborators = collaborators && Array.isArray(collaborators) && collaborators.length > 0;
    if (hasCollaborators) {
      listingStatus = ListingStatus.PENDING_COLLABORATORS;
    }

    if (reservedBuyerWallet && reservedBuyerWallet.trim()) {
      // Validate wallet address format (Solana addresses are 32-44 characters)
      if (reservedBuyerWallet.length < 32 || reservedBuyerWallet.length > 44) {
        return NextResponse.json(
          { error: "Invalid wallet address format for reservation" },
          { status: 400 }
        );
      }

      // Check if the wallet belongs to a registered user
      const reservedUser = await prisma.user.findFirst({
        where: { walletAddress: reservedBuyerWallet },
        select: { id: true },
      });

      if (reservedUser) {
        reservedBuyerId = reservedUser.id;
      }

      listingStatus = ListingStatus.RESERVED;
    }

    // Create listing
    const listing = await prisma.listing.create({
      data: {
        slug,
        title,
        tagline,
        description,
        categories: finalCategories,
        blockchain: blockchain || null,
        techStack,
        githubRepo,
        hasDomain,
        domain,
        hasDatabase,
        databaseType,
        hasHosting,
        hostingProvider,
        hasSocialAccounts,
        socialAccounts: (() => {
          if (typeof socialAccounts === 'object' && socialAccounts !== null) {
            return socialAccounts;
          }
          if (typeof socialAccounts === 'string' && socialAccounts.trim()) {
            try {
              return JSON.parse(socialAccounts);
            } catch {
              // Invalid JSON, ignore
              return null;
            }
          }
          return null;
        })(),
        hasApiKeys,
        hasDesignFiles,
        hasDocumentation,
        additionalAssets,
        requiredBuyerInfo: requiredBuyerInfo || null,
        thumbnailUrl,
        screenshotUrls,
        demoUrl,
        videoUrl,
        monthlyUsers: monthlyUsers ? parseInt(monthlyUsers) : null,
        monthlyRevenue: monthlyRevenue ? parseFloat(monthlyRevenue) : null,
        githubStars: githubStars ? parseInt(githubStars) : null,
        startingPrice: startingPrice ? parseFloat(startingPrice) : 0,
        reservePrice: reservePrice ? parseFloat(reservePrice) : null,
        buyNowEnabled,
        buyNowPrice: buyNowPrice ? parseFloat(buyNowPrice) : null,
        currency,
        endTime,
        status: listingStatus,
        sellerId: userId,
        publishedAt: new Date(),
        // Reservation fields
        reservedBuyerWallet: reservedBuyerWallet?.trim() || null,
        reservedBuyerId,
        reservedAt: reservedBuyerWallet?.trim() ? new Date() : null,
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

    // Create collaborators if provided
    if (hasCollaborators) {
      const collaboratorPromises = collaborators.map(async (collab: any) => {
        // Create the collaborator record
        const collaboratorRecord = await prisma.listingCollaborator.create({
          data: {
            listingId: listing.id,
            walletAddress: collab.walletAddress,
            userId: collab.userId || null,
            role: collab.role as CollaboratorRole,
            roleDescription: (collab.roleDescription || "OTHER") as CollaboratorRoleDescription,
            customRoleDescription: collab.customRoleDescription || null,
            percentage: collab.percentage,
            canEdit: collab.role === "PARTNER",
            status: CollaboratorStatus.PENDING,
          },
        });

        // Send notification if they're a registered user
        if (collab.userId) {
          await createNotification({
            userId: collab.userId,
            type: "COLLABORATION_INVITE",
            data: {
              listingId: listing.id,
              listingSlug: listing.slug,
              listingTitle: listing.title,
              collaboratorId: collaboratorRecord.id,
              role: collab.role,
              percentage: collab.percentage,
            },
          });
        }

        return collaboratorRecord;
      });

      await Promise.all(collaboratorPromises);
    }

    return NextResponse.json({ listing }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating listing:", error);
    console.error("Error details:", error?.message, error?.code);
    return NextResponse.json(
      { error: error?.message || "Failed to create listing" },
      { status: 500 }
    );
  }
}
