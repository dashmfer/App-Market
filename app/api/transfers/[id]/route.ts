import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Default checklist structure
const DEFAULT_CHECKLIST = [
  {
    id: "github",
    label: "GitHub Repository",
    description: "Transfer ownership of the repository to buyer",
    iconType: "github",
    required: true,
    sellerConfirmed: false,
    sellerConfirmedAt: null,
    sellerEvidence: null,
    buyerConfirmed: false,
    buyerConfirmedAt: null,
  },
  {
    id: "domain",
    label: "Domain",
    description: "Transfer domain ownership via registrar",
    iconType: "domain",
    required: true,
    sellerConfirmed: false,
    sellerConfirmedAt: null,
    sellerEvidence: null,
    buyerConfirmed: false,
    buyerConfirmedAt: null,
  },
  {
    id: "database",
    label: "Database Access",
    description: "Provide database credentials and data export",
    iconType: "database",
    required: true,
    sellerConfirmed: false,
    sellerConfirmedAt: null,
    sellerEvidence: null,
    buyerConfirmed: false,
    buyerConfirmedAt: null,
  },
  {
    id: "apiKeys",
    label: "API Keys & Credentials",
    description: "Share all necessary API keys and service credentials",
    iconType: "apiKeys",
    required: true,
    sellerConfirmed: false,
    sellerConfirmedAt: null,
    sellerEvidence: null,
    buyerConfirmed: false,
    buyerConfirmedAt: null,
  },
  {
    id: "designFiles",
    label: "Design Files",
    description: "Share Figma/Sketch files",
    iconType: "designFiles",
    required: false,
    sellerConfirmed: false,
    sellerConfirmedAt: null,
    sellerEvidence: null,
    buyerConfirmed: false,
    buyerConfirmedAt: null,
  },
  {
    id: "documentation",
    label: "Documentation",
    description: "Provide setup guides and documentation",
    iconType: "documentation",
    required: false,
    sellerConfirmed: false,
    sellerConfirmedAt: null,
    sellerEvidence: null,
    buyerConfirmed: false,
    buyerConfirmedAt: null,
  },
];

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
        listing: {
          select: {
            id: true,
            title: true,
            slug: true,
            hasDomain: true,
            hasDatabase: true,
            hasApiKeys: true,
            hasDesignFiles: true,
            hasDocumentation: true,
            githubRepo: true,
            offersAPA: true,
            offersNonCompete: true,
            nonCompeteDurationYears: true,
          },
        },
        buyer: {
          select: {
            id: true,
            name: true,
            username: true,
            displayName: true,
            walletAddress: true,
          },
        },
        seller: {
          select: {
            id: true,
            name: true,
            username: true,
            displayName: true,
            walletAddress: true,
          },
        },
        uploads: true,
        partners: {
          where: { depositStatus: "DEPOSITED" },
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
        },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
    }

    // Check if user is a purchase partner
    const userPartner = transaction.partners.find((p: { userId: string | null }) => p.userId === session.user.id);
    const isPartner = !!userPartner;

    // Only buyer, seller, or partners can view
    if (transaction.buyerId !== session.user.id && transaction.sellerId !== session.user.id && !isPartner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Initialize or customize checklist based on listing assets
    let checklist = transaction.transferChecklist as typeof DEFAULT_CHECKLIST | null;
    if (!checklist) {
      // Build checklist based on what the listing actually includes
      checklist = DEFAULT_CHECKLIST.map((item) => {
        let required = item.required;

        // Adjust required status based on listing assets
        if (item.id === "github") {
          required = !!transaction.listing.githubRepo;
        } else if (item.id === "domain") {
          required = transaction.listing.hasDomain;
        } else if (item.id === "database") {
          required = transaction.listing.hasDatabase;
        } else if (item.id === "apiKeys") {
          required = transaction.listing.hasApiKeys;
        } else if (item.id === "designFiles") {
          required = transaction.listing.hasDesignFiles;
        } else if (item.id === "documentation") {
          required = transaction.listing.hasDocumentation;
        }

        return { ...item, required };
      });

      // Save initialized checklist
      await prisma.transaction.update({
        where: { id: params.id },
        data: { transferChecklist: checklist as any },
      });
    }

    // Calculate transfer deadline (7 days from sale)
    const transferDeadline = new Date(transaction.createdAt);
    transferDeadline.setDate(transferDeadline.getDate() + 7);

    const response = {
      id: transaction.id,
      listing: transaction.listing,
      salePrice: Number(transaction.salePrice),
      platformFee: Number(transaction.platformFee),
      sellerProceeds: Number(transaction.sellerProceeds),
      currency: transaction.currency,
      status: transaction.status,
      buyer: {
        id: transaction.buyer.id,
        name: transaction.buyer.displayName || transaction.buyer.name || (transaction.buyer.username ? `@${transaction.buyer.username}` : null) || (transaction.buyer.walletAddress ? `${transaction.buyer.walletAddress.slice(0, 4)}...${transaction.buyer.walletAddress.slice(-4)}` : "Anonymous"),
        username: transaction.buyer.username || null,
        walletAddress: transaction.buyer.walletAddress
          ? `${transaction.buyer.walletAddress.slice(0, 4)}...${transaction.buyer.walletAddress.slice(-4)}`
          : null,
      },
      seller: {
        id: transaction.seller.id,
        name: transaction.seller.displayName || transaction.seller.name || (transaction.seller.username ? `@${transaction.seller.username}` : null) || (transaction.seller.walletAddress ? `${transaction.seller.walletAddress.slice(0, 4)}...${transaction.seller.walletAddress.slice(-4)}` : "Anonymous"),
        username: transaction.seller.username || null,
        walletAddress: transaction.seller.walletAddress
          ? `${transaction.seller.walletAddress.slice(0, 4)}...${transaction.seller.walletAddress.slice(-4)}`
          : null,
      },
      escrowAddress: transaction.escrowAddress,
      createdAt: transaction.createdAt,
      transferDeadline,
      checklist,
      isSeller: transaction.sellerId === session.user.id,
      isBuyer: transaction.buyerId === session.user.id || isPartner,
      isPartner,
      // Partner information for majority vote UI
      hasPartners: transaction.hasPartners,
      partners: transaction.hasPartners ? transaction.partners.map((p: typeof transaction.partners[number]) => ({
        id: p.id,
        userId: p.userId,
        walletAddress: `${p.walletAddress.slice(0, 4)}...${p.walletAddress.slice(-4)}`,
        percentage: p.percentage,
        isLead: p.isLead,
        hasConfirmedTransfer: p.hasConfirmedTransfer,
        user: p.user ? {
          id: p.user.id,
          name: p.user.displayName || p.user.username || p.user.name,
          image: p.user.image,
        } : null,
      })) : [],
      confirmationsNeeded: transaction.hasPartners
        ? Math.floor(transaction.partners.length / 2) + 1
        : 1,
      // Agreement fields
      apaSigned: transaction.apaSigned,
      apaSignedAt: transaction.apaSignedAt,
      apaSignature: transaction.apaSignature,
      nonCompeteSigned: transaction.nonCompeteSigned,
      nonCompeteSignedAt: transaction.nonCompeteSignedAt,
      nonCompeteSignature: transaction.nonCompeteSignature,
      buyerRequestedAPA: transaction.buyerRequestedAPA,
      buyerRequestedNonCompete: transaction.buyerRequestedNonCompete,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching transfer:", error);
    return NextResponse.json({ error: "Failed to fetch transfer" }, { status: 500 });
  }
}
