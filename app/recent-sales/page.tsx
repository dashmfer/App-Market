"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ShoppingBag, ArrowRight, Loader2 } from "lucide-react";
import { ListingCard } from "@/components/listings/listing-card";

export default function RecentSalesPage() {
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSales() {
      try {
        // Fetch sold listings
        const response = await fetch("/api/listings?status=SOLD&sort=newest&limit=20");
        if (response.ok) {
          const data = await response.json();
          setRecentSales(data.listings || []);
        }
      } catch (error) {
        console.error("Failed to fetch recent sales:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchSales();
  }, []);

  return (
    <div className="min-h-screen">
      <div className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
        <div className="container-wide py-12 md:py-16">
          <h1 className="text-4xl md:text-5xl font-display font-semibold text-zinc-900 dark:text-zinc-100">
            Recent Sales
          </h1>
          <p className="mt-4 text-xl text-zinc-600 dark:text-zinc-400">
            See what's been selling on App Market
          </p>
        </div>
      </div>

      <div className="container-wide py-12">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : recentSales.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="w-20 h-20 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-6">
              <ShoppingBag className="w-10 h-10 text-zinc-400" />
            </div>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
              No sales yet
            </h2>
            <p className="text-zinc-500 mb-8 max-w-md mx-auto">
              Be the first to list and sell a project on App Market
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link href="/explore" className="btn-secondary">
                Browse Projects
              </Link>
              <Link href="/create" className="btn-primary">
                List Your Project
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {recentSales.map((listing, index) => (
              <ListingCard key={listing.id} listing={listing} index={index} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
