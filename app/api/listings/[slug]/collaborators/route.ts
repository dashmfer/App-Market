import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthToken } from "@/lib/auth";
import { CollaboratorRole, CollaboratorRoleDescription, CollaboratorStatus } from "@/lib/prisma-enums";
import { createNotification } from "@/lib/notifications";
import { validateCsrfRequest, csrfError } from '@/lib/csrf';

// GET /api/listings/[slug]/collaborators - Get all collaborators for a listing
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const listing = await prisma.listing.findUnique({
      where: { slug },
      include: {
        collaborators: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                name: true,
                image: true,
                isVerified: true,
                twitterUsername: true,
                twitterVerified: true,
                rating: true,
              },
            },
          },
          orderBy: [
            { role: "asc" }, // Partners first
            { percentage: "desc" },
          ],
        },
        seller: {
          select: {
            id: true,
            username: true,
            displayName: true,
            name: true,
            image: true,
            isVerified: true,
            rating: true,
          },
        },
      },
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    // Calculate seller's percentage (100% minus all collaborators)
    const collaboratorTotalPercentage = listing.collaborators.reduce(
      (sum: number, c: any) => sum + Number(c.percentage),
      0
    );
    const sellerPercentage = 100 - collaboratorTotalPercentage;

    return NextResponse.json({
      collaborators: listing.collaborators,
      seller: {
        ...listing.seller,
        percentage: sellerPercentage,
        role: "OWNER",
      },
      totalPercentage: 100,
      collaboratorCount: listing.collaborators.length,
      pendingCount: listing.collaborators.filter((c: { status: string }) => c.status === "PENDING").length,
    });
  } catch (error) {
    console.error("Error fetching collaborators:", error);
    return NextResponse.json(
      { error: "Failed to fetch collaborators" },
      { status: 500 }
    );
  }
}

