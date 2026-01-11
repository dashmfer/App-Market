"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";

export default function PurchasesPage() {
  const purchases: any[] = []; // Loaded from database

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="container-wide py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">My Purchases</h1>
          <p className="text-zinc-500 mt-1">Projects you've acquired</p>
        </div>

        {purchases.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
            <ShoppingBag className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">No purchases yet</h3>
            <p className="text-zinc-500 mt-2 mb-6">Browse the marketplace to find your next project</p>
            <Link href="/explore" className="btn-primary inline-flex">
              Explore Projects
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {purchases.map((purchase) => (
              <div key={purchase.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
                {/* Purchase item */}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
