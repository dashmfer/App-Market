import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthToken } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { validateCsrfRequest, csrfError } from '@/lib/csrf';

// GET - Get all partners for a transaction
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = await getAuthToken(request);
    if (!token?.id) {
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
      transaction.buyerId === token.id as string ||
      transaction.sellerId === token.id as string ||
      transaction.partners.some((p: { userId: string | null }) => p.userId === token.id as string);

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
    // SECURITY: Validate CSRF token
    const csrfValidation = validateCsrfRequest(request);
    if (!csrfValidation.valid) {
      return csrfError(csrfValidation.error || 'CSRF validation failed');
    }

    const token = await getAuthToken(request);
    if (!token?.id) {
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

    if (typeof percentage !== 'number' || !Number.isFinite(percentage) || percentage <= 0 || percentage >= 100) {
      return NextResponse.json({ error: "Percentage must be a number between 0 (exclusive) and 100 (exclusive)" }, { status: 400 });
    }

    // SECURITY [H8]: Wrap partner read + percentage validation + create in an
    // atomic transaction to prevent race condition where concurrent requests
    // could exceed 100% total percentage
    const txResult = await prisma.$transaction(async (tx) => {
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

      // Only lead buyer can add partners
      const leadPartner = transaction.partners.find((p: { isLead: boolean }) => p.isLead);
      const isLeadBuyer = leadPartner
        ? leadPartner.userId === token.id as string
        : transaction.buyerId === token.id as string;

      if (!isLeadBuyer) {
        return { error: "Only the lead buyer can add partners", status: 403 } as const;
      }

      // Can only add partners before deposits are complete
      if (transaction.status !== "PENDING" && transaction.status !== "AWAITING_PARTNER_DEPOSITS") {
        return { error: "Cannot add partners after deposit phase", status: 400 } as const;
      }

      // Check if wallet already added
      const existingPartner = transaction.partners.find(
        (p: { walletAddress: string }) => p.walletAddress.toLowerCase() === walletAddress.toLowerCase()
      );
      if (existingPartner) {
        return { error: "This wallet is already a partner", status: 400 } as const;
      }

      // Calculate total percentage including new partner
      const currentTotal = transaction.partners.reduce((sum: number, p: any) => sum + Number(p.percentage), 0);
      if (currentTotal + percentage > 100) {
        return {
          error: `Total percentage would exceed 100%. Current: ${currentTotal}%, Trying to add: ${percentage}%`,
          status: 400,
        } as const;
      }

      // SECURITY: Integer-safe deposit amount calculation
      const salePrice = Number(transaction.salePrice);
      const currency = transaction.currency || "SOL";
      const decimals = currency === "USDC" ? 6 : 9;
      const base = Math.pow(10, decimals);
      const salePriceUnits = Math.round(salePrice * base);
      const depositUnits = Math.floor(salePriceUnits * percentage / 100);
      const depositAmount = depositUnits / base;

      // SECURITY [M4]: Validate computed deposit amount is positive and finite
      if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
        return { error: "Computed deposit amount is invalid. Sale price or percentage may be incorrect.", status: 400 } as const;
      }

      // Create the partner
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

      // Update transaction to indicate it has partners
      if (!transaction.hasPartners) {
        await tx.transaction.update({
          where: { id: params.id },
          data: {
            hasPartners: true,
            status: "AWAITING_PARTNER_DEPOSITS",
            partnerDepositDeadline: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
          },
        });
      }

      return { partner, transaction, depositAmount } as const;
    }, { isolationLevel: 'Serializable' });

    // Handle transaction errors
    if ('error' in txResult) {
      return NextResponse.json(
        { error: txResult.error },
        { status: txResult.status }
      );
    }

    const { partner, transaction, depositAmount } = txResult;

    // Send notification to the invited partner
    if (userId) {
      await createNotification({
        userId,
        type: "PURCHASE_PARTNER_INVITE",
        listingTitle: transaction.listing.title,
        data: {
          listingSlug: transaction.listing.slug,
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
    // SECURITY: Validate CSRF token
    const csrfValidation = validateCsrfRequest(request);
    if (!csrfValidation.valid) {
      return csrfError(csrfValidation.error || 'CSRF validation failed');
    }

    const token = await getAuthToken(request);
    if (!token?.id) {
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
      ? leadPartner.userId === token.id as string
      : transaction.buyerId === token.id as string;
    const isSelf = partnerToRemove.userId === token.id as string;

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
    // SECURITY: Validate CSRF token
    const csrfValidation = validateCsrfRequest(request);
    if (!csrfValidation.valid) {
      return csrfError(csrfValidation.error || 'CSRF validation failed');
    }

    const token = await getAuthToken(request);
    if (!token?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { partnerId, percentage } = body;

    if (!partnerId) {
      return NextResponse.json({ error: "Partner ID is required" }, { status: 400 });
    }

    if (typeof percentage !== 'number' || !Number.isFinite(percentage) || percentage <= 0 || percentage >= 100) {
      return NextResponse.json({ error: "Percentage must be a number between 0 (exclusive) and 100 (exclusive)" }, { status: 400 });
    }

    // SECURITY [M1]: Wrap percentage read + validation + update in a serializable
    // transaction to prevent race conditions where concurrent PATCH requests
    // could exceed 100% total percentage
    const txResult = await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: params.id },
        include: { partners: true },
      });

      if (!transaction) {
        return { error: "Transaction not found", status: 404 } as const;
      }

      // Only lead buyer can update percentages
      const leadPartner = transaction.partners.find((p: { isLead: boolean }) => p.isLead);
      const isLeadBuyer = leadPartner
        ? leadPartner.userId === token.id as string
        : transaction.buyerId === token.id as string;

      if (!isLeadBuyer) {
        return { error: "Only the lead buyer can update percentages", status: 403 } as const;
      }

      // Can only update before deposits are complete
      if (transaction.status !== "PENDING" && transaction.status !== "AWAITING_PARTNER_DEPOSITS") {
        return { error: "Cannot update percentages after deposit phase", status: 400 } as const;
      }

      const partnerToUpdate = transaction.partners.find((p: { id: string }) => p.id === partnerId);
      if (!partnerToUpdate) {
        return { error: "Partner not found", status: 404 } as const;
      }

      // Can't update if already deposited
      if (partnerToUpdate.depositStatus === "DEPOSITED") {
        return { error: "Cannot update percentage after deposit", status: 400 } as const;
      }

      // Calculate total percentage excluding this partner
      const otherTotal = transaction.partners
        .filter((p: { id: string }) => p.id !== partnerId)
        .reduce((sum: number, p: any) => sum + Number(p.percentage), 0);

      if (otherTotal + percentage > 100) {
        return {
          error: `Total percentage would exceed 100%. Other partners: ${otherTotal}%, Trying to set: ${percentage}%`,
          status: 400,
        } as const;
      }

      // Calculate new deposit amount
      const depositAmount = (Number(transaction.salePrice) * percentage) / 100;

      // SECURITY [M4]: Validate computed deposit amount is positive and finite
      if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
        return { error: "Computed deposit amount is invalid. Sale price or percentage may be incorrect.", status: 400 } as const;
      }

      // Update the partner
      const updatedPartner = await tx.transactionPartner.update({
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

      return { partner: updatedPartner } as const;
    }, { isolationLevel: 'Serializable' });

    // Handle transaction errors
    if ('error' in txResult) {
      return NextResponse.json(
        { error: txResult.error },
        { status: txResult.status }
      );
    }

    return NextResponse.json({ partner: txResult.partner });
  } catch (error) {
    console.error("Error updating partner:", error);
    return NextResponse.json({ error: "Failed to update partner" }, { status: 500 });
  }
}
