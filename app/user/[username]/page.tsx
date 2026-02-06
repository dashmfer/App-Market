"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Loader2, CheckCircle2, Package, Calendar, ShoppingBag, Gift, Star, Twitter, Award, TrendingUp, Shield, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ListingCard } from "@/components/listings/listing-card";
import { ReviewList } from "@/components/reviews/review-list";
import { ReviewForm } from "@/components/reviews/review-form";
import { useSession } from "next-auth/react";

interface ListingWithReservation {
  id: string;
  slug: string;
  title: string;
  tagline?: string;
  thumbnailUrl?: string;
  category: string;
  techStack?: string[];
  startingPrice?: number;
  buyNowPrice?: number;
  buyNowEnabled?: boolean;
  currency?: string;
  endTime: string;
  currentBid?: number;
  _count?: { bids: number };
  reservationInfo?: {
    isReserved: boolean;
    isReservedForCurrentUser: boolean;
  };
  seller?: {
    id: string;
    name?: string;
    displayName?: string;
    username?: string;
    image?: string;
    isVerified?: boolean;
  };
}

interface UserProfile {
  id: string;
  name?: string;
  displayName?: string;
  username?: string;
  image?: string;
  bio?: string;
  isVerified: boolean;
  totalSales: number;
  totalPurchases: number;
  rating: number;
  ratingCount: number;
  sellerLevel?: string;
  successRate?: number;
  totalDisputes: number;
  disputesWon: number;
  disputesLost: number;
  twitterUsername?: string;
  twitterVerified?: boolean;
  createdAt: string;
  listings: ListingWithReservation[];
  reservedForViewer?: ListingWithReservation[];
}

