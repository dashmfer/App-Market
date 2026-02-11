"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  Trash2,
  CheckCircle2,
  Lock,
  Unlock,
  UserCheck,
} from "lucide-react";
import { useCsrf } from "@/hooks/useCsrf";

interface Listing {
  id: string;
  slug: string;
  title: string;
  tagline?: string;
  description: string;
  category: string;
  status: string;
  startingPrice: number;
  buyNowPrice?: number;
  buyNowEnabled: boolean;
  currency: string;
  endTime: string;
  sellerId: string;
  reservedBuyerWallet?: string | null;
  reservedBuyerId?: string | null;
  reservedAt?: string | null;
  _count?: {
    bids: number;
  };
}

export default function EditListingPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { data: session, status: sessionStatus } = useSession();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [reserving, setReserving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");

  // Reservation state
  const [reserveWallet, setReserveWallet] = useState("");
  const [isReserved, setIsReserved] = useState(false);
  const [currentReservedWallet, setCurrentReservedWallet] = useState<string | null>(null);
  const { csrfHeaders } = useCsrf();

  useEffect(() => {
    async function fetchListing() {
      try {
        const response = await fetch(`/api/listings/${slug}`);
        if (response.ok) {
          const data = await response.json();
          setListing(data.listing);
          setTitle(data.listing.title);
          setTagline(data.listing.tagline || "");
          setDescription(data.listing.description);
          // Set reservation state
          setIsReserved(data.listing.status === "RESERVED");
          setCurrentReservedWallet(data.listing.reservedBuyerWallet || null);
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

  // Check if user is the owner
  const isOwner = session?.user?.id === listing?.sellerId;
  const hasBids = (listing?._count?.bids || 0) > 0;
  const auctionStarted = listing ? new Date() > new Date(listing.endTime) : false;
  const canCancel = isOwner && !hasBids && listing?.status === "ACTIVE";

  const handleSave = async () => {
    if (!listing) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/listings/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({
          title,
          tagline,
          description,
        }),
      });

      if (response.ok) {
        setSuccess("Listing updated successfully!");
        setTimeout(() => router.push(`/listing/${slug}`), 1500);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to update listing");
      }
    } catch (err) {
      setError("Failed to update listing");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!listing || !canCancel) return;

    if (!confirm("Are you sure you want to cancel this listing? This action cannot be undone.")) {
      return;
    }

    setCanceling(true);
    setError(null);

    try {
      const response = await fetch(`/api/listings/${slug}/cancel`, {
        method: "POST",
        headers: { ...csrfHeaders },
      });

      if (response.ok) {
        setSuccess("Listing cancelled successfully!");
        setTimeout(() => router.push("/dashboard/listings"), 1500);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to cancel listing");
      }
    } catch (err) {
      setError("Failed to cancel listing");
    } finally {
      setCanceling(false);
    }
  };

  const handleReserve = async () => {
    if (!listing || !reserveWallet.trim()) return;

    setReserving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/listings/${slug}/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({ walletAddress: reserveWallet.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setIsReserved(true);
        setCurrentReservedWallet(reserveWallet.trim());
        setReserveWallet("");
        setListing({ ...listing, status: "RESERVED" });
        setSuccess(
          data.buyerIsRegistered
            ? "Listing reserved! The buyer has been notified."
            : "Listing reserved! The buyer will see it when they connect their wallet."
        );
      } else {
        const data = await response.json();
        setError(data.error || "Failed to reserve listing");
      }
    } catch (err) {
      setError("Failed to reserve listing");
    } finally {
      setReserving(false);
    }
  };

  const handleUnreserve = async () => {
    if (!listing) return;

    if (!confirm("Are you sure you want to remove this reservation? The listing will become public again.")) {
      return;
    }

    setReserving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/listings/${slug}/reserve`, {
        method: "DELETE",
        headers: { ...csrfHeaders },
      });

      if (response.ok) {
        setIsReserved(false);
        setCurrentReservedWallet(null);
        setListing({ ...listing, status: "ACTIVE" });
        setSuccess("Reservation removed. Listing is now public.");
      } else {
        const data = await response.json();
        setError(data.error || "Failed to remove reservation");
      }
    } catch (err) {
      setError("Failed to remove reservation");
    } finally {
      setReserving(false);
    }
  };

  if (loading || sessionStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (error && !listing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            {error}
          </h1>
          <Link href="/dashboard/listings" className="btn-primary mt-4">
            Back to My Listings
          </Link>
        </div>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            Unauthorized
          </h1>
          <p className="text-zinc-500 mb-4">You can only edit your own listings.</p>
          <Link href="/dashboard/listings" className="btn-primary">
            Back to My Listings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-8">
      <div className="container-tight">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href={`/listing/${slug}`}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              Edit Listing
            </h1>
            <p className="text-zinc-500">Make changes to your listing</p>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>{success}</span>
            </div>
          </div>
        )}

        {/* Edit Form */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Tagline
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
            </div>

            {/* Reserve for Buyer Section */}
            {(listing?.status === "ACTIVE" || listing?.status === "RESERVED") && (
              <div className="p-5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                <div className="flex items-center gap-2 mb-4">
                  <Lock className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                    Reserve for Buyer
                  </h3>
                </div>

                {isReserved ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                      <UserCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                          Reserved for:
                        </p>
                        <p className="text-sm text-amber-700 dark:text-amber-400 font-mono break-all">
                          {currentReservedWallet}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleUnreserve}
                      disabled={reserving}
                      className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-red-200 dark:border-red-800"
                    >
                      {reserving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Unlock className="w-4 h-4" />
                      )}
                      Remove Reservation
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Reserve this listing for a specific buyer. Only they will be able to purchase it.
                    </p>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                        Buyer's Wallet Address
                      </label>
                      <input
                        type="text"
                        value={reserveWallet}
                        onChange={(e) => setReserveWallet(e.target.value)}
                        placeholder="Enter Solana wallet address..."
                        className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm"
                      />
                    </div>
                    <button
                      onClick={handleReserve}
                      disabled={reserving || !reserveWallet.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
                    >
                      {reserving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Lock className="w-4 h-4" />
                      )}
                      Reserve Listing
                    </button>
                  </div>
                )}
              </div>
            )}

            {hasBids && (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  This listing has bids. Some fields cannot be changed after bids are placed.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <div>
                {canCancel && (
                  <button
                    onClick={handleCancel}
                    disabled={canceling}
                    className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    {canceling ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Cancel Listing
                  </button>
                )}
                {!canCancel && hasBids && (
                  <p className="text-sm text-zinc-500">
                    Cannot cancel - listing has bids
                  </p>
                )}
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
