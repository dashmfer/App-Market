import { NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import prisma from "@/lib/db";

// Force dynamic rendering for this route
export const dynamic = "force-dynamic";

// GET /api/reviews/can-review?userId=xxx - Check if current user can review someone
export async function GET(request: NextRequest) {
  try {
    const token = await getAuthToken(request);
    if (!token?.id) {
      return NextResponse.json(
        { canReview: false, reason: "Not logged in" },
        { status: 200 }
      );
    }

    const authorId = token.id as string;
    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get("userId");

    if (!subjectId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // Can't review yourself
    if (authorId === subjectId) {
      return NextResponse.json({
        canReview: false,
        reason: "Cannot review yourself",
      });
    }

    // Check if user has Twitter linked
    const author = await prisma.user.findUnique({
      where: { id: authorId },
      select: { twitterVerified: true },
    });

    if (!author?.twitterVerified) {
      return NextResponse.json({
        canReview: false,
        reason: "Twitter account not linked",
        requiresTwitter: true,
      });
    }

    // Find reviewable interactions
    const reviewableItems: Array<{
      type: "TRANSACTION" | "MESSAGING";
      id: string;
      title?: string;
      alreadyReviewed: boolean;
    }> = [];

    // Check for completed transactions where user can review
    const transactions = await prisma.transaction.findMany({
      where: {
        status: "COMPLETED",
        OR: [
          { buyerId: authorId, sellerId: subjectId },
          { sellerId: authorId, buyerId: subjectId },
        ],
      },
      select: {
        id: true,
        listing: {
          select: {
            title: true,
          },
        },
        reviews: {
          where: { authorId },
          select: { id: true },
        },
      },
    });

    for (const tx of transactions) {
      reviewableItems.push({
        type: "TRANSACTION",
        id: tx.id,
        title: tx.listing.title,
        alreadyReviewed: tx.reviews.length > 0,
      });
    }

    // Check for conversations with messages
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { participant1Id: authorId, participant2Id: subjectId },
          { participant1Id: subjectId, participant2Id: authorId },
        ],
      },
      select: {
        id: true,
        _count: {
          select: { messages: true },
        },
      },
    });

    for (const conv of conversations) {
      // Only allow messaging reviews if there were messages exchanged
      if (conv._count.messages > 0) {
        const existingReview = await prisma.review.findUnique({
          where: {
            conversationId_authorId: {
              conversationId: conv.id,
              authorId,
            },
          },
        });

        reviewableItems.push({
          type: "MESSAGING",
          id: conv.id,
          title: "Message interaction",
          alreadyReviewed: !!existingReview,
        });
      }
    }

    const canReview = reviewableItems.some((item) => !item.alreadyReviewed);

    return NextResponse.json({
      canReview,
      reviewableItems,
      reason: canReview
        ? undefined
        : reviewableItems.length > 0
        ? "Already reviewed all interactions"
        : "No reviewable interactions",
    });
  } catch (error: any) {
    console.error("Error checking review eligibility:", error);
    return NextResponse.json(
      { error: "Failed to check review eligibility" },
      { status: 500 }
    );
  }
}
