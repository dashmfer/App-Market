"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";

interface Offer {
  id: string;
  amount: number;
  deadline: string;
  currency: string;
  status: "ACTIVE" | "ACCEPTED" | "CANCELLED" | "EXPIRED";
  createdAt: string;
  listing: {
    id: string;
    title: string;
    slug: string;
  };
  buyer: {
    id: string;
    name?: string;
    username?: string;
    image?: string;
  };
}

type TabType = "received" | "sent";
type FilterType = "all" | "active" | "accepted" | "expired" | "cancelled";

export default function OffersPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<TabType>("received");
  const [filter, setFilter] = useState<FilterType>("all");
  const [receivedOffers, setReceivedOffers] = useState<Offer[]>([]);
  const [sentOffers, setSentOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingOffer, setAcceptingOffer] = useState<string | null>(null);
  const [decliningOffer, setDecliningOffer] = useState<string | null>(null);
  const [cancellingOffer, setCancellingOffer] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOffers() {
      if (!session?.user?.id) return;

      try {
        // Fetch received offers (offers on user's listings)
        const receivedRes = await fetch("/api/offers?type=received");
        if (receivedRes.ok) {
          const data = await receivedRes.json();
          setReceivedOffers(data.offers || []);
        }

        // Fetch sent offers (offers user has made)
        const sentRes = await fetch("/api/offers?type=sent");
        if (sentRes.ok) {
          const data = await sentRes.json();
          setSentOffers(data.offers || []);
        }
      } catch (err) {
        console.error("Failed to fetch offers:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchOffers();
  }, [session?.user?.id]);

  const handleAcceptOffer = async (offerId: string) => {
    if (acceptingOffer) return;
    setAcceptingOffer(offerId);

    try {
      const response = await fetch(`/api/offers/${offerId}/accept`, {
        method: "POST",
      });

      if (response.ok) {
        setReceivedOffers(offers =>
          offers.map(o => o.id === offerId ? { ...o, status: "ACCEPTED" as const } : o)
        );
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

  const handleDeclineOffer = async (offerId: string) => {
    if (decliningOffer) return;
    setDecliningOffer(offerId);

    try {
      const response = await fetch(`/api/offers/${offerId}/cancel`, {
        method: "POST",
      });

      if (response.ok) {
        setReceivedOffers(offers =>
          offers.map(o => o.id === offerId ? { ...o, status: "CANCELLED" as const } : o)
        );
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

  const handleCancelOffer = async (offerId: string) => {
    if (cancellingOffer) return;
    setCancellingOffer(offerId);

    try {
      const response = await fetch(`/api/offers/${offerId}/cancel`, {
        method: "POST",
      });

      if (response.ok) {
        setSentOffers(offers =>
          offers.map(o => o.id === offerId ? { ...o, status: "CANCELLED" as const } : o)
        );
      } else {
        const data = await response.json();
        alert(data.error || "Failed to cancel offer");
      }
    } catch (err) {
      console.error("Error cancelling offer:", err);
      alert("Failed to cancel offer");
    } finally {
      setCancellingOffer(null);
    }
  };

  const filterOffers = (offers: Offer[]) => {
    if (filter === "all") return offers;

    return offers.filter(offer => {
      const isExpired = new Date() > new Date(offer.deadline) && offer.status === "ACTIVE";

      switch (filter) {
        case "active":
          return offer.status === "ACTIVE" && !isExpired;
        case "expired":
          return isExpired || offer.status === "EXPIRED";
        case "accepted":
          return offer.status === "ACCEPTED";
        case "cancelled":
          return offer.status === "CANCELLED";
        default:
          return true;
      }
    });
  };

  const getStatusBadge = (offer: Offer) => {
    const isExpired = new Date() > new Date(offer.deadline) && offer.status === "ACTIVE";

    if (isExpired || offer.status === "EXPIRED") {
      return (
        <span className="flex items-center gap-1 text-xs px-2 py-1 bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 rounded">
          <Clock className="w-3 h-3" />
          Expired
        </span>
      );
    }

    switch (offer.status) {
      case "ACTIVE":
        return (
          <span className="flex items-center gap-1 text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
            <CheckCircle2 className="w-3 h-3" />
            Active
          </span>
        );
      case "ACCEPTED":
        return (
          <span className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
            <CheckCircle2 className="w-3 h-3" />
            Accepted
          </span>
        );
      case "CANCELLED":
        return (
          <span className="flex items-center gap-1 text-xs px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
            <XCircle className="w-3 h-3" />
            Declined
          </span>
        );
      default:
        return null;
    }
  };

  const currentOffers = activeTab === "received" ? receivedOffers : sentOffers;
  const filteredOffers = filterOffers(currentOffers);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="container-wide py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-2xl md:text-3xl font-display font-semibold text-zinc-900 dark:text-zinc-100">
            Offers
          </h1>
          <p className="text-zinc-500 mt-1">
            Manage offers on your listings and offers you&apos;ve made
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab("received")}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "received"
                ? "border-green-500 text-green-600 dark:text-green-400"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            Received ({receivedOffers.filter(o => o.status === "ACTIVE").length})
          </button>
          <button
            onClick={() => setActiveTab("sent")}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "sent"
                ? "border-green-500 text-green-600 dark:text-green-400"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            Sent ({sentOffers.filter(o => o.status === "ACTIVE").length})
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {(["all", "active", "accepted", "expired", "cancelled"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                filter === f
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Offers List */}
        {filteredOffers.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <DollarSign className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
              No offers found
            </h3>
            <p className="text-zinc-500">
              {activeTab === "received"
                ? "You haven't received any offers yet"
                : "You haven't made any offers yet"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOffers.map((offer) => {
              const isExpired = new Date() > new Date(offer.deadline) && offer.status === "ACTIVE";
              const canTakeAction = offer.status === "ACTIVE" && !isExpired;

              return (
                <div
                  key={offer.id}
                  className={`p-4 bg-white dark:bg-zinc-900 rounded-xl border transition-colors ${
                    isExpired
                      ? "border-zinc-200 dark:border-zinc-800 opacity-75"
                      : "border-zinc-200 dark:border-zinc-800"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                          {offer.amount} {offer.currency}
                        </p>
                        {getStatusBadge(offer)}
                      </div>
                      <Link
                        href={`/listing/${offer.listing.slug}`}
                        className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-green-600 dark:hover:text-green-400 flex items-center gap-1"
                      >
                        {offer.listing.title}
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                      <p className="text-xs text-zinc-500 mt-1">
                        {activeTab === "received" ? (
                          <>From: {offer.buyer.username || offer.buyer.name || "Anonymous"}</>
                        ) : (
                          <>Made {formatDistanceToNow(new Date(offer.createdAt), { addSuffix: true })}</>
                        )}
                      </p>
                      {!isExpired && offer.status === "ACTIVE" && (
                        <p className="text-xs text-zinc-400 mt-1">
                          Expires {formatDistanceToNow(new Date(offer.deadline), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {activeTab === "received" && canTakeAction && (
                        <>
                          <button
                            onClick={() => handleAcceptOffer(offer.id)}
                            disabled={acceptingOffer === offer.id}
                            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
                          >
                            {acceptingOffer === offer.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "Accept"
                            )}
                          </button>
                          <button
                            onClick={() => handleDeclineOffer(offer.id)}
                            disabled={decliningOffer === offer.id}
                            className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 disabled:opacity-50"
                          >
                            {decliningOffer === offer.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "Decline"
                            )}
                          </button>
                        </>
                      )}
                      {activeTab === "sent" && canTakeAction && (
                        <button
                          onClick={() => handleCancelOffer(offer.id)}
                          disabled={cancellingOffer === offer.id}
                          className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50"
                        >
                          {cancellingOffer === offer.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "Cancel Offer"
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
