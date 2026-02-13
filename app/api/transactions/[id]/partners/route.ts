import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";

// GET - Get all partners for a transaction
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: params.id },
      include: {
        partners: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                name: true,
                image: true,
                walletAddress: true,
                twitterUsername: true,
                twitterVerified: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Only buyer, seller, or partners can view
    const isParticipant =
      transaction.buyerId === session.user.id ||
      transaction.sellerId === session.user.id ||
      transaction.partners.some((p: { userId: string | null }) => p.userId === session.user.id);

    if (!isParticipant) {
      return NextResponse.json({ error: "Not authorized to view this transaction" }, { status: 403 });
    }

    return NextResponse.json({ partners: transaction.partners });
  } catch (error) {
    console.error("Error fetching partners:", error);
    return NextResponse.json({ error: "Failed to fetch partners" }, { status: 500 });
  }
}

// POST - Add a partner to a transaction
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { walletAddress, percentage } = body;
    // SECURITY: Look up userId by wallet instead of accepting from body
    let userId: string | null = null;
    if (walletAddress) {
      const matchedUser = await prisma.user.findFirst({
        where: { walletAddress: { equals: walletAddress, mode: "insensitive" as const } },
        select: { id: true },
      });
      userId = matchedUser?.id || null;
    }

    if (!walletAddress) {
      return NextResponse.json({ error: "Wallet address is required" }, { status: 400 });
    }

    if (!percentage || percentage <= 0 || percentage >= 100) {
      return NextResponse.json({ error: "Percentage must be between 1 and 99" }, { status: 400 });
    }

    // Wrap in serializable transaction to prevent percentage race conditions
    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: params.id },
        include: {
          partners: true,
          listing: { select: { title: true, slug: true } },
        },
      });

      if (!transaction) {
        return { error: "Transaction not found", status: 404 } as const;
      }

      const leadPartner = transaction.partners.find((p: { isLead: boolean }) => p.isLead);
      const isLeadBuyer = leadPartner
        ? leadPartner.userId === session.user.id
        : transaction.buyerId === session.user.id;

      if (!isLeadBuyer) {
        return { error: "Only the lead buyer can add partners", status: 403 } as const;
      }

      if (transaction.status !== "PENDING" && transaction.status !== "AWAITING_PARTNER_DEPOSITS") {
        return { error: "Cannot add partners after deposit phase", status: 400 } as const;
      }

      const existingPartner = transaction.partners.find(
        (p: { walletAddress: string }) => p.walletAddress.toLowerCase() === walletAddress.toLowerCase()
      );
      if (existingPartner) {
        return { error: "This wallet is already a partner", status: 400 } as const;
      }

      // Atomic percentage check within transaction — prevents two concurrent adds exceeding 100%
      const currentTotal = transaction.partners.reduce((sum: number, p: any) => sum + Number(p.percentage), 0);
      if (currentTotal + percentage > 100) {
        return {
          error: `Total percentage would exceed 100%. Current: ${currentTotal}%, Trying to add: ${percentage}%`,
          status: 400,
        } as const;
      }

      const depositAmount = (Number(transaction.salePrice) * percentage) / 100;

      const partner = await tx.transactionPartner.create({
        data: {
          transactionId: params.id,
          walletAddress,
          userId: userId || null,
          percentage,
          depositAmount,
          isLead: false,
          depositStatus: "PENDING",
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              name: true,
              image: true,
            },
          },
        },
      });

      if (!transaction.hasPartners) {
        await tx.transaction.update({
          where: { id: params.id },
          data: {
            hasPartners: true,
            status: "AWAITING_PARTNER_DEPOSITS",
            partnerDepositDeadline: new Date(Date.now() + 30 * 60 * 1000),
          },
        });
      }

      return { partner, listing: transaction.listing, depositAmount } as const;
    }, { isolationLevel: "Serializable" });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { partner, listing, depositAmount } = result;

    // Send notification outside transaction (non-critical)
    if (userId) {
      await createNotification({
        userId,
        type: "PURCHASE_PARTNER_INVITE",
        listingTitle: listing.title,
        data: {
          listingSlug: listing.slug,
          percentage,
          depositAmount,
          transactionId: params.id,
        },
      });
    }

    return NextResponse.json({ partner }, { status: 201 });
  } catch (error) {
    console.error("Error adding partner:", error);
    return NextResponse.json({ error: "Failed to add partner" }, { status: 500 });
  }
}

