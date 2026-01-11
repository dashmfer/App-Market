"use client";

import { ListingCard } from "@/components/listings/listing-card";

const featuredListings: any[] = [];

export default function FeaturedPage() {
  return (
    <div className="min-h-screen">
      <div className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
        <div className="container-wide py-12 md:py-16">
          <h1 className="text-4xl md:text-5xl font-display font-semibold text-zinc-900 dark:text-zinc-100">
            Featured Projects
          </h1>
          <p className="mt-4 text-xl text-zinc-600 dark:text-zinc-400">
            Hand-picked projects with exceptional quality and potential
          </p>
        </div>
      </div>

      <div className="container-wide py-12">
        {featuredListings.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-zinc-500 text-lg">No featured projects yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredListings.map((listing, index) => (
              <ListingCard key={listing.id} listing={listing} index={index} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
