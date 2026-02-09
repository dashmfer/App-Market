import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Token Launch Feature (Coming Soon)
 * 
 * This endpoint will allow buyers to launch tokens for acquired projects.
 * Platform receives 1% of token supply.
 * 
 * Flow:
 * 1. Buyer acquires project
 * 2. Buyer configures token launch (name, symbol, supply, etc.)
 * 3. Platform creates token via pump.fun or custom launch
 * 4. 1% of supply goes to platform treasury
 * 5. Buyer receives remaining supply or launches via bonding curve
 */

// POST /api/token-launch - Launch a token for an acquired project
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      transactionId, // The acquisition transaction
      tokenName,
      tokenSymbol,
      totalSupply,
      launchType, // "FAIR_LAUNCH" or "PRESALE"
      description,
      imageUrl,
      twitter,
      telegram,
      website,
    } = body;

    // Validate required fields
    if (!transactionId || !tokenName || !tokenSymbol || !totalSupply) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify the user owns this project
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        listing: true,
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    if (transaction.buyerId !== session.user.id) {
      return NextResponse.json(
        { error: "You do not own this project" },
        { status: 403 }
      );
    }

    if (transaction.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Project transfer must be complete before launching token" },
        { status: 400 }
      );
    }

    // Validate totalSupply
    if (typeof totalSupply !== "number" || !isFinite(totalSupply) || totalSupply <= 0) {
      return NextResponse.json(
        { error: "totalSupply must be a positive number" },
        { status: 400 }
      );
    }

    // Calculate platform token allocation (1% of supply)
    const platformAllocation = BigInt(Math.floor(totalSupply * 0.01));

    // Create token launch record
    const tokenLaunch = await prisma.tokenLaunch.create({
      data: {
        tokenName,
        tokenSymbol,
        totalSupply: BigInt(totalSupply),
        launchType: launchType || "FAIR_LAUNCH",
        platformTokens: platformAllocation,
        status: "PENDING",
        projectId: transaction.listingId,
      },
    });

    // TODO: Integrate with pump.fun or custom token launch
    // For now, return a placeholder response
    
    return NextResponse.json({
      success: true,
      tokenLaunch: {
        id: tokenLaunch.id,
        tokenName,
        tokenSymbol,
        totalSupply: totalSupply.toString(),
        platformAllocation: platformAllocation.toString(),
        status: "PENDING",
        message: "Token launch feature coming soon! Your request has been recorded.",
      },
    }, { status: 201 });

  } catch (error) {
    console.error("Error launching token:", error);
    return NextResponse.json(
      { error: "Failed to launch token" },
      { status: 500 }
    );
  }
}

// GET /api/token-launch - Get token launches (authenticated)
export async function GET(request: NextRequest) {
  try {
    // Require authentication to view token launches
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    // Only show token launches the user owns (via completed transactions)
    const userTransactions = await prisma.transaction.findMany({
      where: { buyerId: session.user.id, status: "COMPLETED" },
      select: { listingId: true },
    });
    const ownedProjectIds = userTransactions.map((t: { listingId: string }) => t.listingId);

    const where: any = { projectId: { in: ownedProjectIds } };
    if (projectId) {
      if (!ownedProjectIds.includes(projectId)) {
        return NextResponse.json({ error: "Not authorized to view this project's token launches" }, { status: 403 });
      }
      where.projectId = projectId;
    }

    const tokenLaunches = await prisma.tokenLaunch.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const formattedLaunches = tokenLaunches.map((launch: typeof tokenLaunches[number]) => ({
      ...launch,
      totalSupply: launch.totalSupply.toString(),
      platformTokens: launch.platformTokens?.toString(),
    }));

    return NextResponse.json({ tokenLaunches: formattedLaunches });
  } catch (error) {
    console.error("Error fetching token launches:", error);
    return NextResponse.json(
      { error: "Failed to fetch token launches" },
      { status: 500 }
    );
  }
}
