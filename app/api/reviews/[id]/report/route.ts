import { NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import prisma from "@/lib/db";
import { ReportReason } from "@prisma/client";

// POST /api/reviews/[id]/report - Report a review
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = await getAuthToken(request);
    if (!token?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const reporterId = token.id as string;
    const { id: reviewId } = params;

    const body = await request.json();
    const { reason, details } = body;

    // Validate reason
    const validReasons: ReportReason[] = [
      "INAPPROPRIATE",
      "SPAM",
      "HARASSMENT",
      "FALSE_INFORMATION",
      "OTHER",
    ];

    if (!reason || !validReasons.includes(reason)) {
      return NextResponse.json(
        { error: "Invalid or missing report reason" },
        { status: 400 }
      );
    }

    // Get the review
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        authorId: true,
        subjectId: true,
      },
    });

    if (!review) {
      return NextResponse.json(
        { error: "Review not found" },
        { status: 404 }
      );
    }

    // Can't report your own review
    if (review.authorId === reporterId) {
      return NextResponse.json(
        { error: "You cannot report your own review" },
        { status: 400 }
      );
    }

    // Check if already reported by this user
    const existingReport = await prisma.reviewReport.findUnique({
      where: {
        reviewId_reporterId: {
          reviewId,
          reporterId,
        },
      },
    });

    if (existingReport) {
      return NextResponse.json(
        { error: "You have already reported this review" },
        { status: 400 }
      );
    }

    // Create the report
    const report = await prisma.reviewReport.create({
      data: {
        reviewId,
        reporterId,
        reason,
        details: details || null,
      },
    });

    // Get count of reports for this review
    const reportCount = await prisma.reviewReport.count({
      where: { reviewId },
    });

    // If review has 3+ reports, flag it for admin review
    if (reportCount >= 3) {
      await prisma.review.update({
        where: { id: reviewId },
        data: { flaggedForReview: true },
      });

      // Create admin notification
      const admins = await prisma.user.findMany({
        where: { isAdmin: true },
        select: { id: true },
      });

      await Promise.all(
        admins.map((admin) =>
          prisma.notification.create({
            data: {
              type: "SYSTEM",
              title: "Review Flagged for Review",
              message: `A review has received ${reportCount} reports and requires admin attention`,
              userId: admin.id,
              data: {
                reviewId,
                reportCount,
              },
            },
          })
        )
      );
    }

    return NextResponse.json({
      success: true,
      reportId: report.id,
    });
  } catch (error) {
    console.error("Error reporting review:", error);
    return NextResponse.json(
      { error: "Failed to report review" },
      { status: 500 }
    );
  }
}
