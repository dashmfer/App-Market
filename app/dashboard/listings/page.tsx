"use client";

import Link from "next/link";
import { Package, Plus, Clock, CheckCircle2, AlertCircle } from "lucide-react";

export default function ListingsPage() {
  const listings: any[] = []; // Loaded from database

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="container-wide py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">My Listings</h1>
            <p className="text-zinc-500 mt-1">Manage your project listings</p>
          </div>
          <Link href="/create" className="btn-primary">
            <Plus className="w-4 h-4" />
            New Listing
          </Link>
        </div>

        {listings.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
            <Package className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">No listings yet</h3>
            <p className="text-zinc-500 mt-2 mb-6">Create your first listing to start selling</p>
            <Link href="/create" className="btn-primary inline-flex">
              <Plus className="w-4 h-4" />
              Create Listing
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {listings.map((listing) => (
              <div key={listing.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
                {/* Listing item */}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
