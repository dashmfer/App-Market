import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PLATFORM_CONFIG } from "@/lib/config";

// GET /api/referrals - Get user's referral info
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        referralCode: true,
        referralCodeCustomized: true,
        referralEarnings: true,
        referralsGiven: {
          include: {
            referredUser: {
              select: {
                id: true,
                username: true,
                walletAddress: true,
                totalSales: true,
                createdAt: true,
              },
            },
            earnings: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Calculate stats
    const totalReferrals = user.referralsGiven.length;
    const activeReferrals = user.referralsGiven.filter(
      (r: { status: string }) => r.status === "ACTIVE"
    ).length;
    const pendingEarnings = user.referralsGiven.reduce(
      (sum: number, r: any) =>
        sum +
        r.earnings
          .filter((e: any) => e.status === "PENDING")
          .reduce((s: number, e: any) => s + Number(e.earnedAmount), 0),
      0
    );
    const availableEarnings = user.referralsGiven.reduce(
      (sum: number, r: any) =>
        sum +
        r.earnings
          .filter((e: any) => e.status === "AVAILABLE")
          .reduce((s: number, e: any) => s + Number(e.earnedAmount), 0),
      0
    );

    return NextResponse.json({
      code: user.referralCode,
      isCustomized: user.referralCodeCustomized,
      totalEarnings: Number(user.referralEarnings),
      pendingEarnings,
      availableEarnings,
      totalReferrals,
      activeReferrals,
      referrals: user.referralsGiven.map((r: typeof user.referralsGiven[number]) => ({
        id: r.id,
        user:
          r.referredUser.username ||
          r.referredUser.walletAddress?.slice(0, 8) + "...",
        status: r.status,
        earnings: r.totalEarnings,
        joinedAt: r.createdAt,
      })),
      commissionRate: PLATFORM_CONFIG.referral.commissionRateBps / 100,
    });
  } catch (error) {
    console.error("Error fetching referral info:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/referrals - Update referral code (one time only)
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code } = await request.json();

    // Validate code
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    const cleanCode = code.toLowerCase().trim();

    if (cleanCode.length < PLATFORM_CONFIG.referral.codeMinLength) {
      return NextResponse.json(
        { error: `Code must be at least ${PLATFORM_CONFIG.referral.codeMinLength} characters` },
        { status: 400 }
      );
    }

    if (cleanCode.length > PLATFORM_CONFIG.referral.codeMaxLength) {
      return NextResponse.json(
        { error: `Code must be ${PLATFORM_CONFIG.referral.codeMaxLength} characters or less` },
        { status: 400 }
      );
    }

    if (!/^[a-z0-9_-]+$/.test(cleanCode)) {
      return NextResponse.json(
        { error: "Only lowercase letters, numbers, underscore, and hyphen allowed" },
        { status: 400 }
      );
    }

    // Atomically check uniqueness and update within a transaction.
    // Relies on the unique constraint on referralCode — if two users try to
    // claim the same code concurrently, one will get a Prisma unique constraint error.
    try {
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: session.user.id },
          select: { referralCodeCustomized: true },
        });

        if (user?.referralCodeCustomized) {
          throw new Error("ALREADY_CUSTOMIZED");
        }

        // The unique constraint on referralCode will reject duplicates atomically
        await tx.user.update({
          where: { id: session.user.id },
          data: {
            referralCode: cleanCode,
            referralCodeCustomized: true,
          },
        });
      }, { isolationLevel: 'Serializable' });
    } catch (txError: any) {
      if (txError?.message === "ALREADY_CUSTOMIZED") {
        return NextResponse.json(
          { error: "You've already customized your referral code" },
          { status: 400 }
        );
      }
      // Prisma unique constraint violation
      if (txError?.code === "P2002") {
        return NextResponse.json(
          { error: "This code is already taken" },
          { status: 400 }
        );
      }
      throw txError;
    }

    return NextResponse.json({ success: true, code: cleanCode });
  } catch (error) {
    console.error("Error updating referral code:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
