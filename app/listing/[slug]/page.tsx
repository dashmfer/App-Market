"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
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
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

// Mock listing data
const mockListing = {
  id: "1",
  slug: "ai-recipe-generator",
  title: "AI Recipe Generator",
  tagline: "Generate personalized recipes with AI based on your ingredients and preferences",
  description: `
    A fully functional AI-powered recipe generator that creates personalized recipes based on available ingredients, dietary preferences, and cuisine types.

    ## Features
    - **Ingredient-based search**: Enter what you have, get recipes you can make
    - **Dietary filters**: Vegan, vegetarian, keto, gluten-free support
    - **AI-powered suggestions**: GPT-4 generates unique recipes
    - **Save favorites**: User accounts with saved recipes
    - **Shopping lists**: Auto-generate shopping lists from recipes
    - **Nutritional info**: Automatic calorie and macro calculations

    ## Tech Stack
    Built with modern technologies for scalability and performance:
    - Next.js 14 with App Router
    - OpenAI GPT-4 API integration
    - Prisma + PostgreSQL
    - Tailwind CSS + shadcn/ui
    - NextAuth.js authentication
    - Vercel deployment ready

    ## Why I'm Selling
    I built this as a side project but don't have time to market it properly. The tech is solid and it's ready for someone to take it to the next level.
  `,
  category: "AI_ML",
  techStack: ["Next.js", "OpenAI", "Prisma", "PostgreSQL", "Tailwind"],
  frameworks: ["Next.js 14", "React 18"],
  languages: ["TypeScript", "SQL"],
  
  // Assets
  githubRepo: "github.com/seller/recipe-ai",
  hasDomain: true,
  domain: "recipe-ai.app",
  hasDatabase: true,
  databaseType: "PostgreSQL on Supabase",
  hasHosting: true,
  hostingProvider: "Vercel",
  hasSocialAccounts: false,
  hasApiKeys: true,
  hasDesignFiles: true,
  hasDocumentation: true,
  
  // Media
  thumbnailUrl: null,
  screenshotUrls: [],
  demoUrl: "https://recipe-ai.app/demo",
  videoUrl: null,
  
  // Metrics
  monthlyUsers: 1200,
  monthlyRevenue: null,
  githubStars: 45,
  
  // Auction
  listingType: "AUCTION",
  startingPrice: 25,
  reservePrice: 40,
  buyNowPrice: 80,
  buyNowEnabled: true,
  currency: "SOL",
  startTime: new Date(Date.now() - 86400000 * 3),
  endTime: new Date(Date.now() + 86400000 * 2),
  
  // Current state
  currentBid: 45,
  bidCount: 12,
  
  // Seller
  seller: {
    id: "seller1",
    name: "alex.sol",
    walletAddress: "7x...abc",
    image: null,
    rating: 4.9,
    ratingCount: 23,
    verified: true,
    totalSales: 8,
    joinedAt: new Date("2024-01-15"),
  },
  
  // Bids
  bids: [
    { id: "b1", amount: 45, bidder: "buyer1.sol", time: new Date(Date.now() - 3600000) },
    { id: "b2", amount: 42, bidder: "anon...xyz", time: new Date(Date.now() - 7200000) },
    { id: "b3", amount: 38, bidder: "dev_mike", time: new Date(Date.now() - 10800000) },
    { id: "b4", amount: 35, bidder: "buyer1.sol", time: new Date(Date.now() - 14400000) },
    { id: "b5", amount: 30, bidder: "crypto_fan", time: new Date(Date.now() - 18000000) },
  ],
};

