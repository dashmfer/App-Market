import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";

// POST - Transfer lead buyer status to another partner
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; partnerId: string } }
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
            user: { select: { id: true, username: true, displayName: true } },
          },
        },
        listing: { select: { title: true, slug: true } },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Find current lead
    const currentLead = transaction.partners.find(p => p.isLead);
    if (!currentLead) {
      return NextResponse.json({ error: "No current lead found" }, { status: 400 });
    }

    // Only current lead can transfer
    if (currentLead.userId !== session.user.id) {
      return NextResponse.json({ error: "Only the current lead can transfer lead status" }, { status: 403 });
    }

    // Find new lead
    const newLead = transaction.partners.find(p => p.id === params.partnerId);
    if (!newLead) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }

    if (newLead.id === currentLead.id) {
      return NextResponse.json({ error: "Partner is already the lead" }, { status: 400 });
    }

    // New lead must be a registered user
    if (!newLead.userId) {
      return NextResponse.json({
        error: "New lead must be a registered user"
      }, { status: 400 });
    }

    // Transfer lead status
    await prisma.$transaction([
      prisma.transactionPartner.update({
        where: { id: currentLead.id },
        data: { isLead: false },
      }),
      prisma.transactionPartner.update({
        where: { id: newLead.id },
        data: { isLead: true },
      }),
    ]);

    // Notify new lead
    if (newLead.userId) {
      await createNotification({
        userId: newLead.userId,
        type: "PURCHASE_PARTNER_LEAD_TRANSFERRED",
        listingTitle: transaction.listing.title,
        data: {
          listingSlug: transaction.listing.slug,
          transactionId: params.id,
          previousLeadName: currentLead.user?.displayName || currentLead.user?.username || "Previous lead",
        },
      });
    }

    return NextResponse.json({
      success: true,
      newLeadId: newLead.id,
      message: "Lead status transferred successfully",
    });
  } catch (error) {
    console.error("Error transferring lead:", error);
    return NextResponse.json({ error: "Failed to transfer lead status" }, { status: 500 });
  }
}