// DELETE - Remove a partner from a transaction
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get("partnerId");

    if (!partnerId) {
      return NextResponse.json({ error: "Partner ID is required" }, { status: 400 });
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: params.id },
      include: { partners: true },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const partnerToRemove = transaction.partners.find((p: { id: string }) => p.id === partnerId);
    if (!partnerToRemove) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }

    // Only lead buyer can remove partners (or partner can remove themselves)
    const leadPartner = transaction.partners.find((p: { isLead: boolean }) => p.isLead);
    const isLeadBuyer = leadPartner
      ? leadPartner.userId === session.user.id
      : transaction.buyerId === session.user.id;
    const isSelf = partnerToRemove.userId === session.user.id;

    if (!isLeadBuyer && !isSelf) {
      return NextResponse.json({ error: "Not authorized to remove this partner" }, { status: 403 });
    }

    // Can't remove lead buyer
    if (partnerToRemove.isLead) {
      return NextResponse.json({ error: "Cannot remove lead buyer. Transfer lead status first." }, { status: 400 });
    }

    // Can only remove before purchase is complete
    if (transaction.status !== "PENDING" && transaction.status !== "AWAITING_PARTNER_DEPOSITS") {
      return NextResponse.json({ error: "Cannot remove partners after deposit phase" }, { status: 400 });
    }

    // If partner has deposited, they need to be refunded (TODO: implement refund logic)
    if (partnerToRemove.depositStatus === "DEPOSITED") {
      return NextResponse.json({
        error: "Partner has already deposited. Cannot remove until refund is processed."
      }, { status: 400 });
    }

    // Remove the partner
    await prisma.transactionPartner.delete({
      where: { id: partnerId },
    });

    // Check if there are any remaining partners
    const remainingPartners = transaction.partners.filter((p: { id: string }) => p.id !== partnerId);
    if (remainingPartners.length === 1 && remainingPartners[0].isLead) {
      // Only lead buyer left, revert to single buyer mode
      await prisma.transaction.update({
        where: { id: params.id },
        data: {
          hasPartners: false,
          status: "PENDING",
          partnerDepositDeadline: null,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing partner:", error);
    return NextResponse.json({ error: "Failed to remove partner" }, { status: 500 });
  }
}

// PATCH - Update a partner's percentage
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { partnerId, percentage } = body;

    if (!partnerId) {
      return NextResponse.json({ error: "Partner ID is required" }, { status: 400 });
    }

    if (!percentage || percentage <= 0 || percentage >= 100) {
      return NextResponse.json({ error: "Percentage must be between 1 and 99" }, { status: 400 });
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: params.id },
      include: { partners: true },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Only lead buyer can update percentages
    const leadPartner = transaction.partners.find((p: { isLead: boolean }) => p.isLead);
    const isLeadBuyer = leadPartner
      ? leadPartner.userId === session.user.id
      : transaction.buyerId === session.user.id;

    if (!isLeadBuyer) {
      return NextResponse.json({ error: "Only the lead buyer can update percentages" }, { status: 403 });
    }

    // Can only update before deposits are complete
    if (transaction.status !== "PENDING" && transaction.status !== "AWAITING_PARTNER_DEPOSITS") {
      return NextResponse.json({ error: "Cannot update percentages after deposit phase" }, { status: 400 });
    }

    const partnerToUpdate = transaction.partners.find((p: { id: string }) => p.id === partnerId);
    if (!partnerToUpdate) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }

    // Can't update if already deposited
    if (partnerToUpdate.depositStatus === "DEPOSITED") {
      return NextResponse.json({ error: "Cannot update percentage after deposit" }, { status: 400 });
    }

    // Calculate total percentage excluding this partner
    const otherTotal = transaction.partners
      .filter((p: { id: string }) => p.id !== partnerId)
      .reduce((sum: number, p: any) => sum + Number(p.percentage), 0);

    if (otherTotal + percentage > 100) {
      return NextResponse.json({
        error: `Total percentage would exceed 100%. Other partners: ${otherTotal}%, Trying to set: ${percentage}%`
      }, { status: 400 });
    }

    // Calculate new deposit amount
    const depositAmount = (Number(transaction.salePrice) * percentage) / 100;

    // Update the partner
    const updatedPartner = await prisma.transactionPartner.update({
      where: { id: partnerId },
      data: {
        percentage,
        depositAmount,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            name: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json({ partner: updatedPartner });
  } catch (error) {
    console.error("Error updating partner:", error);
    return NextResponse.json({ error: "Failed to update partner" }, { status: 500 });
  }
}
