"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { motion } from "framer-motion";
import {
  Clock,
  Gavel,
  ShoppingCart,
  Heart,
  Share2,
  CheckCircle2,
  ExternalLink,
  Github,
  Globe,
  Database,
  Key,
  FileText,
  Palette,
  Users,
  Star,
  TrendingUp,
  Shield,
  AlertCircle,
  ChevronRight,
  Play,
  Loader2,
  Package,
  MessageCircle,
  Send,
  X,
  Lock,
  DollarSign,
} from "lucide-react";
import { startConversation } from "@/hooks/useMessages";
import { format, formatDistanceToNow } from "date-fns";
import { useCountdown } from "@/hooks/useCountdown";
import { CollaboratorDisplay } from "@/components/listings/collaborator-display";
import { PurchasePartnersDisplay } from "@/components/listings/purchase-partners-display";
import { NDAGate } from "@/components/listings/NDAGate";

// Helper to format currency display
const formatCurrency = (currency: string): string => {
  switch (currency) {
    case "APP":
      return "$APP";
    case "USDC":
      return "USDC";
    default:
      return "SOL";
  }
};

interface RequiredBuyerInfoItem {
  required: boolean;
  description?: string;
}

interface RequiredBuyerInfo {
  github?: RequiredBuyerInfoItem;
  domain?: RequiredBuyerInfoItem;
  email?: RequiredBuyerInfoItem;
  walletAddress?: RequiredBuyerInfoItem;
  other?: RequiredBuyerInfoItem;
}

interface ReservationInfo {
  isReserved: boolean;
  isReservedForCurrentUser: boolean;
  reservedBuyerName: string | null;
  reservedAt: string | null;
}

interface CollaboratorUser {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  image: string | null;
  walletAddress: string | null;
  isVerified: boolean;
  twitterUsername?: string | null;
  twitterVerified?: boolean;
}

interface Collaborator {
  id: string;
  walletAddress: string;
  role: "PARTNER" | "COLLABORATOR";
  roleDescription: string;
  customRoleDescription?: string | null;
  percentage: number;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  user: CollaboratorUser | null;
}

interface PurchasePartner {
  id: string;
  walletAddress: string;
  percentage: number;
  isLead: boolean;
  user: {
    id: string;
    username: string | null;
    displayName: string | null;
    name: string | null;
    image: string | null;
  } | null;
}

interface Listing {
  id: string;
  slug: string;
  title: string;
  tagline?: string;
  description: string;
  category?: string;
  categories?: string[];
  techStack: string[];
  githubRepo?: string;
  hasDomain: boolean;
  domain?: string;
  hasDatabase: boolean;
  databaseType?: string;
  hasHosting: boolean;
  hostingProvider?: string;
  hasVercel: boolean;
  vercelProjectUrl?: string;
  vercelTeamSlug?: string;
  requiresNDA: boolean;
  ndaTerms?: string;
  hasSocialAccounts: boolean;
  hasApiKeys: boolean;
  hasDesignFiles: boolean;
  hasDocumentation: boolean;
  thumbnailUrl?: string;
  screenshotUrls: string[];
  demoUrl?: string;
  videoUrl?: string;
  monthlyUsers?: number;
  monthlyRevenue?: number;
  githubStars?: number;
  listingType: string;
  startingPrice: number;
  reservePrice?: number;
  buyNowPrice?: number;
  buyNowEnabled: boolean;
  currency: string;
  startTime: string;
  endTime: string;
  currentBid: number;
  bidCount: number;
  status?: string;
  requiredBuyerInfo?: RequiredBuyerInfo;
  reservationInfo?: ReservationInfo;
  purchaseInfo?: {
    isPurchased: boolean;
    isCurrentUserBuyer: boolean;
    transactionId: string;
    status: string;
  };
  seller: {
    id: string;
    name?: string;
    username?: string;
    walletAddress?: string;
    image?: string;
    isVerified: boolean;
    totalSales: number;
    createdAt: string;
  };
  bids: Array<{
    id: string;
    amount: number;
    createdAt: string;
    bidder: {
      id: string;
      name?: string;
      username?: string;
      walletAddress?: string;
    };
  }>;
}

interface Offer {
  id: string;
  amount: number;
  deadline: string;
  currency: string;
  status: "ACTIVE" | "ACCEPTED" | "CANCELLED" | "EXPIRED";
  buyer: {
    id: string;
    name?: string;
    username?: string;
    image?: string;
    rating?: number;
    totalPurchases?: number;
  };
  createdAt: string;
}

