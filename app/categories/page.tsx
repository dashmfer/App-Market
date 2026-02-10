"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";

// Categories base data
const categoriesBase = [
  {
    slug: "saas",
    dbKey: "SAAS",
    name: "SaaS",
    icon: "💼",
    description: "Software as a Service products with recurring revenue potential",
    featured: ["CRM tools", "Analytics platforms", "Marketing automation"],
    color: "from-green-500 to-emerald-500",
  },
  {
    slug: "ai-ml",
    dbKey: "AI_ML",
    name: "AI & Machine Learning",
    icon: "🤖",
    description: "AI-powered applications, ML models, and intelligent tools",
    featured: ["ChatGPT wrappers", "Image generators", "AI assistants"],
    color: "from-green-500 to-emerald-500",
  },
  {
    slug: "mobile-app",
    dbKey: "MOBILE_APP",
    name: "Mobile Apps",
    icon: "📱",
    description: "iOS and Android applications ready for the app stores",
    featured: ["Fitness apps", "Social apps", "Utility apps"],
    color: "from-green-500 to-emerald-500",
  },
  {
    slug: "crypto-web3",
    dbKey: "CRYPTO_WEB3",
    name: "Crypto & Web3",
    icon: "⛓️",
    description: "Blockchain projects, DeFi protocols, and NFT platforms",
    featured: ["DEX interfaces", "NFT marketplaces", "Wallet apps"],
    color: "from-green-500 to-emerald-500",
  },
  {
    slug: "ecommerce",
    dbKey: "ECOMMERCE",
    name: "E-commerce",
    icon: "🛒",
    description: "Online stores, marketplaces, and shopping platforms",
    featured: ["Shopify apps", "Dropshipping tools", "Inventory systems"],
    color: "from-green-500 to-emerald-500",
  },
  {
    slug: "developer-tools",
    dbKey: "DEVELOPER_TOOLS",
    name: "Developer Tools",
    icon: "🛠️",
    description: "Tools and utilities that help developers build faster",
    featured: ["Code generators", "API tools", "Dev dashboards"],
    color: "from-green-500 to-emerald-500",
  },
  {
    slug: "web-app",
    dbKey: "WEB_APP",
    name: "Web Apps",
    icon: "🌐",
    description: "Full-stack web applications for various use cases",
    featured: ["Dashboards", "Booking systems", "Community platforms"],
    color: "from-green-500 to-emerald-500",
  },
  {
    slug: "browser-extension",
    dbKey: "BROWSER_EXTENSION",
    name: "Browser Extensions",
    icon: "🧩",
    description: "Chrome, Firefox, and other browser extensions",
    featured: ["Productivity tools", "Ad blockers", "Social tools"],
    color: "from-green-500 to-emerald-500",
  },
  {
    slug: "api",
    dbKey: "API",
    name: "APIs & Services",
    icon: "🔌",
    description: "Backend services, APIs, and microservices",
    featured: ["Payment APIs", "Auth services", "Data APIs"],
    color: "from-green-500 to-emerald-500",
  },
  {
    slug: "productivity",
    dbKey: "PRODUCTIVITY",
    name: "Productivity",
    icon: "✅",
    description: "Tools to help people work smarter and faster",
    featured: ["Note apps", "Task managers", "Time trackers"],
    color: "from-green-500 to-emerald-500",
  },
  {
    slug: "social",
    dbKey: "SOCIAL",
    name: "Social & Community",
    icon: "👥",
    description: "Social networks, community platforms, and engagement tools",
    featured: ["Forums", "Dating apps", "Networking tools"],
    color: "from-green-500 to-emerald-500",
  },
  {
    slug: "gaming",
    dbKey: "GAMING",
    name: "Gaming",
    icon: "🎮",
    description: "Games, gaming tools, and entertainment platforms",
    featured: ["Casual games", "Gaming utilities", "Esports tools"],
    color: "from-green-500 to-emerald-500",
  },
];

export default function CategoriesPage() {
  const t = useTranslations("categories");
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    async function fetchCounts() {
      try {
        const res = await fetch("/api/categories");
        if (res.ok) {
          const data = await res.json();
          setCounts(data.counts || {});
        }
      } catch (error: any) {
        console.error("Failed to fetch category counts:", error);
      }
    }
    fetchCounts();
  }, []);

  // Map categories with counts
  const categories = categoriesBase.map((cat) => ({
    ...cat,
    count: counts[cat.dbKey] || 0,
  }));

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        <div className="absolute inset-0 grid-pattern" />
        <div className="container-wide relative z-10">
          <div className="max-w-2xl">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-display font-semibold text-zinc-900 dark:text-zinc-100"
            >
              {t("title")}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-4 text-lg text-zinc-600 dark:text-zinc-400"
            >
              {t("subtitle")}
            </motion.p>
          </div>
        </div>
      </section>

      {/* Categories Grid */}
      <section className="pb-20">
        <div className="container-wide">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category, index) => (
              <motion.div
                key={category.slug}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link
                  href={`/explore?category=${category.slug}`}
                  className="block group h-full"
                >
                  <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden h-full hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-xl hover:shadow-black/5 transition-all duration-300">
                    {/* Header with gradient */}
                    <div className={`h-2 bg-gradient-to-r ${category.color}`} />
                    
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-14 h-14 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                          {category.icon}
                        </div>
                        <span className="px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                          {category.count} {t("projects")}
                        </span>
                      </div>

                      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                        {category.name}
                      </h2>
                      
                      <p className="mt-2 text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
                        {category.description}
                      </p>

                      <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                        <p className="text-xs text-zinc-500 mb-2">{t("popular")}:</p>
                        <div className="flex flex-wrap gap-2">
                          {category.featured.map((item) => (
                            <span
                              key={item}
                              className="px-2 py-1 rounded-md bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-600 dark:text-zinc-400"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 flex items-center text-green-600 dark:text-green-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        {t("browse")} {category.name}
                        <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800">
        <div className="container-tight text-center">
          <h2 className="text-2xl md:text-3xl font-display font-semibold text-zinc-900 dark:text-zinc-100">
            {t("cta.title")}
          </h2>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">
            {t("cta.subtitle")}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/explore" className="btn-primary">
              {t("cta.searchAll")}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/create" className="btn-secondary">
              {t("cta.listProject")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
