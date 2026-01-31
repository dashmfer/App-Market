"use client";

import { useState, useEffect } from "react";
import { ListingCard } from "@/components/listings/listing-card";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

export default function FeaturedPage() {
  const t = useTranslations("featured");
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFeatured() {
      try {
        const response = await fetch("/api/listings?status=ACTIVE&featured=true");
        if (response.ok) {
          const data = await response.json();
          setListings(data.listings || []);
        }
      } catch (error) {
        console.error("Failed to fetch featured listings:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchFeatured();
  }, []);

  return (
    <div className="min-h-screen">
      <div className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
        <div className="container-wide py-12 md:py-16">
          <h1 className="text-4xl md:text-5xl font-display font-semibold text-zinc-900 dark:text-zinc-100">
            {t("title")}
          </h1>
          <p className="mt-4 text-xl text-zinc-600 dark:text-zinc-400">
            {t("subtitle")}
          </p>
        </div>
      </div>

      <div className="container-wide py-12">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-zinc-500 text-lg">{t("empty")}</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {listings.map((listing, index) => (
              <ListingCard key={listing.id} listing={listing} index={index} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
