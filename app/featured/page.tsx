"use client";

import { ListingCard } from "@/components/listings/listing-card";

const featuredListings = [
  { id: "1", slug: "ai-recipe-generator", title: "AI Recipe Generator", tagline: "Generate personalized recipes with AI", thumbnailUrl: null, category: "AI_ML", techStack: ["Next.js", "OpenAI", "Tailwind"], currentBid: 45, buyNowPrice: 80, endTime: new Date(Date.now() + 86400000 * 2), bidCount: 12, seller: { name: "alex.sol", rating: 4.9, verified: true }},
  { id: "2", slug: "saas-boilerplate-pro", title: "SaaS Boilerplate Pro", tagline: "Production-ready SaaS starter kit", thumbnailUrl: null, category: "SAAS", techStack: ["Next.js", "Prisma", "Stripe"], currentBid: 120, buyNowPrice: 200, endTime: new Date(Date.now() + 86400000 * 5), bidCount: 28, seller: { name: "builder.sol", rating: 5.0, verified: true }},
  { id: "3", slug: "crypto-portfolio-tracker", title: "Crypto Portfolio Tracker", tagline: "Track all your crypto in one place", thumbnailUrl: null, category: "CRYPTO_WEB3", techStack: ["React", "Node.js", "CoinGecko API"], currentBid: 35, buyNowPrice: 60, endTime: new Date(Date.now() + 86400000 * 1), bidCount: 8, seller: { name: "defi_dev", rating: 4.7, verified: false }},
  { id: "4", slug: "ai-writing-assistant", title: "AI Writing Assistant", tagline: "Chrome extension for better writing", thumbnailUrl: null, category: "BROWSER_EXTENSION", techStack: ["Chrome Extension", "GPT-4", "React"], currentBid: 65, buyNowPrice: 100, endTime: new Date(Date.now() + 86400000 * 3), bidCount: 15, seller: { name: "chrome_wizard", rating: 4.8, verified: true }},
];

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
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredListings.map((listing, index) => (
            <ListingCard key={listing.id} listing={listing} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
