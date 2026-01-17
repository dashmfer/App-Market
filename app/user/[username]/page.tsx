"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Loader2, CheckCircle2, Package, Calendar, ShoppingBag } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ListingCard } from "@/components/listings/listing-card";

interface UserProfile {
  id: string;
  name?: string;
  displayName?: string;
  username?: string;
  image?: string;
  bio?: string;
  isVerified: boolean;
  totalSales: number;
  createdAt: string;
  listings: Array<{
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
    endTime: string;
    currentBid?: number;
    _count?: { bids: number };
    seller?: {
      id: string;
      name?: string;
      displayName?: string;
      username?: string;
      image?: string;
      isVerified?: boolean;
    };
  }>;
}

export default function UserProfilePage() {
  const params = useParams();
  const username = params.username as string;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
              </div>
              {profile.username && (
                <p className="text-zinc-500 mt-1">@{profile.username}</p>
              )}
              {profile.bio && (
                <p className="text-zinc-600 dark:text-zinc-400 mt-3 max-w-lg">
                  {profile.bio}
                </p>
              )}

              {/* Stats */}
              <div className="flex items-center justify-center md:justify-start gap-6 mt-4">
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <ShoppingBag className="w-4 h-4" />
                  <span>{profile.totalSales} sales</span>
                </div>
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
            </div>
          </div>
        </div>
      </div>

      {/* Listings */}
      <div className="container-wide py-8">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6">
          Listings ({profile.listings.length})
        </h2>

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
      </div>
    </div>
  );
}
