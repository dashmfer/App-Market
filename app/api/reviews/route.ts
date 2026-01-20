import { NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import prisma from "@/lib/db";

// Force dynamic rendering for this route
export const dynamic = "force-dynamic";

// GET /api/reviews - Get reviews for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const type = searchParams.get("type"); // "received" or "given"
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const where: any = {
      isVisible: true,
    };

    if (type === "given") {
      where.authorId = userId;
    } else {
      where.subjectId = userId;
    }

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          author: {
            select: {
              id: true,
              username: true,
              displayName: true,
              image: true,
              isVerified: true,
              twitterUsername: true,
              twitterVerified: true,
            },
          },
          subject: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
          transaction: {
            select: {
              id: true,
              listing: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                },
              },
            },
          },
        },
      }),
      prisma.review.count({ where }),
    ]);

    // Calculate aggregate stats for the user
    const stats = await prisma.review.aggregate({
      where: { subjectId: userId, isVisible: true },
      _avg: {
        rating: true,
        communicationRating: true,
        speedRating: true,
        accuracyRating: true,
      },
      _count: true,
    });

    return NextResponse.json({
      reviews,
      stats: {
        averageRating: stats._avg.rating || 0,
        averageCommunication: stats._avg.communicationRating || 0,
        averageSpeed: stats._avg.speedRating || 0,
        averageAccuracy: stats._avg.accuracyRating || 0,
        totalReviews: stats._count,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 }
    );
  }
}

// POST /api/reviews - Submit a review
export async function POST(request: NextRequest) {
  try {
    const token = await getAuthToken(request);
    if (!token?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const authorId = token.id as string;
    const body = await request.json();
    const {
      subjectId,
      transactionId,
      conversationId,
      rating,
      communicationRating,
      speedRating,
      accuracyRating,
      comment,
      type = "TRANSACTION",
    } = body;

    // Validate required fields
    if (!subjectId || !rating) {
      return NextResponse.json(
        { error: "subjectId and rating are required" },
        { status: 400 }
      );
    }

    // Validate rating values (1-5)
    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400 }
      );
    }

    // Can't review yourself
    if (authorId === subjectId) {
      return NextResponse.json(
        { error: "You cannot review yourself" },
        { status: 400 }
      );
    }

    // Check if user has Twitter linked (required for reviews)
    const author = await prisma.user.findUnique({
      where: { id: authorId },
      select: { twitterVerified: true },
    });

    if (!author?.twitterVerified) {
      return NextResponse.json(
        { error: "You must link your Twitter account to leave reviews" },
        { status: 403 }
      );
    }

    let reviewerRole: "BUYER" | "SELLER" = "BUYER";

    // For transaction-based reviews
    if (type === "TRANSACTION" && transactionId) {
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        select: {
          id: true,
          buyerId: true,
          sellerId: true,
          status: true,
        },
      });

      if (!transaction) {
        return NextResponse.json(
          { error: "Transaction not found" },
          { status: 404 }
        );
      }

      // Check if user is part of the transaction
      const isBuyer = transaction.buyerId === authorId;
      const isSeller = transaction.sellerId === authorId;

      if (!isBuyer && !isSeller) {
        return NextResponse.json(
          { error: "You are not part of this transaction" },
          { status: 403 }
        );
      }

      // Check if reviewing the correct party
      if (isBuyer && subjectId !== transaction.sellerId) {
        return NextResponse.json(
          { error: "As a buyer, you can only review the seller" },
          { status: 400 }
        );
      }

      if (isSeller && subjectId !== transaction.buyerId) {
        return NextResponse.json(
          { error: "As a seller, you can only review the buyer" },
          { status: 400 }
        );
      }

      // Check if transaction is completed
      if (transaction.status !== "COMPLETED") {
        return NextResponse.json(
          { error: "You can only review after the transaction is completed" },
          { status: 400 }
        );
      }

      reviewerRole = isBuyer ? "BUYER" : "SELLER";

      // Check for existing review
      const existingReview = await prisma.review.findUnique({
        where: {
          transactionId_authorId: {
            transactionId,
            authorId,
          },
        },
      });

      if (existingReview) {
        return NextResponse.json(
          { error: "You have already reviewed this transaction" },
          { status: 400 }
        );
      }
    }

    // For messaging-based reviews
    if (type === "MESSAGING" && conversationId) {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
          participant1Id: true,
          participant2Id: true,
        },
      });

      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }

      // Check if user is part of the conversation
      const isParticipant =
        conversation.participant1Id === authorId ||
        conversation.participant2Id === authorId;

      if (!isParticipant) {
        return NextResponse.json(
          { error: "You are not part of this conversation" },
          { status: 403 }
        );
      }

      // Check if reviewing the other participant
      const otherParticipant =
        conversation.participant1Id === authorId
          ? conversation.participant2Id
          : conversation.participant1Id;

      if (subjectId !== otherParticipant) {
        return NextResponse.json(
          { error: "You can only review the other participant" },
          { status: 400 }
        );
      }

      // Check for existing review
      const existingReview = await prisma.review.findUnique({
        where: {
          conversationId_authorId: {
            conversationId,
            authorId,
          },
        },
      });

      if (existingReview) {
        return NextResponse.json(
          { error: "You have already reviewed this conversation" },
          { status: 400 }
        );
      }
    }

    // Create the review
    const review = await prisma.review.create({
      data: {
        type: type as "TRANSACTION" | "MESSAGING",
        role: reviewerRole,
        rating,
        communicationRating: communicationRating || null,
        speedRating: speedRating || null,
        accuracyRating: accuracyRating || null,
        comment: comment || null,
        transactionId: type === "TRANSACTION" ? transactionId : null,
        conversationId: type === "MESSAGING" ? conversationId : null,
        authorId,
        subjectId,
      },
      include: {
        author: {
          select: {
            username: true,
            displayName: true,
            image: true,
          },
        },
      },
    });

    // Update the subject's rating stats
    const stats = await prisma.review.aggregate({
      where: { subjectId, isVisible: true },
      _avg: { rating: true },
      _count: true,
    });

    await prisma.user.update({
      where: { id: subjectId },
      data: {
        rating: stats._avg.rating || 0,
        ratingCount: stats._count,
      },
    });

    // Create notification for the subject
    await prisma.notification.create({
      data: {
        type: "REVIEW_RECEIVED",
        title: "New Review",
        message: `${review.author.displayName || review.author.username} left you a ${rating}-star review`,
        userId: subjectId,
        data: {
          reviewId: review.id,
          rating,
          authorId,
        },
      },
    });

    return NextResponse.json({ review }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating review:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create review" },
      { status: 500 }
    );
  }
}
