"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, ExternalLink } from "lucide-react";

const recentSales = [
  { id: "1", title: "AI Content Generator", category: "AI_ML", salePrice: 85, currency: "SOL", buyer: "buyer1.sol", seller: "creator.sol", soldAt: new Date(Date.now() - 3600000 * 2) },
  { id: "2", title: "NFT Marketplace Template", category: "CRYPTO_WEB3", salePrice: 150, currency: "SOL", buyer: "web3_dev", seller: "nft_builder", soldAt: new Date(Date.now() - 3600000 * 8) },
  { id: "3", title: "SaaS Dashboard Kit", category: "SAAS", salePrice: 95, currency: "SOL", buyer: "startup.sol", seller: "design_pro", soldAt: new Date(Date.now() - 86400000) },
  { id: "4", title: "Mobile Fitness App", category: "MOBILE_APP", salePrice: 200, currency: "SOL", buyer: "fitness_co", seller: "app_maker", soldAt: new Date(Date.now() - 86400000 * 2) },
  { id: "5", title: "Chrome Tab Manager", category: "BROWSER_EXTENSION", salePrice: 35, currency: "SOL", buyer: "productivity_fan", seller: "chrome_dev", soldAt: new Date(Date.now() - 86400000 * 3) },
];

const formatTimeAgo = (date: Date) => {
  const diff = Date.now() - date.getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export default function RecentSalesPage() {
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
        <div className="space-y-4">
          {recentSales.map((sale, index) => (
            <motion.div
              key={sale.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="flex items-center gap-4 p-4 md:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
            >
              <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                  {sale.title}
                </h3>
                <p className="text-sm text-zinc-500">
                  {sale.seller} → {sale.buyer}
                </p>
              </div>

              <div className="text-right">
                <div className="font-semibold text-green-600 dark:text-green-400">
                  {sale.salePrice} {sale.currency}
                </div>
                <div className="text-sm text-zinc-500" suppressHydrationWarning>
                  {formatTimeAgo(sale.soldAt)}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
