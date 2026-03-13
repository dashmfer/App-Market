import { NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import prisma from "@/lib/db";
import { validateCsrfRequest, csrfError } from "@/lib/csrf";

// GET /api/reviews/[id]/response - Get response for a review
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: reviewId } = params;

    const response = await prisma.reviewResponse.findUnique({
      where: { reviewId },
      include: {
        responder: {
          select: {
            id: true,
            username: true,
            displayName: true,
            image: true,
            isVerified: true,
          },
        },
      },
    });

    if (!response) {
      return NextResponse.json({ response: null });
    }

    return NextResponse.json({ response });
  } catch (error) {
    console.error("Error fetching review response:", error);
    return NextResponse.json(
      { error: "Failed to fetch response" },
      { status: 500 }
    );
  }
}

// POST /api/reviews/[id]/response - Add response to a review (seller only)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // SECURITY: CSRF validation for state-changing endpoint
    const csrf = validateCsrfRequest(request);
    if (!csrf.valid) {
      return csrfError(csrf.error || "CSRF validation failed");
    }

    const token = await getAuthToken(request);
    if (!token?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const responderId = token.id as string;
    const { id: reviewId } = params;

    const body = await request.json();
    const { content } = body;

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Response content is required" },
        { status: 400 }
      );
    }

    if (content.length > 1000) {
      return NextResponse.json(
        { error: "Response must be 1000 characters or less" },
        { status: 400 }
      );
    }

    // Get the review
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        subjectId: true,
        authorId: true,
      },
    });

    if (!review) {
      return NextResponse.json(
        { error: "Review not found" },
        { status: 404 }
      );
    }

    // Only the subject of the review (the person being reviewed) can respond
    if (review.subjectId !== responderId) {
      return NextResponse.json(
        { error: "Only the person being reviewed can respond" },
        { status: 403 }
      );
    }

    // Check if already responded
    const existingResponse = await prisma.reviewResponse.findUnique({
      where: { reviewId },
    });

    if (existingResponse) {
      return NextResponse.json(
        { error: "You have already responded to this review" },
        { status: 400 }
      );
    }

    // Create the response
    const response = await prisma.reviewResponse.create({
      data: {
        reviewId,
        responderId,
        content: content.trim(),
      },
      include: {
        responder: {
          select: {
            id: true,
            username: true,
            displayName: true,
            image: true,
          },
        },
      },
    });

    // Notify the review author
    await prisma.notification.create({
      data: {
        type: "SYSTEM",
        title: "Response to Your Review",
        message: `${response.responder.displayName || response.responder.username} responded to your review`,
        userId: review.authorId,
        data: {
          reviewId,
          responseId: response.id,
        },
      },
    });

    return NextResponse.json({ response }, { status: 201 });
  } catch (error) {
    console.error("Error creating review response:", error);
    return NextResponse.json(
      { error: "Failed to create response" },
      { status: 500 }
    );
  }
}

// PUT /api/reviews/[id]/response - Edit response (within 24 hours)
export async function PUT(
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

    const responderId = token.id as string;
    const { id: reviewId } = params;

    const body = await request.json();
    const { content } = body;

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Response content is required" },
        { status: 400 }
      );
    }

    if (content.length > 1000) {
      return NextResponse.json(
        { error: "Response must be 1000 characters or less" },
        { status: 400 }
      );
    }

    // Get the existing response
    const existingResponse = await prisma.reviewResponse.findUnique({
      where: { reviewId },
    });

    if (!existingResponse) {
      return NextResponse.json(
        { error: "Response not found" },
        { status: 404 }
      );
    }

    if (existingResponse.responderId !== responderId) {
      return NextResponse.json(
        { error: "You can only edit your own response" },
        { status: 403 }
      );
    }

    // Check if within 24 hours
    const hoursSinceCreation =
      (Date.now() - existingResponse.createdAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceCreation > 24) {
      return NextResponse.json(
        { error: "Responses can only be edited within 24 hours" },
        { status: 400 }
      );
    }

    // Update the response
    const response = await prisma.reviewResponse.update({
      where: { reviewId },
      data: {
        content: content.trim(),
      },
      include: {
        responder: {
          select: {
            id: true,
            username: true,
            displayName: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json({ response });
  } catch (error) {
    console.error("Error updating review response:", error);
    return NextResponse.json(
      { error: "Failed to update response" },
      { status: 500 }
    );
  }
}
