import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthToken } from "@/lib/auth";
import {
  validateDomainTransferLink,
  validateAuthCode,
  detectRegistrarFromUrl,
} from "@/lib/domain-transfer";

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  iconType: string;
  required: boolean;
  sellerConfirmed: boolean;
  sellerConfirmedAt: string | null;
  sellerEvidence: string | null;
  buyerConfirmed: boolean;
  buyerConfirmedAt: string | null;
}

// Extended evidence structure for domain transfers
interface DomainTransferEvidence {
  transferLink?: string;
  authCode?: string;
  registrar?: string;
  notes?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = await getAuthToken(request);
    if (!token?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { itemId, evidence, transferLink, authCode, notes } = body;

    // For domain transfers, require structured data
    if (itemId === "domain") {
      if (!transferLink && !authCode) {
        return NextResponse.json(
          { error: "Domain transfer requires a transfer link or auth code" },
          { status: 400 }
        );
      }

      // Validate transfer link if provided
      if (transferLink) {
        const linkValidation = validateDomainTransferLink(transferLink);
        if (!linkValidation.isValid) {
          return NextResponse.json(
            {
              error: linkValidation.error || "Invalid transfer link",
              suggestions: linkValidation.suggestions,
            },
            { status: 400 }
          );
        }

        // Warn if not a recognized transfer URL (but don't block)
        if (!linkValidation.isTransferUrl && linkValidation.registrar) {
          // We'll include a warning but still allow it
        }
      }

      // Validate auth code if provided
      if (authCode) {
        const registrar = transferLink ? detectRegistrarFromUrl(transferLink) : null;
        const codeValidation = validateAuthCode(authCode, registrar || undefined);
        if (!codeValidation.isValid) {
          return NextResponse.json(
            { error: codeValidation.error || "Invalid auth code format" },
            { status: 400 }
          );
        }
      }
    } else {
      // For non-domain items, require basic evidence
      if (!itemId || !evidence) {
        return NextResponse.json(
          { error: "Item ID and evidence are required" },
          { status: 400 }
        );
      }
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: params.id },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
    }

    // Check if 7-day transfer deadline has passed
    const transferDeadline = new Date(transaction.createdAt);
    transferDeadline.setDate(transferDeadline.getDate() + 7);
    if (new Date() > transferDeadline) {
      return NextResponse.json(
        { error: "Transfer deadline has passed. This transaction will be refunded to the buyer." },
        { status: 400 }
      );
    }

    // Only seller can confirm transfers
    if (transaction.sellerId !== token.id as string) {
      return NextResponse.json(
        { error: "Only the seller can confirm transfers" },
        { status: 403 }
      );
    }

    // Get current checklist
    const checklist = transaction.transferChecklist as ChecklistItem[] | null;
    if (!checklist) {
      return NextResponse.json(
        { error: "Transfer checklist not initialized" },
        { status: 400 }
      );
    }

    // Find and update the item
    const itemIndex = checklist.findIndex((item) => item.id === itemId);
    if (itemIndex === -1) {
      return NextResponse.json(
        { error: "Checklist item not found" },
        { status: 404 }
      );
    }

    if (checklist[itemIndex].sellerConfirmed) {
      return NextResponse.json(
        { error: "Item already confirmed" },
        { status: 400 }
      );
    }

    // Build evidence based on item type
    let evidenceData: string;
    if (itemId === "domain") {
      // Store structured domain transfer data as JSON
      const domainEvidence: DomainTransferEvidence = {};
      if (transferLink) {
        domainEvidence.transferLink = transferLink;
        const registrar = detectRegistrarFromUrl(transferLink);
        if (registrar) {
          domainEvidence.registrar = registrar.name;
        }
      }
      if (authCode) {
        domainEvidence.authCode = authCode;
      }
      if (notes) {
        domainEvidence.notes = notes;
      }
      evidenceData = JSON.stringify(domainEvidence);
    } else {
      evidenceData = evidence;
    }

    // Update the item
    checklist[itemIndex] = {
      ...checklist[itemIndex],
      sellerConfirmed: true,
      sellerConfirmedAt: new Date().toISOString(),
      sellerEvidence: evidenceData,
    };

    // Check if all required items are confirmed by seller
    const allRequiredSellerConfirmed = checklist
      .filter((item) => item.required)
      .every((item) => item.sellerConfirmed);

    // Update transaction
    await prisma.transaction.update({
      where: { id: params.id },
      data: {
        transferChecklist: checklist as any,
        sellerConfirmedTransfer: allRequiredSellerConfirmed,
        status: allRequiredSellerConfirmed ? "AWAITING_CONFIRMATION" : "TRANSFER_IN_PROGRESS",
        transferStartedAt: transaction.transferStartedAt || new Date(),
      },
    });

    // Create notification for buyer
    await prisma.notification.create({
      data: {
        userId: transaction.buyerId,
        type: "TRANSFER_STARTED",
        title: "Asset Transfer Update",
        message: `The seller has confirmed transfer of: ${checklist[itemIndex].label}`,
        data: {
          transactionId: transaction.id,
          itemId,
          evidence,
        },
      },
    });

    return NextResponse.json({
      success: true,
      checklist,
      message: "Transfer confirmed successfully",
    });
  } catch (error) {
    console.error("Error confirming seller transfer:", error);
    return NextResponse.json(
      { error: "Failed to confirm transfer" },
      { status: 500 }
    );
  }
}
