import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthToken } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";

// POST /api/collaborators/[id]/respond - Accept or decline a collaboration invite
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getAuthToken(request);
    if (!token?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = token.id as string;
    const { id: collaboratorId } = await params;
    const body = await request.json();

    const { action } = body; // "accept" or "decline"

    if (!["accept", "decline"].includes(action)) {
      return NextResponse.json(
        { error: "Action must be 'accept' or 'decline'" },
        { status: 400 }
      );
    }

    // Get the collaborator record
    const collaborator = await prisma.listingCollaborator.findUnique({
      where: { id: collaboratorId },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            slug: true,
            sellerId: true,
            status: true,
          },
        },
        user: {
          select: {
            id: true,
            walletAddress: true,
          },
        },
      },
    });

    if (!collaborator) {
      return NextResponse.json(
        { error: "Collaboration invite not found" },
        { status: 404 }
      );
    }

    // Verify the user is the collaborator
    // Check by userId if available, or by wallet address
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { walletAddress: true },
    });

    const isCollaborator =
      (collaborator.userId && collaborator.userId === userId) ||
      (currentUser?.walletAddress &&
       collaborator.walletAddress.toLowerCase() === currentUser.walletAddress.toLowerCase());

    if (!isCollaborator) {
      return NextResponse.json(
        { error: "You are not authorized to respond to this invitation" },
        { status: 403 }
      );
    }

    // Check if already responded
    if (collaborator.status !== "PENDING") {
      return NextResponse.json(
        { error: `You have already ${collaborator.status.toLowerCase()} this invitation` },
        { status: 400 }
      );
    }

    // Update the collaborator status
    const newStatus = action === "accept" ? "ACCEPTED" : "DECLINED";

    const updatedCollaborator = await prisma.listingCollaborator.update({
      where: { id: collaboratorId },
      data: {
        status: newStatus,
        respondedAt: new Date(),
        // Link userId if not already linked
        userId: collaborator.userId || userId,
      },
    });

    // Notify the listing owner
    await createNotification({
      userId: collaborator.listing.sellerId,
      type: action === "accept" ? "COLLABORATION_ACCEPTED" : "COLLABORATION_DECLINED",
      data: {
        listingId: collaborator.listing.id,
        listingSlug: collaborator.listing.slug,
        listingTitle: collaborator.listing.title,
        collaboratorId: collaborator.id,
        collaboratorWallet: collaborator.walletAddress,
      },
    });

    // If accepted, check if all collaborators have accepted and update listing status
    if (action === "accept") {
      const allCollaborators = await prisma.listingCollaborator.findMany({
        where: { listingId: collaborator.listing.id },
      });

      const allAccepted = allCollaborators.every(c => c.status === "ACCEPTED");

      if (allAccepted && collaborator.listing.status === "PENDING_COLLABORATORS") {
        // All collaborators accepted - move listing to the next status
        await prisma.listing.update({
          where: { id: collaborator.listing.id },
          data: { status: "ACTIVE" },
        });
      }
    }

    // If declined, the owner needs to adjust the listing
    // The listing stays in PENDING_COLLABORATORS until they remove/replace the declined collaborator

    return NextResponse.json({
      message: action === "accept"
        ? "You have joined this listing as a collaborator"
        : "You have declined the collaboration invite",
      collaborator: updatedCollaborator,
    });
  } catch (error) {
    console.error("Error responding to collaboration:", error);
    return NextResponse.json(
      { error: "Failed to respond to collaboration invite" },
      { status: 500 }
    );
  }
}

// GET /api/collaborators/[id]/respond - Get collaboration invite details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getAuthToken(request);
    if (!token?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: collaboratorId } = await params;

    const collaborator = await prisma.listingCollaborator.findUnique({
      where: { id: collaboratorId },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            slug: true,
            tagline: true,
            thumbnailUrl: true,
            categories: true,
            status: true,
            seller: {
              select: {
                id: true,
                username: true,
                displayName: true,
                name: true,
                image: true,
                isVerified: true,
              },
            },
          },
        },
      },
    });

    if (!collaborator) {
      return NextResponse.json(
        { error: "Collaboration invite not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ collaborator });
  } catch (error) {
    console.error("Error fetching collaboration:", error);
    return NextResponse.json(
      { error: "Failed to fetch collaboration invite" },
      { status: 500 }
    );
  }
}
