"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ShoppingBag, ArrowRight } from "lucide-react";

export default function RecentSalesPage() {
  // Sales loaded from database
  const recentSales: any[] = [];

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
        {recentSales.length === 0 ? (
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
          <div className="space-y-4">
            {/* Sales will render here when data exists */}
          </div>
        )}
      </div>
    </div>
  );
}