export default function UserProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const { data: session } = useSession();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [activeTab, setActiveTab] = useState<"listings" | "reviews">("listings");

  useEffect(() => {
    async function fetchProfile() {
      try {
        const response = await fetch(`/api/users/${username}`);
        if (response.ok) {
          const data = await response.json();
          setProfile(data.user);
        } else if (response.status === 404) {
          setError("User not found");
        } else {
          setError("Failed to load profile");
        }
      } catch (err) {
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    }

    if (username) {
      fetchProfile();
    }
  }, [username]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Package className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            {error || "User not found"}
          </h1>
          <p className="text-zinc-500 mb-6">
            The user you're looking for doesn't exist or their profile is private.
          </p>
          <Link href="/explore" className="btn-primary">
            Browse Listings
          </Link>
        </div>
      </div>
    );
  }

  const displayName = profile.displayName || profile.name || profile.username || "Anonymous";

  return (
    <div className="min-h-screen pb-20">
      {/* Profile Header */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-zinc-900 dark:to-zinc-800 border-b border-zinc-200 dark:border-zinc-800">
        <div className="container-wide py-12">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            {/* Avatar */}
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center overflow-hidden ring-4 ring-white dark:ring-zinc-800 shadow-xl">
              {profile.image ? (
                <Image
                  src={profile.image}
                  alt={displayName}
                  width={128}
                  height={128}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-4xl md:text-5xl font-medium text-white">
                  {displayName[0].toUpperCase()}
                </span>
              )}
            </div>

            {/* Info */}
            <div className="text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-3">
                <h1 className="text-2xl md:text-3xl font-display font-semibold text-zinc-900 dark:text-zinc-100">
                  {displayName}
                </h1>
                {profile.isVerified && (
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                )}
                {profile.twitterVerified && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <Twitter className="w-4 h-4 text-blue-500" />
                    <span className="text-xs text-blue-600 dark:text-blue-400">@{profile.twitterUsername}</span>
                  </div>
                )}
              </div>
              {profile.username && (
                <p className="text-zinc-500 mt-1">@{profile.username}</p>
              )}
              {/* Rating */}
              {profile.ratingCount > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-5 h-5 ${
                          star <= Math.round(Number(profile.rating))
                            ? "text-yellow-400 fill-yellow-400"
                            : "text-zinc-300 dark:text-zinc-600"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-zinc-500">
                    {Number(profile.rating).toFixed(1)} ({profile.ratingCount} {profile.ratingCount === 1 ? "review" : "reviews"})
                  </span>
                </div>
              )}
              {profile.bio && (
                <p className="text-zinc-600 dark:text-zinc-400 mt-3 max-w-lg">
                  {profile.bio}
                </p>
              )}

              {/* Seller Level Badge */}
              {profile.sellerLevel && profile.sellerLevel !== "NEW" && (
                <div className="flex items-center gap-2 mt-3">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                    profile.sellerLevel === "GOLD"
                      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                      : profile.sellerLevel === "SILVER"
                      ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-700/30 dark:text-zinc-300"
                      : profile.sellerLevel === "BRONZE"
                      ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}>
                    <Award className="w-4 h-4" />
                    {profile.sellerLevel.charAt(0) + profile.sellerLevel.slice(1).toLowerCase()} Seller
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-4">
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <ShoppingBag className="w-4 h-4" />
                  <span>{profile.totalSales} sales</span>
                </div>
                {profile.totalPurchases > 0 && (
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <Package className="w-4 h-4" />
                    <span>{profile.totalPurchases} purchases</span>
                  </div>
                )}
                {profile.successRate !== undefined && Number(profile.successRate) > 0 && (
                  <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                    <TrendingUp className="w-4 h-4" />
                    <span>{profile.successRate}% success rate</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <Calendar className="w-4 h-4" />
                  <span>
                    Joined{" "}
                    {formatDistanceToNow(new Date(profile.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>

              {/* Dispute Stats - only show if there have been disputes */}
              {profile.totalDisputes > 0 && (
                <div className="flex items-center gap-4 mt-3 text-sm">
                  <div className="flex items-center gap-1.5 text-zinc-500">
                    <Shield className="w-4 h-4" />
                    <span>{profile.totalDisputes} dispute{profile.totalDisputes !== 1 ? 's' : ''}</span>
                  </div>
                  {profile.disputesWon > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {profile.disputesWon} won
                    </span>
                  )}
                  {profile.disputesLost > 0 && (
                    <span className="text-red-500">
                      {profile.disputesLost} lost
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Reserved For You Section */}
      {profile.reservedForViewer && profile.reservedForViewer.length > 0 && (
        <div className="container-wide py-8 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <Gift className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Reserved For You
              </h2>
              <p className="text-sm text-zinc-500">
                {displayName} has reserved {profile.reservedForViewer.length === 1 ? 'this listing' : 'these listings'} for you
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {profile.reservedForViewer.map((listing, index) => (
              <ListingCard
                key={listing.id}
                listing={{
                  ...listing,
                  seller: {
                    id: profile.id,
                    name: profile.name,
                    displayName: profile.displayName,
                    username: profile.username,
                    image: profile.image,
                    isVerified: profile.isVerified,
                  },
                }}
                index={index}
              />
            ))}
          </div>
        </div>
      )}

      {/* Tabs & Content */}
      <div className="container-wide py-8">
        {/* Tab Navigation */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-4 border-b border-zinc-200 dark:border-zinc-700">
            <button
              onClick={() => setActiveTab("listings")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "listings"
                  ? "border-emerald-500 text-emerald-600"
                  : "border-transparent text-zinc-500 hover:text-zinc-700"
              }`}
            >
              Listings ({profile.listings.length})
            </button>
            <button
              onClick={() => setActiveTab("reviews")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "reviews"
                  ? "border-emerald-500 text-emerald-600"
                  : "border-transparent text-zinc-500 hover:text-zinc-700"
              }`}
            >
              Reviews ({profile.ratingCount})
            </button>
          </div>

          {/* Leave Review Button */}
          {session?.user?.id && session.user.id !== profile.id && (
            <button
              onClick={() => setShowReviewForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 text-sm"
            >
              <Star className="w-4 h-4" />
              Leave Review
            </button>
          )}
        </div>

        {/* Listings Tab */}
        {activeTab === "listings" && (
          <>
            {profile.listings.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                <p className="text-zinc-500">No active listings</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {profile.listings.map((listing, index) => (
                  <ListingCard
                    key={listing.id}
                    listing={{
                      ...listing,
                      seller: {
                        id: profile.id,
                        name: profile.name,
                        displayName: profile.displayName,
                        username: profile.username,
                        image: profile.image,
                        isVerified: profile.isVerified,
                      },
                    }}
                    index={index}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Reviews Tab */}
        {activeTab === "reviews" && (
          <ReviewList userId={profile.id} />
        )}
      </div>

      {/* Review Form Modal */}
      {showReviewForm && (
        <ReviewForm
          subjectId={profile.id}
          subjectName={displayName}
          onClose={() => setShowReviewForm(false)}
          onSuccess={() => {
            setShowReviewForm(false);
            // Refresh profile to get updated rating
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