// POST /api/listings/[slug]/collaborators - Add a collaborator to a listing
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
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

    const userId = token.id as string;
    const { slug } = await params;
    const body = await request.json();

    const {
      walletAddress,
      role,
      roleDescription,
      customRoleDescription,
      percentage,
    } = body;

    // Validate required fields
    if (!walletAddress || !role || percentage === undefined) {
      return NextResponse.json(
        { error: "walletAddress, role, and percentage are required" },
        { status: 400 }
      );
    }

    // Validate role
    if (!["PARTNER", "COLLABORATOR"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be PARTNER or COLLABORATOR" },
        { status: 400 }
      );
    }

    // Validate percentage
    if (percentage <= 0 || percentage > 99) {
      return NextResponse.json(
        { error: "Percentage must be between 0.01 and 99" },
        { status: 400 }
      );
    }

    // SECURITY [M9]: Wrap the listing lookup, percentage check, and collaborator creation
    // in a Serializable transaction to prevent race conditions on the 99% cap
    const { collaborator, listing, collaboratorUser } = await prisma.$transaction(async (tx) => {
      // Get the listing and verify ownership
      const listing = await tx.listing.findUnique({
        where: { slug },
        include: {
          collaborators: true,
          seller: {
            select: { id: true, walletAddress: true },
          },
        },
      });

      if (!listing) {
        throw new Error("LISTING_NOT_FOUND");
      }

      // Check if user is the owner or a partner with edit rights
      const isOwner = listing.sellerId === userId;
      const isPartnerWithEditRights = listing.collaborators.some(
        (c: { userId: string | null; canEdit: boolean; status: string }) => c.userId === userId && c.canEdit && c.status === "ACCEPTED"
      );

      if (!isOwner && !isPartnerWithEditRights) {
        throw new Error("NOT_AUTHORIZED");
      }

      // Check if listing is in a state that allows adding collaborators
      if (!["DRAFT", "PENDING_COLLABORATORS"].includes(listing.status)) {
        throw new Error("INVALID_LISTING_STATE");
      }

      // Check if wallet is already a collaborator
      const existingCollaborator = listing.collaborators.find(
        (c: { walletAddress: string }) => c.walletAddress.toLowerCase() === walletAddress.toLowerCase()
      );
      if (existingCollaborator) {
        throw new Error("ALREADY_COLLABORATOR");
      }

      // Can't add the listing owner as a collaborator
      if (listing.seller.walletAddress?.toLowerCase() === walletAddress.toLowerCase()) {
        throw new Error("CANNOT_ADD_OWNER");
      }

      // Calculate current total percentage
      const currentTotalPercentage = listing.collaborators.reduce(
        (sum: number, c: any) => sum + Number(c.percentage),
        0
      );

      // Check if adding this collaborator would exceed 99% (leaving at least 1% for owner)
      if (currentTotalPercentage + percentage > 99) {
        throw new Error(`PERCENTAGE_EXCEEDED:${currentTotalPercentage}:${percentage}`);
      }

      // Check if the wallet belongs to a registered user (check both primary wallet and UserWallet table)
      const normalizedWallet = walletAddress.toLowerCase();

      // First check primary wallet on User model
      let collaboratorUser = await tx.user.findFirst({
        where: {
          walletAddress: { equals: normalizedWallet, mode: "insensitive" },
        },
        select: { id: true, username: true, displayName: true, name: true },
      });

      // If not found, check UserWallet table for linked wallets
      if (!collaboratorUser) {
        const linkedWallet = await tx.userWallet.findFirst({
          where: {
            walletAddress: { equals: normalizedWallet, mode: "insensitive" },
          },
          select: {
            user: {
              select: { id: true, username: true, displayName: true, name: true },
            },
          },
        });
        collaboratorUser = linkedWallet?.user || null;
      }

      // Create the collaborator
      const collaborator = await tx.listingCollaborator.create({
        data: {
          listingId: listing.id,
          walletAddress,
          userId: collaboratorUser?.id || null,
          role: role as CollaboratorRole,
          roleDescription: (roleDescription || "OTHER") as CollaboratorRoleDescription,
          customRoleDescription: roleDescription === "OTHER" ? customRoleDescription : null,
          percentage,
          canEdit: role === "PARTNER",
          status: "PENDING",
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              name: true,
              image: true,
              walletAddress: true,
              isVerified: true,
            },
          },
        },
      });

      return { collaborator, listing, collaboratorUser };
    }, { isolationLevel: 'Serializable' });

    // Send notification to the collaborator if they're a registered user (outside transaction)
    if (collaboratorUser) {
      await createNotification({
        userId: collaboratorUser.id,
        type: "COLLABORATION_INVITE",
        title: "Collaboration Invite",
        message: `You've been invited as a ${role.toLowerCase()} on "${listing.title}" with ${percentage}% revenue share`,
        data: {
          listingId: listing.id,
          listingSlug: listing.slug,
          listingTitle: listing.title,
          collaboratorId: collaborator.id,
          role,
          percentage,
        },
      });
    }

    return NextResponse.json({
      collaborator,
      message: collaboratorUser
        ? "Collaborator added and notification sent"
        : "Collaborator added. They will need to connect their wallet to accept.",
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage === "LISTING_NOT_FOUND") {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }
    if (errorMessage === "NOT_AUTHORIZED") {
      return NextResponse.json({ error: "Only the listing owner or partners can add collaborators" }, { status: 403 });
    }
    if (errorMessage === "INVALID_LISTING_STATE") {
      return NextResponse.json({ error: "Cannot add collaborators to an active or completed listing" }, { status: 400 });
    }
    if (errorMessage === "ALREADY_COLLABORATOR") {
      return NextResponse.json({ error: "This wallet is already a collaborator on this listing" }, { status: 400 });
    }
    if (errorMessage === "CANNOT_ADD_OWNER") {
      return NextResponse.json({ error: "Cannot add the listing owner as a collaborator" }, { status: 400 });
    }
    if (errorMessage.startsWith("PERCENTAGE_EXCEEDED:")) {
      const parts = errorMessage.split(":");
      const currentTotal = parts[1];
      const requestedPct = parts[2];
      return NextResponse.json(
        { error: `Cannot add ${requestedPct}%. Current collaborator total is ${currentTotal}%. Maximum allowed is ${99 - Number(currentTotal)}%` },
        { status: 400 }
      );
    }

    console.error("Error adding collaborator:", error);
    return NextResponse.json(
      { error: "Failed to add collaborator" },
      { status: 500 }
    );
  }
}

