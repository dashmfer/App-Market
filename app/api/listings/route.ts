import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { ListingStatus, CollaboratorRole, CollaboratorRoleDescription, CollaboratorStatus } from "@/lib/prisma-enums";
import { getAuthToken } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { sanitizePagination, sanitizeSearchQuery, isValidUrl, isValidSolanaAddress, MAX_CATEGORIES } from "@/lib/validation";
import { validateCsrfRequest, csrfError } from "@/lib/csrf";
import { withRateLimitAsync, getClientIp } from "@/lib/rate-limit";

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

    // SECURITY: Sanitize pagination parameters
    const { page, limit } = sanitizePagination(
      searchParams.get("page"),
      searchParams.get("limit")
    );

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

    // SECURITY: Sanitize search query length
    const sanitizedSearch = sanitizeSearchQuery(search);

    if (sanitizedSearch) {
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
      const searchLower = sanitizedSearch.toLowerCase();
      const matchedCategories: string[] = [];
      for (const [term, cats] of Object.entries(categoryMappings)) {
        if (searchLower.includes(term) || term.includes(searchLower)) {
          matchedCategories.push(...cats);
        }
      }
      const uniqueCategories = Array.from(new Set(matchedCategories));

      // Build OR conditions for text search and category matching
      const searchConditions: any[] = [
        { title: { contains: sanitizedSearch, mode: "insensitive" } },
        { tagline: { contains: sanitizedSearch, mode: "insensitive" } },
        { description: { contains: sanitizedSearch, mode: "insensitive" } },
        { techStack: { has: sanitizedSearch } },
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
    const transformedListings = listings.map((listing: typeof listings[number]) => {
      // Check if this is a Buy Now only listing (no valid starting price)
      const isBuyNowOnly = listing.buyNowEnabled && (!listing.startingPrice || Number(listing.startingPrice) <= 0);

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
    // SECURITY: Validate CSRF token for state-changing request
    const csrfValidation = validateCsrfRequest(request);
    if (!csrfValidation.valid) {
      return csrfError(csrfValidation.error || "CSRF validation failed");
    }

    // SECURITY: Rate limit
    const rateLimitResult = await (withRateLimitAsync('write', 'listings'))(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: 429, headers: rateLimitResult.headers }
      );
    }

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
      // Hosting
      hasHosting,
      hostingProvider,
      hostingProjectUrl,
      // Vercel
      hasVercel,
      vercelProjectUrl,
      vercelTeamSlug,
      // Domain
      hasDomain,
      domainRegistrar,
      domain,
      // Database
      hasDatabase,
      databaseProvider,
      databaseName,
      // Other assets
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
      buyNowEnabled,
      buyNowPrice,
      currency,
      duration,
      reservedBuyerWallet,
      // Agreements
      requiresNDA,
      ndaTerms,
      offersAPA,
      offersNonCompete,
      nonCompeteDurationYears,
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

    // SECURITY: Limit number of categories
    if (finalCategories.length > MAX_CATEGORIES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_CATEGORIES} categories allowed` },
        { status: 400 }
      );
    }

    const parsedStartingPrice = startingPrice ? parseFloat(startingPrice) : 0;

    // SECURITY: Validate buy now price
    const parsedBuyNowPrice = buyNowPrice ? parseFloat(buyNowPrice) : null;
    if (buyNowEnabled) {
      if (!parsedBuyNowPrice || parsedBuyNowPrice <= 0) {
        return NextResponse.json(
          { error: "Buy Now price must be greater than 0" },
          { status: 400 }
        );
      }
      // If auction is also enabled, buy now must be >= starting price
      if (parsedStartingPrice > 0 && parsedBuyNowPrice < parsedStartingPrice) {
        return NextResponse.json(
          { error: "Buy Now price must be at least the starting price" },
          { status: 400 }
        );
      }
    }

    // SECURITY: Validate URLs have safe protocols
    const urlsToValidate: Record<string, string | undefined> = { demoUrl, videoUrl, githubRepo, thumbnailUrl };
    if (screenshotUrls && Array.isArray(screenshotUrls)) {
      screenshotUrls.forEach((url: string, i: number) => {
        urlsToValidate[`screenshotUrls[${i}]`] = url;
      });
    }
    for (const [field, url] of Object.entries(urlsToValidate)) {
      if (url && !isValidUrl(url)) {
        return NextResponse.json(
          { error: `Invalid URL for ${field}: only http/https allowed` },
          { status: 400 }
        );
      }
    }

    // SECURITY: Validate wallet address format
    if (reservedBuyerWallet && reservedBuyerWallet.trim()) {
      if (!isValidSolanaAddress(reservedBuyerWallet.trim())) {
        return NextResponse.json(
          { error: "Invalid Solana wallet address format" },
          { status: 400 }
        );
      }
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

    // Calculate end time — clamp to config min/max to prevent out-of-range durations
    const { PLATFORM_CONFIG: _cfg } = await import("@/lib/config");
    const rawDuration = parseInt(duration) || _cfg.auction.defaultDuration;
    const durationDays = Math.max(_cfg.auction.minDuration, Math.min(_cfg.auction.maxDuration, rawDuration));
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
      // Wallet already validated above with isValidSolanaAddress
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
        // Hosting
        hasHosting,
        hostingProvider: hostingProvider || null,
        // Vercel
        hasVercel: hasVercel || false,
        vercelProjectUrl: vercelProjectUrl || null,
        vercelTeamSlug: vercelTeamSlug || null,
        // Domain
        hasDomain,
        domain: domain || null,
        // Database
        hasDatabase,
        databaseType: databaseProvider || null, // Map databaseProvider to databaseType field
        // Social & other assets
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
        // Agreement settings
        requiresNDA: requiresNDA || false,
        ndaTerms: requiresNDA ? ndaTerms : null,
        offersAPA: offersAPA || false,
        offersNonCompete: offersNonCompete || false,
        nonCompeteDurationYears: offersNonCompete ? (nonCompeteDurationYears || 1) : null,
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
  } catch (error) {
    console.error("Error creating listing:", error);
    console.error("Error details:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: "Failed to process listing" },
      { status: 500 }
    );
  }
}
