"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Heart,
  Settings,
  Bell,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  ExternalLink,
  Gift,
  Users,
  UserPlus,
  Loader2,
  Wallet,
  Copy,
  Check,
} from "lucide-react";

const sidebarLinks = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/listings", label: "My Listings", icon: Package },
  { href: "/dashboard/purchases", label: "Purchases", icon: ShoppingBag },
  { href: "/dashboard/collaborations", label: "Collaborations", icon: Users },
  { href: "/dashboard/purchase-partners", label: "Partner Invites", icon: UserPlus },
  { href: "/dashboard/watchlist", label: "Watchlist", icon: Heart },
  { href: "/dashboard/referrals", label: "Referrals", icon: Gift },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
  { href: "/dashboard/settings?tab=wallet", label: "Wallet", icon: Wallet },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function DashboardPage() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSales: 0,
    totalVolume: 0,
    activeListings: 0,
    pendingTransfers: 0,
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [activeListings, setActiveListings] = useState<any[]>([]);
  const [pendingTransferDetails, setPendingTransferDetails] = useState<any[]>([]);
  const [walletCopied, setWalletCopied] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  // Fetch wallet balance
  useEffect(() => {
    async function fetchWalletBalance() {
      const walletAddress = (session?.user as any)?.walletAddress;
      if (walletAddress) {
        try {
          const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
          const response = await fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "getBalance",
              params: [walletAddress],
            }),
          });
          const data = await response.json();
          if (data.result?.value !== undefined) {
            setWalletBalance(data.result.value / 1e9); // Convert lamports to SOL
          }
        } catch (error) {
          console.error("Failed to fetch wallet balance:", error);
        }
      }
    }
    fetchWalletBalance();
  }, [session]);

  useEffect(() => {
    async function fetchUserStats() {
      try {
        const response = await fetch("/api/user/stats");
        if (response.ok) {
          const data = await response.json();
          setStats({
            totalSales: data.stats.totalSales || 0,
            totalVolume: data.stats.totalVolume || 0,
            activeListings: data.stats.activeListings || 0,
            pendingTransfers: data.stats.pendingTransfers || 0,
          });
          setRecentActivity(data.recentActivity || []);
          setActiveListings(data.activeListings || []);
          setPendingTransferDetails(data.pendingTransferDetails || []);
        }
      } catch (error) {
        console.error("Failed to fetch user stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchUserStats();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 min-h-screen sticky top-0">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Dashboard
            </h2>
          </div>
          <nav className="flex-1 px-4">
            {sidebarLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-1 transition-colors ${
                    isActive
                      ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <link.icon className="w-5 h-5" />
                  <span className="font-medium">{link.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="p-4">
            <Link
              href="/create"
              className="flex items-center justify-center gap-2 w-full py-3 bg-black dark:bg-white text-white dark:text-black font-medium rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
            >
              <Plus className="w-5 h-5" />
              New Listing
            </Link>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-display font-semibold text-zinc-900 dark:text-zinc-100">
              Welcome back! 👋
            </h1>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">
              Here's what's happening with your projects
            </p>
          </div>

          {/* Pending Transfers Banner */}
          {stats.pendingTransfers > 0 && (
            <div className="mb-8 p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
                    You have {stats.pendingTransfers} pending transfer{stats.pendingTransfers > 1 ? "s" : ""}
                  </h3>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    Complete the asset transfer to release funds from escrow.
                  </p>
                  {pendingTransferDetails.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {pendingTransferDetails.map((t: any) => (
                        <Link
                          key={t.id}
                          href={`/dashboard/transfers/${t.id}`}
                          className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200 hover:underline"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          {t.listing?.title || "Transfer"} — {t.status.replace(/_/g, " ").toLowerCase()}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <ArrowUpRight className="w-4 h-4" />
                  12%
                </span>
              </div>
              <div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                {stats.totalVolume} SOL
              </div>
              <div className="text-sm text-zinc-500">Total Volume</div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                {stats.totalSales}
              </div>
              <div className="text-sm text-zinc-500">Completed Sales</div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Package className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                {stats.activeListings}
              </div>
              <div className="text-sm text-zinc-500">Active Listings</div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
              <div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                {stats.pendingTransfers}
              </div>
              <div className="text-sm text-zinc-500">Pending Transfers</div>
            </div>
          </div>

          {/* Wallet Card */}
          {(session?.user as any)?.walletAddress && (
            <div className="mb-8 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white relative overflow-hidden">
              {/* Background pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full border-8 border-white" />
                <div className="absolute -right-5 -bottom-5 w-24 h-24 rounded-full border-4 border-white" />
              </div>

              <div className="relative">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-green-100 text-sm font-medium mb-1">Your Wallet</p>
                    <div className="flex items-center gap-2">
                      <p className="text-3xl font-bold">
                        {walletBalance !== null ? `${walletBalance.toFixed(4)} SOL` : "Loading..."}
                      </p>
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                    <Wallet className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-black/20 rounded-xl p-3 mb-4">
                  <p className="text-green-100 text-xs mb-1">Wallet Address</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-mono truncate flex-1">
                      {(session?.user as any)?.walletAddress}
                    </p>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText((session?.user as any)?.walletAddress);
                        setWalletCopied(true);
                        setTimeout(() => setWalletCopied(false), 2000);
                      }}
                      className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex-shrink-0"
                    >
                      {walletCopied ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Link
                    href="/dashboard/settings?tab=wallet"
                    className="px-4 py-2 bg-white text-green-600 font-medium rounded-lg hover:bg-green-50 transition-colors text-sm"
                  >
                    Add Funds
                  </Link>
                  <Link
                    href="/dashboard/settings?tab=wallet"
                    className="px-4 py-2 bg-white/20 text-white font-medium rounded-lg hover:bg-white/30 transition-colors text-sm"
                  >
                    Manage Wallet
                  </Link>
                </div>
              </div>
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Active Listings */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Active Listings
                </h2>
                <Link
                  href="/dashboard/listings"
                  className="text-sm text-green-600 dark:text-green-400 hover:underline"
                >
                  View all
                </Link>
              </div>
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {loading ? (
                  <div className="p-8 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
                  </div>
                ) : activeListings.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No active listings</p>
                    <Link href="/create" className="text-green-600 hover:underline text-sm mt-1 inline-block">
                      Create your first listing
                    </Link>
                  </div>
                ) : (
                  activeListings.map((listing) => (
                    <Link key={listing.id} href={`/listing/${listing.slug}`} className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors block">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                            {listing.title}
                          </h3>
                          <div className="flex items-center gap-3 mt-1 text-sm text-zinc-500">
                            <span>{listing.bidCount} bids</span>
                            <span>•</span>
                            <span className={listing.status === "ending_soon" ? "text-yellow-600" : ""}>
                              {listing.status === "ending_soon" ? "Ending soon" : "Active"}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {listing.currentBid} SOL
                          </div>
                          <div className="text-sm text-zinc-500">Current bid</div>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Recent Activity
                </h2>
                <Link
                  href="/dashboard/notifications"
                  className="text-sm text-green-600 dark:text-green-400 hover:underline"
                >
                  View all
                </Link>
              </div>
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {loading ? (
                  <div className="p-8 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
                  </div>
                ) : recentActivity.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No recent activity</p>
                  </div>
                ) : (
                  recentActivity.map((activity) => (
                    <div key={activity.id} className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          activity.type === "sale"
                            ? "bg-green-100 dark:bg-green-900/30 text-green-600"
                            : activity.type === "bid"
                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600"
                            : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600"
                        }`}>
                          {activity.type === "sale" ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : activity.type === "bid" ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : (
                            <Clock className="w-4 h-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">
                            {activity.title}
                          </p>
                          {activity.amount && (
                            <p className="text-sm text-zinc-500">
                              {activity.amount} SOL
                            </p>
                          )}
                        </div>
                        <span className="text-sm text-zinc-400">
                          {Math.round((Date.now() - new Date(activity.time).getTime()) / 3600000)}h ago
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
