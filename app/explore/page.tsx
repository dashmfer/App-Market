"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  Search,
  SlidersHorizontal,
  Grid3X3,
  List,
  ChevronDown,
  X,
  Loader2,
} from "lucide-react";
import { ListingCard } from "@/components/listings/listing-card";

interface Listing {
  id: string;
  slug: string;
  title: string;
  tagline?: string;
  description: string;
  category: string;
  status: string;
  startingPrice: number;
  currentBid?: number;
  currency: string;
  thumbnailUrl?: string;
  endTime: string;
  createdAt: string;
  seller: {
    id: string;
    name?: string;
    username?: string;
  };
  _count?: {
    bids: number;
  };
}

function ExploreContent() {
  const t = useTranslations("explore");
  const tCommon = useTranslations("common");
  const searchParams = useSearchParams();

  const categories = [
    { value: "all", label: t("categories.all") },
    { value: "saas", label: t("categories.saas") },
    { value: "ai-ml", label: t("categories.aiMl") },
    { value: "mobile-app", label: t("categories.mobileApps") },
    { value: "web-app", label: t("categories.webApps") },
    { value: "browser-extension", label: t("categories.extensions") },
    { value: "crypto-web3", label: t("categories.crypto") },
    { value: "ecommerce", label: t("categories.ecommerce") },
    { value: "developer-tools", label: t("categories.devTools") },
    { value: "gaming", label: t("categories.gaming") },
    { value: "other", label: t("categories.other") },
  ];

  const blockchains = [
    { value: "all", label: t("chains.all") },
    { value: "solana", label: t("chains.solana") },
    { value: "base", label: t("chains.base") },
    { value: "hyperliquid", label: t("chains.hyperliquid") },
    { value: "ethereum", label: t("chains.ethereum") },
    { value: "bitcoin", label: t("chains.bitcoin") },
  ];

  const sortOptions = [
    { value: "ending-soon", label: t("sort.endingSoon") },
    { value: "newest", label: t("sort.newest") },
    { value: "price-low", label: t("sort.priceLow") },
    { value: "price-high", label: t("sort.priceHigh") },
    { value: "most-bids", label: t("sort.mostBids") },
  ];

  const priceRanges = [
    { value: "all", label: t("price.any") },
    { value: "0-25", label: t("price.under25") },
    { value: "25-50", label: t("price.25to50") },
    { value: "50-100", label: t("price.50to100") },
    { value: "100+", label: t("price.over100") },
  ];

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedBlockchain, setSelectedBlockchain] = useState("all");
  const [selectedSort, setSelectedSort] = useState("ending-soon");
  const [selectedPrice, setSelectedPrice] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showFilters, setShowFilters] = useState(false);
  const [watchlistedIds, setWatchlistedIds] = useState<Set<string>>(new Set());
  const isInitialMount = useRef(true);

  // Fetch user's watchlist to show correct heart states
  useEffect(() => {
    const fetchWatchlist = async () => {
      try {
        const response = await fetch("/api/watchlist");
        if (response.ok) {
          const data = await response.json();
          const ids = new Set<string>(data.listings?.map((l: any) => l.id) || []);
          setWatchlistedIds(ids);
        }
      } catch (err) {
        // Silently fail - user might not be logged in
      }
    };
    fetchWatchlist();
  }, []);

  // Read URL params on mount
  useEffect(() => {
    const categoryParam = searchParams.get("category");
    const blockchainParam = searchParams.get("blockchain");
    if (categoryParam) {
      setSelectedCategory(categoryParam);
    }
    if (blockchainParam) {
      setSelectedBlockchain(blockchainParam);
    }
  }, [searchParams]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("status", "ACTIVE");
      params.set("sort", selectedSort);

      if (selectedCategory !== "all") {
        params.set("category", selectedCategory);
      }

      if (selectedBlockchain !== "all") {
        params.set("blockchain", selectedBlockchain);
      }

      if (debouncedSearch) {
        params.set("search", debouncedSearch);
      }

      if (selectedPrice !== "all") {
        const [min, max] = selectedPrice.split("-");
        if (min) params.set("minPrice", min);
        if (max && max !== "+") params.set("maxPrice", max);
        if (selectedPrice === "100+") params.set("minPrice", "100");
      }

      const response = await fetch(`/api/listings?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setListings(data.listings || []);
      } else {
        setError(tCommon("error"));
      }
    } catch (err) {
      setError(tCommon("error"));
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedBlockchain, selectedSort, selectedPrice, debouncedSearch, tCommon]);

  // Fetch listings when filters change (using debounced search)
  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const activeFiltersCount = [
    selectedCategory !== "all",
    selectedBlockchain !== "all",
    selectedPrice !== "all",
    searchQuery !== "",
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
        <div className="container-wide py-8 md:py-12">
          <h1 className="text-3xl md:text-4xl font-display font-semibold text-zinc-900 dark:text-zinc-100">
            {t("title")}
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            {t("subtitle")}
          </p>
        </div>
      </div>

      <div className="container-wide py-8">
        {/* Search & Filters Bar */}
        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            )}
          </div>

          {/* Filter Controls */}
          <div className="flex items-center gap-3">
            {/* Category Select */}
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="appearance-none pl-4 pr-10 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer"
              >
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            </div>

            {/* Sort Select */}
            <div className="relative">
              <select
                value={selectedSort}
                onChange={(e) => setSelectedSort(e.target.value)}
                className="appearance-none pl-4 pr-10 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer"
              >
                {sortOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            </div>

            {/* More Filters Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-colors ${
                showFilters || activeFiltersCount > 0
                  ? "bg-green-50 dark:bg-green-900/20 border-green-500 text-green-700 dark:text-green-400"
                  : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">{t("filters")}</span>
              {activeFiltersCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-green-500 text-white text-xs flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* View Mode Toggle */}
            <div className="hidden sm:flex items-center border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-3 transition-colors ${
                  viewMode === "grid"
                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                }`}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-3 transition-colors ${
                  viewMode === "list"
                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-8 p-6 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800"
          >
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Price Range */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  {t("priceRange")}
                </label>
                <div className="space-y-2">
                  {priceRanges.map((range) => (
                    <label
                      key={range.value}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="priceRange"
                        value={range.value}
                        checked={selectedPrice === range.value}
                        onChange={(e) => setSelectedPrice(e.target.value)}
                        className="w-4 h-4 text-green-500 focus:ring-green-500"
                      />
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">
                        {range.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Blockchain Filter */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  {t("blockchain")}
                </label>
                <div className="space-y-2">
                  {blockchains.map((chain) => (
                    <label
                      key={chain.value}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="blockchain"
                        value={chain.value}
                        checked={selectedBlockchain === chain.value}
                        onChange={(e) => setSelectedBlockchain(e.target.value)}
                        className="w-4 h-4 text-green-500 focus:ring-green-500"
                      />
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">
                        {chain.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <button
                onClick={() => {
                  setSelectedCategory("all");
                  setSelectedBlockchain("all");
                  setSelectedPrice("all");
                  setSearchQuery("");
                }}
                className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                {t("clearFilters")}
              </button>
              <button
                onClick={() => setShowFilters(false)}
                className="btn-primary text-sm py-2"
              >
                {t("applyFilters")}
              </button>
            </div>
          </motion.div>
        )}

        {/* Results Count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-zinc-500">
            {loading ? (
              t("loading")
            ) : (
              <>
                {t("showing")}{" "}
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {listings.length}
                </span>{" "}
                {t("projects")}
              </>
            )}
          </p>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-zinc-500 dark:text-zinc-400">
              {t("noResults")}
            </p>
          </div>
        ) : (
          /* Listings Grid */
          <div
            className={
              viewMode === "grid"
                ? "grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                : "space-y-4"
            }
          >
            {listings.map((listing, index) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                index={index}
                initialWatchlisted={watchlistedIds.has(listing.id)}
              />
            ))}
          </div>
        )}

        {/* Load More */}
        {!loading && listings.length > 0 && (
          <div className="mt-12 text-center">
            <button className="btn-secondary">{t("loadMore")}</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    }>
      <ExploreContent />
    </Suspense>
  );
}