// DELETE /api/listings/[slug]/collaborators - Remove a collaborator
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
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

    const userId = token.id as string;
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const collaboratorId = searchParams.get("collaboratorId");

    if (!collaboratorId) {
      return NextResponse.json(
        { error: "collaboratorId is required" },
        { status: 400 }
      );
    }

    // Get the listing
    const listing = await prisma.listing.findUnique({
      where: { slug },
      include: {
        collaborators: true,
      },
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    // Check if listing is in a state that allows removing collaborators
    if (!["DRAFT", "PENDING_COLLABORATORS"].includes(listing.status)) {
      return NextResponse.json(
        { error: "Cannot remove collaborators from an active or completed listing" },
        { status: 400 }
      );
    }

    // Find the collaborator
    const collaborator = listing.collaborators.find((c: { id: string }) => c.id === collaboratorId);
    if (!collaborator) {
      return NextResponse.json(
        { error: "Collaborator not found on this listing" },
        { status: 404 }
      );
    }

    // Check permissions - owner can remove anyone, collaborator can remove themselves
    const isOwner = listing.sellerId === userId;
    const isSelf = collaborator.userId === userId;

    if (!isOwner && !isSelf) {
      return NextResponse.json(
        { error: "Only the listing owner can remove collaborators" },
        { status: 403 }
      );
    }

    // Delete the collaborator
    await prisma.listingCollaborator.delete({
      where: { id: collaboratorId },
    });

    // Send notification if removed by owner and collaborator is a registered user
    if (!isSelf && collaborator.userId) {
      await createNotification({
        userId: collaborator.userId,
        type: "COLLABORATION_REMOVED",
        title: "Removed from Listing",
        message: `You've been removed from "${listing.title}"`,
        data: {
          listingId: listing.id,
          listingSlug: listing.slug,
          listingTitle: listing.title,
        },
      });
    }

    return NextResponse.json({
      message: "Collaborator removed successfully",
    });
  } catch (error) {
    console.error("Error removing collaborator:", error);
    return NextResponse.json(
      { error: "Failed to remove collaborator" },
      { status: 500 }
    );
  }
}

// PATCH /api/listings/[slug]/collaborators - Update a collaborator's percentage
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
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

    const userId = token.id as string;
    const { slug } = await params;
    const body = await request.json();

    const { collaboratorId, percentage, roleDescription, customRoleDescription } = body;

    if (!collaboratorId) {
      return NextResponse.json(
        { error: "collaboratorId is required" },
        { status: 400 }
      );
    }

    // Get the listing
    const listing = await prisma.listing.findUnique({
      where: { slug },
      include: {
        collaborators: true,
      },
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    // Check if listing is in a state that allows updating collaborators
    if (!["DRAFT", "PENDING_COLLABORATORS"].includes(listing.status)) {
      return NextResponse.json(
        { error: "Cannot update collaborators on an active or completed listing" },
        { status: 400 }
      );
    }

    // Check permissions
    const isOwner = listing.sellerId === userId;
    const isPartnerWithEditRights = listing.collaborators.some(
      (c: { userId: string | null; canEdit: boolean; status: string }) => c.userId === userId && c.canEdit && c.status === "ACCEPTED"
    );

    if (!isOwner && !isPartnerWithEditRights) {
      return NextResponse.json(
        { error: "Only the listing owner or partners can update collaborators" },
        { status: 403 }
      );
    }

    // Find the collaborator
    const collaborator = listing.collaborators.find((c: { id: string }) => c.id === collaboratorId);
    if (!collaborator) {
      return NextResponse.json(
        { error: "Collaborator not found on this listing" },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: any = {};

    if (percentage !== undefined) {
      if (percentage <= 0 || percentage > 99) {
        return NextResponse.json(
          { error: "Percentage must be between 0.01 and 99" },
          { status: 400 }
        );
      }

      // Calculate other collaborators' total
      const otherCollaboratorsTotal = listing.collaborators
        .filter((c: { id: string }) => c.id !== collaboratorId)
        .reduce((sum: number, c: any) => sum + Number(c.percentage), 0);

      if (otherCollaboratorsTotal + percentage > 99) {
        return NextResponse.json(
          { error: `Cannot set ${percentage}%. Other collaborators total is ${otherCollaboratorsTotal}%. Maximum allowed is ${99 - otherCollaboratorsTotal}%` },
          { status: 400 }
        );
      }

      updateData.percentage = percentage;
    }

    if (roleDescription !== undefined) {
      updateData.roleDescription = roleDescription;
      updateData.customRoleDescription = roleDescription === "OTHER" ? customRoleDescription : null;
    }

    // Update the collaborator
    const updatedCollaborator = await prisma.listingCollaborator.update({
      where: { id: collaboratorId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            name: true,
            image: true,
            walletAddress: true,
            isVerified: true,
          },
        },
      },
    });

    return NextResponse.json({
      collaborator: updatedCollaborator,
      message: "Collaborator updated successfully",
    });
  } catch (error) {
    console.error("Error updating collaborator:", error);
    return NextResponse.json(
      { error: "Failed to update collaborator" },
      { status: 500 }
    );
  }
}
