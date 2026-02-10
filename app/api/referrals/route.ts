import { NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PLATFORM_CONFIG } from "@/lib/config";
import { validateCsrfRequest, csrfError } from '@/lib/csrf';

// GET /api/referrals - Get user's referral info
export async function GET(request: NextRequest) {
  try {
    const token = await getAuthToken(request);
    if (!token?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: token.id as string },
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
export async function PATCH(request: NextRequest) {
  try {
    // SECURITY: Validate CSRF token
    const csrfValidation = validateCsrfRequest(request);
    if (!csrfValidation.valid) {
      return csrfError(csrfValidation.error || 'CSRF validation failed');
    }

    const token = await getAuthToken(request);
    if (!token?.id) {
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

    // Check if user already customized
    const user = await prisma.user.findUnique({
      where: { id: token.id as string },
      select: { referralCodeCustomized: true },
    });

    if (user?.referralCodeCustomized) {
      return NextResponse.json(
        { error: "You've already customized your referral code" },
        { status: 400 }
      );
    }

    // Check if code is taken
    const existing = await prisma.user.findUnique({
      where: { referralCode: cleanCode },
    });

    if (existing) {
      return NextResponse.json(
        { error: "This code is already taken" },
        { status: 400 }
      );
    }

    // Update code
    await prisma.user.update({
      where: { id: token.id as string },
      data: {
        referralCode: cleanCode,
        referralCodeCustomized: true,
      },
    });

    return NextResponse.json({ success: true, code: cleanCode });
  } catch (error) {
    console.error("Error updating referral code:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