export default function ListingPage() {
  const params = useParams();
  const [bidAmount, setBidAmount] = useState(mockListing.currentBid + 1);
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [activeTab, setActiveTab] = useState<"description" | "assets" | "bids">("description");
  
  const listing = mockListing;
  const timeLeft = formatDistanceToNow(listing.endTime, { addSuffix: false });
  const isEndingSoon = listing.endTime.getTime() - Date.now() < 86400000;
  const minimumBid = listing.currentBid + 1;

  const assetsList = [
    { key: "github", label: "GitHub Repository", value: listing.githubRepo, icon: Github, included: true },
    { key: "domain", label: "Domain", value: listing.domain, icon: Globe, included: listing.hasDomain },
    { key: "database", label: "Database", value: listing.databaseType, icon: Database, included: listing.hasDatabase },
    { key: "hosting", label: "Hosting", value: listing.hostingProvider, icon: Globe, included: listing.hasHosting },
    { key: "apiKeys", label: "API Keys & Credentials", value: "Included", icon: Key, included: listing.hasApiKeys },
    { key: "design", label: "Design Files", value: "Figma files included", icon: Palette, included: listing.hasDesignFiles },
    { key: "docs", label: "Documentation", value: "Full docs included", icon: FileText, included: listing.hasDocumentation },
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
            <Link href={`/explore?category=${listing.category.toLowerCase()}`} className="hover:text-zinc-700 dark:hover:text-zinc-300">
              {listing.category.replace("_", " & ")}
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
                  <div className="flex items-center gap-3 mb-3">
                    <span className="badge-green">{listing.category.replace("_", " & ")}</span>
                    {isEndingSoon && (
                      <span className="badge-yellow flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Ending Soon
                      </span>
                    )}
                  </div>
                  <h1 className="text-3xl md:text-4xl font-display font-semibold text-zinc-900 dark:text-zinc-100">
                    {listing.title}
                  </h1>
                  <p className="mt-2 text-lg text-zinc-600 dark:text-zinc-400">
                    {listing.tagline}
                  </p>
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
              <div className="mt-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                  <span className="text-lg font-medium text-white">
                    {listing.seller.name[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {listing.seller.name}
                    </span>
                    {listing.seller.verified && (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      {listing.seller.rating} ({listing.seller.ratingCount} reviews)
                    </span>
                    <span>•</span>
                    <span>{listing.seller.totalSales} sales</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Demo/Preview */}
            <div className="aspect-video bg-zinc-100 dark:bg-zinc-900 rounded-2xl overflow-hidden relative">
              {listing.demoUrl ? (
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
                  <span className="text-6xl">🤖</span>
                </div>
              )}
            </div>

            {/* Tech Stack */}
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

            {/* Tabs */}
            <div className="border-b border-zinc-200 dark:border-zinc-800">
              <nav className="flex gap-8">
                {(["description", "assets", "bids"] as const).map((tab) => (
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

              {activeTab === "bids" && (
                <div className="space-y-3">
                  {listing.bids.map((bid, index) => (
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
                            {bid.bidder[0].toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-zinc-900 dark:text-zinc-100">
                            {bid.bidder}
                          </div>
                          <div className="text-sm text-zinc-500" suppressHydrationWarning>
                            {formatDistanceToNow(bid.time, { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {bid.amount} SOL
                        </div>
                        {index === 0 && (
                          <div className="text-sm text-green-600 dark:text-green-400">
                            Highest bid
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Bid Panel */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xl shadow-black/5">
                {/* Current Price */}
                <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-sm text-zinc-500">
                      <Gavel className="w-4 h-4" />
                      <span>Current bid ({listing.bidCount} bids)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-zinc-400" />
                      <span suppressHydrationWarning className={isEndingSoon ? "text-yellow-600 font-medium" : "text-zinc-500"}>
                        {timeLeft} left
                      </span>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-display font-semibold text-zinc-900 dark:text-zinc-100">
                      {listing.currentBid}
                    </span>
                    <span className="text-xl text-zinc-500">SOL</span>
                  </div>
                  <div className="text-sm text-zinc-500 mt-1">
                    ≈ ${(listing.currentBid * 150).toLocaleString()} USD
                  </div>
                </div>

                {/* Bid Input */}
                <div className="p-6 space-y-4">
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
                        step={1}
                        className="w-full px-4 py-3 pr-16 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-lg font-medium"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">
                        SOL
                      </span>
                    </div>
                    <p className="text-sm text-zinc-500 mt-2">
                      Minimum bid: {minimumBid} SOL
                    </p>
                  </div>

                  <button className="w-full btn-primary py-4 text-lg">
                    <Gavel className="w-5 h-5" />
                    Place Bid
                  </button>

                  {listing.buyNowEnabled && listing.buyNowPrice && (
                    <>
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

                      <button className="w-full btn-success py-4 text-lg">
                        <ShoppingCart className="w-5 h-5" />
                        Buy Now for {listing.buyNowPrice} SOL
                      </button>
                    </>
                  )}
                </div>

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
                        Verified GitHub ownership
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <TrendingUp className="w-5 h-5 text-green-500" />
                      <span className="text-zinc-600 dark:text-zinc-400">
                        5% platform fee on sale
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
    </div>
  );
}