export default function ListingPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { data: session } = useSession();
  const { publicKey, signMessage, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState(0);
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [activeTab, setActiveTab] = useState<"description" | "assets" | "bids">("description");
  const [bidding, setBidding] = useState(false);
  const [bidError, setBidError] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageContent, setMessageContent] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [sellerPercentage, setSellerPercentage] = useState(100);
  const [purchasePartners, setPurchasePartners] = useState<PurchasePartner[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [acceptingOffer, setAcceptingOffer] = useState<string | null>(null);
  const [decliningOffer, setDecliningOffer] = useState<string | null>(null);

  // Real-time countdown hook - must be called before any conditional returns
  const { timeLeft, isExpired, isEndingSoon } = useCountdown(listing?.endTime);

  useEffect(() => {
    async function fetchListing() {
      try {
        const response = await fetch(`/api/listings/${slug}`);
        if (response.ok) {
          const data = await response.json();
          setListing(data.listing);

          // Fetch collaborators
          try {
            const collabResponse = await fetch(`/api/listings/${slug}/collaborators`);
            if (collabResponse.ok) {
              const collabData = await collabResponse.json();
              setCollaborators(collabData.collaborators || []);
              setSellerPercentage(collabData.seller?.percentage || 100);
            }
          } catch (collabErr) {
            console.error("Failed to fetch collaborators:", collabErr);
          }

          // Fetch purchase partners if listing is sold
          if (data.listing.status === "SOLD") {
            try {
              const partnersResponse = await fetch(`/api/listings/${slug}/purchase-partners`);
              if (partnersResponse.ok) {
                const partnersData = await partnersResponse.json();
                setPurchasePartners(partnersData.partners || []);
              }
            } catch (partnersErr) {
              console.error("Failed to fetch purchase partners:", partnersErr);
            }
          }

          // Set initial bid amount: if no bids, use starting price; otherwise use current bid + 0.01
          const initialBid = data.listing.bidCount > 0
            ? Math.round((data.listing.currentBid + 0.01) * 100) / 100
            : data.listing.startingPrice;
          setBidAmount(initialBid);
        } else if (response.status === 404) {
          setError("Listing not found");
        } else {
          setError("Failed to load listing");
        }
      } catch (err) {
        setError("Failed to load listing");
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      fetchListing();
    }
  }, [slug]);

  // Fetch offers for seller
  useEffect(() => {
    async function fetchOffers() {
      if (!listing || session?.user?.id !== listing.seller.id) return;

      try {
        const response = await fetch(`/api/offers/listing/${listing.id}`);
        if (response.ok) {
          const data = await response.json();
          setOffers(data);
        }
      } catch (err) {
        console.error("Failed to fetch offers:", err);
      }
    }

    fetchOffers();
  }, [listing, session?.user?.id]);

  // Handle accepting an offer
  const handleAcceptOffer = async (offerId: string) => {
    if (acceptingOffer) return;
    setAcceptingOffer(offerId);

    try {
      const response = await fetch(`/api/offers/${offerId}/accept`, {
        method: "POST",
      });

      if (response.ok) {
        // Refresh the page to show updated state
        window.location.reload();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to accept offer");
      }
    } catch (err) {
      console.error("Error accepting offer:", err);
      alert("Failed to accept offer");
    } finally {
      setAcceptingOffer(null);
    }
  };

  // Handle declining an offer
  const handleDeclineOffer = async (offerId: string) => {
    if (decliningOffer) return;
    setDecliningOffer(offerId);

    try {
      const response = await fetch(`/api/offers/${offerId}/cancel`, {
        method: "POST",
      });

      if (response.ok) {
        // Remove offer from list
        setOffers(offers.filter(o => o.id !== offerId));
      } else {
        const data = await response.json();
        alert(data.error || "Failed to decline offer");
      }
    } catch (err) {
      console.error("Error declining offer:", err);
      alert("Failed to decline offer");
    } finally {
      setDecliningOffer(null);
    }
  };

  // Handler for responding to collaboration invites
  const handleInviteRespond = async (collaboratorId: string, action: "accept" | "decline") => {
    try {
      const response = await fetch(`/api/collaborators/${collaboratorId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to ${action} invite`);
      }

      // Refresh collaborators after response
      const collabResponse = await fetch(`/api/listings/${slug}/collaborators`);
      if (collabResponse.ok) {
        const collabData = await collabResponse.json();
        setCollaborators(collabData.collaborators || []);
        setSellerPercentage(collabData.seller?.percentage || 100);
      }
    } catch (err) {
      console.error(`Error ${action}ing invite:`, err);
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Package className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            {error || "Listing not found"}
          </h1>
          <p className="text-zinc-500 mb-6">
            The listing you're looking for doesn't exist or has been removed.
          </p>
          <Link href="/explore" className="btn-primary">
            Browse Listings
          </Link>
        </div>
      </div>
    );
  }

  // Check if this is a Buy Now only listing (no auction)
  const isBuyNowOnly = listing.buyNowEnabled && (!listing.startingPrice || listing.startingPrice <= 0);

  // Minimum bid: if no bids, use starting price; if there are bids, use current bid + 0.01
  const minimumBid = listing.bidCount > 0
    ? Math.round((listing.currentBid + 0.01) * 100) / 100
    : (listing.startingPrice || 0.01);

  const sellerName = listing.seller.name || listing.seller.username || listing.seller.walletAddress?.slice(0, 8) || "Anonymous";

  const handlePlaceBid = async () => {
    if (!session?.user) {
      router.push("/auth/signin");
      return;
    }

    if (!connected || !publicKey || !sendTransaction) {
      setBidError("Please connect your wallet to place a bid");
      return;
    }

    if (bidAmount < minimumBid) {
      setBidError(`Bid must be at least ${minimumBid} ${formatCurrency(listing.currency)}`);
      return;
    }

    setBidding(true);
    setBidError(null);

    try {
      // Platform escrow wallet - in production this would be a PDA from the smart contract
      const escrowPubkey = new PublicKey("AoNbJjD1kKUGpSuJKxPrxVVNLTtSqHVSBm6hLWLWLnwB");

      // Create transfer transaction
      const lamports = Math.floor(bidAmount * LAMPORTS_PER_SOL);
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: escrowPubkey,
          lamports,
        })
      );

      // Get latest blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Send and confirm transaction
      const txSignature = await sendTransaction(transaction, connection);

      // Wait for confirmation
      await connection.confirmTransaction({
        blockhash,
        lastValidBlockHeight,
        signature: txSignature,
      });

      // Record bid in database with transaction signature
      const response = await fetch("/api/bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: listing.id,
          amount: bidAmount,
          currency: listing.currency,
          onChainTx: txSignature,
          walletAddress: publicKey.toBase58(),
        }),
      });

      if (response.ok) {
        // Refresh the listing to show the new bid
        const listingResponse = await fetch(`/api/listings/${slug}`);
        if (listingResponse.ok) {
          const data = await listingResponse.json();
          setListing(data.listing);
          setBidAmount(Math.round((data.listing.currentBid + 0.01) * 100) / 100);
        }
      } else {
        const data = await response.json();
        setBidError(data.error || "Failed to place bid");
      }
    } catch (err: any) {
      console.error("Bid error:", err);
      if (err.message?.includes("User rejected") || err.message?.includes("rejected")) {
        setBidError("Transaction was rejected. Please try again.");
      } else if (err.message?.includes("insufficient")) {
        setBidError("Insufficient funds in your wallet.");
      } else if (err.message?.includes("403") || err.message?.includes("blockhash")) {
        setBidError("RPC connection error. Please try again or contact support if the issue persists.");
      } else {
        setBidError(err.message || "Failed to place bid. Please try again.");
      }
    } finally {
      setBidding(false);
    }
  };

  const handleBuyNow = async () => {
    if (!session?.user) {
      router.push("/auth/signin");
      return;
    }

    if (!connected || !publicKey || !sendTransaction) {
      setBuyError("Please connect your wallet to purchase");
      return;
    }

    if (!listing.buyNowPrice) {
      setBuyError("Buy Now is not available for this listing");
      return;
    }

    setBuying(true);
    setBuyError(null);

    try {
      // Platform escrow wallet - in production this would be a PDA from the smart contract
      const escrowPubkey = new PublicKey("AoNbJjD1kKUGpSuJKxPrxVVNLTtSqHVSBm6hLWLWLnwB");

      // Create transfer transaction for buy now price
      const lamports = Math.floor(listing.buyNowPrice * LAMPORTS_PER_SOL);
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: escrowPubkey,
          lamports,
        })
      );

      // Get latest blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Send and confirm transaction
      const txSignature = await sendTransaction(transaction, connection);

      // Wait for confirmation
      await connection.confirmTransaction({
        blockhash,
        lastValidBlockHeight,
        signature: txSignature,
      });

      // Record purchase in database
      const response = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: listing.id,
          amount: listing.buyNowPrice,
          currency: listing.currency,
          onChainTx: txSignature,
          walletAddress: publicKey.toBase58(),
          purchaseType: "buyNow",
        }),
      });

      if (response.ok) {
        const purchaseData = await response.json();
        // If listing requires buyer info, redirect to the buyer info form
        if (listing.requiredBuyerInfo && Object.values(listing.requiredBuyerInfo as Record<string, any>).some((v: any) => v?.required)) {
          router.push(`/dashboard/transfers/${purchaseData.transactionId}/buyer-info`);
        } else {
          router.push(`/dashboard/purchases?success=${listing.id}`);
        }
      } else {
        const data = await response.json();
        setBuyError(data.error || "Failed to record purchase");
      }
    } catch (err: any) {
      console.error("Buy error:", err);
      if (err.message?.includes("User rejected") || err.message?.includes("rejected")) {
        setBuyError("Transaction was rejected. Please try again.");
      } else if (err.message?.includes("insufficient")) {
        setBuyError("Insufficient funds in your wallet.");
      } else if (err.message?.includes("403") || err.message?.includes("blockhash")) {
        setBuyError("RPC connection error. Please try again or contact support if the issue persists.");
      } else {
        setBuyError(err.message || "Failed to complete purchase. Please try again.");
      }
    } finally {
      setBuying(false);
    }
  };

  const handleSendMessage = async () => {
    if (!session?.user || !messageContent.trim() || !listing) return;

    setSendingMessage(true);
    const result = await startConversation(
      listing.seller.id,
      messageContent.trim(),
      listing.id
    );

    if (result) {
      setShowMessageModal(false);
      setMessageContent("");
      router.push(`/dashboard/messages?conversation=${result.conversationId}`);
    }
    setSendingMessage(false);
  };

  const isOwnListing = session?.user?.id === listing?.seller.id;

  const categoryLabels: Record<string, string> = {
    SAAS: "SaaS",
    AI_ML: "AI & ML",
    MOBILE_APP: "Mobile App",
    WEB_APP: "Web App",
    BROWSER_EXTENSION: "Extension",
    CRYPTO_WEB3: "Crypto & Web3",
    ECOMMERCE: "E-commerce",
    DEVELOPER_TOOLS: "Dev Tools",
    OTHER: "Other",
  };

  // Vercel icon component
  const VercelIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 76 65" fill="currentColor">
      <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
    </svg>
  );

  const assetsList = [
    { key: "github", label: "GitHub Repository", value: listing.githubRepo, icon: Github, included: !!listing.githubRepo },
    { key: "domain", label: "Domain", value: listing.domain, icon: Globe, included: listing.hasDomain },
    { key: "database", label: "Database", value: listing.databaseType, icon: Database, included: listing.hasDatabase },
    { key: "hosting", label: "Hosting", value: listing.hostingProvider, icon: Globe, included: listing.hasHosting },
    { key: "vercel", label: "Vercel Project Transfer", value: listing.vercelProjectUrl || "Included", icon: VercelIcon, included: listing.hasVercel },
    { key: "apiKeys", label: "API Keys & Credentials", value: "Included", icon: Key, included: listing.hasApiKeys },
    { key: "design", label: "Design Files", value: "Included", icon: Palette, included: listing.hasDesignFiles },
    { key: "docs", label: "Documentation", value: "Included", icon: FileText, included: listing.hasDocumentation },
  ];

  return (
    <div className="min-h-screen pb-20">
      {/* Breadcrumb */}
      <div className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
        <div className="container-wide py-4">
          <nav className="flex items-center gap-2 text-sm text-zinc-500">
            <Link href="/explore" className="hover:text-zinc-700 dark:hover:text-zinc-300">
              Explore
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href={`/explore?category=${(listing.categories?.[0] || listing.category || "").toLowerCase()}`} className="hover:text-zinc-700 dark:hover:text-zinc-300">
              {categoryLabels[listing.categories?.[0] || listing.category || ""] || listing.categories?.[0] || listing.category}
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-zinc-900 dark:text-zinc-100">{listing.title}</span>
          </nav>
        </div>
      </div>

      <div className="container-wide py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Header */}
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <span className="badge-green">{categoryLabels[listing.categories?.[0] || listing.category || ""] || listing.categories?.[0] || listing.category}</span>
                    {/* Listing Type Badge */}
                    {isBuyNowOnly ? (
                      <span className="badge bg-green-500 text-white flex items-center gap-1.5">
                        <ShoppingCart className="w-3.5 h-3.5" />
                        Buy Now
                      </span>
                    ) : (
                      <span className="badge bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 flex items-center gap-1.5">
                        <Gavel className="w-3.5 h-3.5" />
                        Auction
                      </span>
                    )}
                    {isExpired ? (
                      <span className="badge-red flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Ended
                      </span>
                    ) : isEndingSoon && (
                      <span className="badge-yellow flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Ending Soon
                      </span>
                    )}
                    {listing.reservationInfo?.isReservedForCurrentUser && (
                      <span className="px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Reserved for you
                      </span>
                    )}
                  </div>
                  <h1 className="text-3xl md:text-4xl font-display font-semibold text-zinc-900 dark:text-zinc-100">
                    {listing.title}
                  </h1>
                  {listing.tagline && (
                    <p className="mt-2 text-lg text-zinc-600 dark:text-zinc-400">
                      {listing.tagline}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsWatchlisted(!isWatchlisted)}
                    className={`p-3 rounded-xl border transition-colors ${
                      isWatchlisted
                        ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600"
                        : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-red-500"
                    }`}
                  >
                    <Heart className={`w-5 h-5 ${isWatchlisted ? "fill-current" : ""}`} />
                  </button>
                  <button className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Seller Info */}
              <div className="mt-6 flex items-center justify-between">
                <Link
                  href={listing.seller.username ? `/user/${listing.seller.username}` : `/user/${listing.seller.id}`}
                  className="flex items-center gap-4 group cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center overflow-hidden ring-2 ring-transparent group-hover:ring-green-500 transition-all">
                    {listing.seller.image ? (
                      <Image src={listing.seller.image} alt={sellerName} width={48} height={48} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-medium text-white">
                        {sellerName[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                        {sellerName}
                      </span>
                      {listing.seller.isVerified && (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-zinc-500">
                      <span>{listing.seller.totalSales} sales</span>
                    </div>
                  </div>
                </Link>

                {/* Message Seller Button */}
                {!isOwnListing && (
                  <button
                    onClick={() => {
                      if (!session?.user) {
                        router.push("/auth/signin");
                        return;
                      }
                      setShowMessageModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Message</span>
                  </button>
                )}
              </div>

              {/* Team / Collaborators */}
              {collaborators.length > 0 && (
                <div className="mt-6">
                  <CollaboratorDisplay
                    seller={{
                      id: listing.seller.id,
                      username: listing.seller.username || null,
                      displayName: null,
                      name: listing.seller.name || null,
                      image: listing.seller.image || null,
                      walletAddress: listing.seller.walletAddress || null,
                      isVerified: listing.seller.isVerified,
                      rating: null,
                    }}
                    collaborators={collaborators}
                    sellerPercentage={sellerPercentage}
                    currentUserId={session?.user?.id}
                    currentUserWallet={session?.user?.walletAddress}
                    onInviteRespond={handleInviteRespond}
                  />
                </div>
              )}

              {/* Purchase Partners (for sold listings) */}
              {listing.status === "SOLD" && purchasePartners.length > 0 && (
                <div className="mt-6">
                  <PurchasePartnersDisplay
                    partners={purchasePartners}
                  />
                </div>
              )}
            </div>

            {/* Demo/Preview */}
            <div className="aspect-video bg-zinc-100 dark:bg-zinc-900 rounded-2xl overflow-hidden relative">
              {listing.thumbnailUrl ? (
                <Image src={listing.thumbnailUrl} alt={listing.title} fill className="object-cover" />
              ) : listing.demoUrl ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <a
                    href={listing.demoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-6 py-3 bg-black/80 backdrop-blur-sm text-white rounded-full hover:bg-black transition-colors"
                  >
                    <Play className="w-5 h-5" />
                    <span>View Live Demo</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Package className="w-16 h-16 text-zinc-300" />
                </div>
              )}
            </div>

            {/* Tech Stack */}
            {listing.techStack && listing.techStack.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {listing.techStack.map((tech) => (
                  <span
                    key={tech}
                    className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            )}

            {/* Tabs */}
            <div className="border-b border-zinc-200 dark:border-zinc-800">
              <nav className="flex gap-8">
                {(isBuyNowOnly ? ["description", "assets"] as const : ["description", "assets", "bids"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-4 text-sm font-medium transition-colors relative ${
                      activeTab === tab
                        ? "text-green-600 dark:text-green-400"
                        : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    {tab === "bids" && ` (${listing.bidCount})`}
                    {activeTab === tab && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500"
                      />
                    )}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <NDAGate
              listingSlug={listing.slug}
              listingTitle={listing.title}
              requiresNDA={listing.requiresNDA || false}
              blurredPreview={
                <div className="prose prose-zinc dark:prose-invert max-w-none opacity-50">
                  <div className="whitespace-pre-wrap line-clamp-6">{listing.description}</div>
                </div>
              }
            >
            <div>
              {activeTab === "description" && (
                <div className="prose prose-zinc dark:prose-invert max-w-none">
                  <div className="whitespace-pre-wrap">{listing.description}</div>
                </div>
              )}

              {activeTab === "assets" && (
                <div className="space-y-4">
                  {assetsList.map((asset) => (
                    <div
                      key={asset.key}
                      className={`flex items-center gap-4 p-4 rounded-xl border ${
                        asset.included
                          ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                          : "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 opacity-50"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        asset.included
                          ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                      }`}>
                        <asset.icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">
                          {asset.label}
                        </div>
                        {asset.included && asset.value && (
                          <div className="text-sm text-zinc-500">{asset.value}</div>
                        )}
                      </div>
                      {asset.included ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        <span className="text-sm text-zinc-400">Not included</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "bids" && !isBuyNowOnly && (
                <div className="space-y-3">
                  {listing.bids.length === 0 ? (
                    <div className="text-center py-8">
                      <Gavel className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                      <p className="text-zinc-500">No bids yet. Be the first to bid!</p>
                    </div>
                  ) : (
                    listing.bids.map((bid, index) => {
                      const bidderName = bid.bidder.name || bid.bidder.username || bid.bidder.walletAddress?.slice(0, 8) || "Anonymous";
                      return (
                        <div
                          key={bid.id}
                          className={`flex items-center justify-between p-4 rounded-xl ${
                            index === 0
                              ? "bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800"
                              : "bg-zinc-50 dark:bg-zinc-900"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-400 to-zinc-500 flex items-center justify-center">
                              <span className="text-sm font-medium text-white">
                                {bidderName[0].toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium text-zinc-900 dark:text-zinc-100">
                                {bidderName}
                              </div>
                              <div className="text-sm text-zinc-500" suppressHydrationWarning>
                                {formatDistanceToNow(new Date(bid.createdAt), { addSuffix: true })}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                              {bid.amount} {formatCurrency(listing.currency)}
                            </div>
                            {index === 0 && (
                              <div className="text-sm text-green-600 dark:text-green-400">
                                Highest bid
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
            </NDAGate>
          </div>

          {/* Sidebar - Bid Panel */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xl shadow-black/5">
                {/* Reservation Notice - Show when reserved for someone else */}
                {listing.reservationInfo?.isReserved && !listing.reservationInfo?.isReservedForCurrentUser && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-3">
                      <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                          {listing.reservationInfo.reservedBuyerName
                            ? `This listing is reserved for @${listing.reservationInfo.reservedBuyerName}`
                            : "This listing is reserved for another buyer"}
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                          Bidding and purchasing are currently unavailable.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Reserved For You Notice */}
                {listing.reservationInfo?.isReservedForCurrentUser && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-green-800 dark:text-green-200">
                          This listing is reserved for you
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                          Complete your purchase when you're ready.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Current Price */}
                <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-sm text-zinc-500">
                      {isBuyNowOnly ? (
                        <>
                          <ShoppingCart className="w-4 h-4" />
                          <span>Buy Now Price</span>
                        </>
                      ) : (
                        <>
                          <Gavel className="w-4 h-4" />
                          <span>{listing.bidCount > 0 ? `Current bid (${listing.bidCount} bids)` : "Starting price"}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className={`w-4 h-4 ${isExpired ? "text-red-500" : "text-zinc-400"}`} />
                      <span className={
                        isExpired
                          ? "text-red-500 font-medium"
                          : isEndingSoon
                            ? "text-yellow-600 font-medium"
                            : "text-zinc-500"
                      }>
                        {isExpired ? "Ended" : `${timeLeft} left`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-display font-semibold text-zinc-900 dark:text-zinc-100">
                      {isBuyNowOnly ? listing.buyNowPrice : (listing.currentBid || listing.startingPrice)}
                    </span>
                    <span className="text-xl text-zinc-500">{formatCurrency(listing.currency)}</span>
                  </div>
                </div>

                {/* Bid/Buy Input */}
                <div className="p-6 space-y-4">
                  {/* Show expired message */}
                  {isExpired && !listing.purchaseInfo?.isPurchased && (
                    <div className="p-4 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-zinc-500" />
                        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                          {isBuyNowOnly ? "This listing has expired" : "This auction has ended"}
                        </p>
                      </div>
                      {!isBuyNowOnly && listing.bidCount > 0 && (
                        <p className="text-xs text-zinc-500 mt-2">
                          Final bid: {listing.currentBid} {formatCurrency(listing.currency)} ({listing.bidCount} bids)
                        </p>
                      )}
                    </div>
                  )}

                  {/* Show bid input only for auction listings that haven't expired */}
                  {!isBuyNowOnly && !isExpired && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                          Your Bid
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            value={bidAmount}
                            onChange={(e) => setBidAmount(Number(e.target.value))}
                            min={minimumBid}
                            step={0.01}
                            className="w-full px-4 py-3 pr-16 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-lg font-medium"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">
                            {formatCurrency(listing.currency)}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-500 mt-2">
                          Minimum bid: {minimumBid} {formatCurrency(listing.currency)}
                        </p>
                      </div>

                      {bidError && (
                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                          <p className="text-sm text-red-600 dark:text-red-400">{bidError}</p>
                        </div>
                      )}

                      <button
                        onClick={handlePlaceBid}
                        disabled={bidding || bidAmount < minimumBid || (listing.reservationInfo?.isReserved && !listing.reservationInfo?.isReservedForCurrentUser)}
                        className="w-full btn-primary py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {bidding ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Placing Bid...
                          </>
                        ) : (
                          <>
                            <Gavel className="w-5 h-5" />
                            Place Bid
                          </>
                        )}
                      </button>
                    </>
                  )}

                  {/* Show Buy Now button or Purchased state */}
                  {listing.purchaseInfo?.isPurchased ? (
                    <div className="space-y-3">
                      <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                          <p className="text-sm font-medium text-green-800 dark:text-green-200">
                            {listing.purchaseInfo.isCurrentUserBuyer
                              ? "You purchased this listing"
                              : "This listing has been sold"}
                          </p>
                        </div>
                      </div>
                      {isOwnListing && (
                        <Link
                          href={`/dashboard/transfers/${listing.purchaseInfo.transactionId}`}
                          className="w-full btn-primary py-3 text-center flex items-center justify-center gap-2"
                        >
                          <Package className="w-4 h-4" />
                          Go to Transfer Page
                        </Link>
                      )}
                      {listing.purchaseInfo.isCurrentUserBuyer && listing.requiredBuyerInfo && Object.values(listing.requiredBuyerInfo).some(v => v?.required) && (
                        <Link
                          href={`/dashboard/transfers/${listing.purchaseInfo.transactionId}/buyer-info`}
                          className="w-full btn-primary py-3 text-center flex items-center justify-center gap-2"
                        >
                          <FileText className="w-4 h-4" />
                          Provide Required Information
                        </Link>
                      )}
                    </div>
                  ) : listing.buyNowEnabled && listing.buyNowPrice && !isExpired ? (
                    <>
                      {!isBuyNowOnly && (
                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
                          </div>
                          <div className="relative flex justify-center">
                            <span className="px-3 bg-white dark:bg-zinc-900 text-sm text-zinc-500">
                              or
                            </span>
                          </div>
                        </div>
                      )}

                      {buyError && (
                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                          <p className="text-sm text-red-600 dark:text-red-400">{buyError}</p>
                        </div>
                      )}

                      <button
                        onClick={handleBuyNow}
                        disabled={buying || (listing.reservationInfo?.isReserved && !listing.reservationInfo?.isReservedForCurrentUser)}
                        className="w-full btn-success py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {buying ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="w-5 h-5" />
                            Buy Now for {listing.buyNowPrice} {formatCurrency(listing.currency)}
                          </>
                        )}
                      </button>
                    </>
                  ) : null}
                </div>

                {/* Offers Section - Only visible to seller */}
                {isOwnListing && offers.length > 0 && !listing.purchaseInfo?.isPurchased && (
                  <div className="p-6 bg-blue-50 dark:bg-blue-900/10 border-t border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-blue-700 dark:text-blue-400 flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Offers ({offers.filter(o => o.status === "ACTIVE").length})
                      </h4>
                      <Link
                        href="/dashboard/offers"
                        className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        View All Offers →
                      </Link>
                    </div>
                    <div className="space-y-3">
                      {offers.filter(o => o.status === "ACTIVE").slice(0, 3).map((offer) => {
                        const offerExpired = new Date() > new Date(offer.deadline);
                        return (
                          <div
                            key={offer.id}
                            className={`p-3 rounded-lg border ${
                              offerExpired
                                ? "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                                : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                                  <span className="text-xs font-medium text-white">
                                    {(offer.buyer.username || offer.buyer.name || "?")[0].toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                                    {offer.amount} {formatCurrency(offer.currency)}
                                  </p>
                                  <p className="text-xs text-zinc-500">
                                    from {offer.buyer.username || offer.buyer.name || "Anonymous"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {offerExpired ? (
                                  <span className="text-xs text-zinc-500 px-2 py-1 bg-zinc-200 dark:bg-zinc-700 rounded">
                                    Expired
                                  </span>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => handleAcceptOffer(offer.id)}
                                      disabled={acceptingOffer === offer.id}
                                      className="text-xs px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                                    >
                                      {acceptingOffer === offer.id ? "..." : "Accept"}
                                    </button>
                                    <button
                                      onClick={() => handleDeclineOffer(offer.id)}
                                      disabled={decliningOffer === offer.id}
                                      className="text-xs px-3 py-1.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded hover:bg-zinc-300 dark:hover:bg-zinc-600 disabled:opacity-50"
                                    >
                                      {decliningOffer === offer.id ? "..." : "Decline"}
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                            {!offerExpired && (
                              <p className="text-xs text-zinc-400 mt-2">
                                Expires {formatDistanceToNow(new Date(offer.deadline), { addSuffix: true })}
                              </p>
                            )}
                          </div>
                        );
                      })}
                      {offers.filter(o => o.status === "ACTIVE").length > 3 && (
                        <Link
                          href="/dashboard/offers"
                          className="block text-center text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 py-2"
                        >
                          View {offers.filter(o => o.status === "ACTIVE").length - 3} more offers →
                        </Link>
                      )}
                    </div>
                  </div>
                )}

                {/* Required Buyer Information - only show to potential buyers, not the seller */}
                {!isOwnListing && listing.requiredBuyerInfo && Object.values(listing.requiredBuyerInfo).some(v => v?.required) && (
                  <div className="p-6 bg-purple-50 dark:bg-purple-900/10 border-t border-purple-200 dark:border-purple-800">
                    <h4 className="font-medium text-purple-700 dark:text-purple-400 mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      What You&apos;ll Need to Provide
                    </h4>
                    <p className="text-xs text-purple-600 dark:text-purple-500 mb-3">
                      After purchase, you&apos;ll have 48 hours to provide:
                    </p>
                    <div className="space-y-2">
                      {listing.requiredBuyerInfo.github?.required && (
                        <div className="flex items-start gap-2 text-sm">
                          <Github className="w-4 h-4 text-purple-600 mt-0.5" />
                          <div>
                            <span className="text-zinc-700 dark:text-zinc-300">GitHub Username</span>
                            {listing.requiredBuyerInfo.github.description && (
                              <p className="text-xs text-zinc-500 mt-0.5">{listing.requiredBuyerInfo.github.description}</p>
                            )}
                          </div>
                        </div>
                      )}
                      {listing.requiredBuyerInfo.domain?.required && (
                        <div className="flex items-start gap-2 text-sm">
                          <Globe className="w-4 h-4 text-purple-600 mt-0.5" />
                          <div>
                            <span className="text-zinc-700 dark:text-zinc-300">Domain Registrar Info</span>
                            {listing.requiredBuyerInfo.domain.description && (
                              <p className="text-xs text-zinc-500 mt-0.5">{listing.requiredBuyerInfo.domain.description}</p>
                            )}
                          </div>
                        </div>
                      )}
                      {listing.requiredBuyerInfo.email?.required && (
                        <div className="flex items-start gap-2 text-sm">
                          <MessageCircle className="w-4 h-4 text-purple-600 mt-0.5" />
                          <div>
                            <span className="text-zinc-700 dark:text-zinc-300">Email Address</span>
                            {listing.requiredBuyerInfo.email.description && (
                              <p className="text-xs text-zinc-500 mt-0.5">{listing.requiredBuyerInfo.email.description}</p>
                            )}
                          </div>
                        </div>
                      )}
                      {listing.requiredBuyerInfo.walletAddress?.required && (
                        <div className="flex items-start gap-2 text-sm">
                          <Key className="w-4 h-4 text-purple-600 mt-0.5" />
                          <div>
                            <span className="text-zinc-700 dark:text-zinc-300">Wallet Address</span>
                            {listing.requiredBuyerInfo.walletAddress.description && (
                              <p className="text-xs text-zinc-500 mt-0.5">{listing.requiredBuyerInfo.walletAddress.description}</p>
                            )}
                          </div>
                        </div>
                      )}
                      {listing.requiredBuyerInfo.other?.required && (
                        <div className="flex items-start gap-2 text-sm">
                          <FileText className="w-4 h-4 text-purple-600 mt-0.5" />
                          <div>
                            <span className="text-zinc-700 dark:text-zinc-300">Other Information</span>
                            {listing.requiredBuyerInfo.other.description && (
                              <p className="text-xs text-zinc-500 mt-0.5">{listing.requiredBuyerInfo.other.description}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Trust Indicators */}
                <div className="p-6 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <Shield className="w-5 h-5 text-green-500" />
                      <span className="text-zinc-600 dark:text-zinc-400">
                        Secure escrow protection
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      <span className="text-zinc-600 dark:text-zinc-400">
                        Verified ownership
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <TrendingUp className="w-5 h-5 text-green-500" />
                      <span className="text-zinc-600 dark:text-zinc-400">
                        {listing.currency === "APP" ? (
                          <span className="text-green-600 dark:text-green-400 font-medium">3% platform fee (discounted)</span>
                        ) : (
                          "5% platform fee on sale"
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Metrics */}
              {(listing.monthlyUsers || listing.githubStars) && (
                <div className="mt-6 p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                    Project Metrics
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {listing.monthlyUsers && (
                      <div className="text-center p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                        <div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                          {listing.monthlyUsers.toLocaleString()}
                        </div>
                        <div className="text-sm text-zinc-500">Monthly Users</div>
                      </div>
                    )}
                    {listing.githubStars && (
                      <div className="text-center p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                        <div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                          {listing.githubStars}
                        </div>
                        <div className="text-sm text-zinc-500">GitHub Stars</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Message Modal */}
      {showMessageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowMessageModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-lg mx-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                  {listing.seller.image ? (
                    <Image
                      src={listing.seller.image}
                      alt={sellerName}
                      width={40}
                      height={40}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <span className="text-sm font-medium text-white">
                      {sellerName[0].toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                    Message {sellerName}
                  </p>
                  <p className="text-sm text-zinc-500">
                    About: {listing.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMessageModal(false)}
                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5 text-zinc-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4">
              <textarea
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                placeholder={`Ask ${sellerName} a question about this listing...`}
                rows={4}
                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => setShowMessageModal(false)}
                className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendMessage}
                disabled={!messageContent.trim() || sendingMessage}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {sendingMessage ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Message
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
