"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  Shield,
  Zap,
  Globe,
  Coins,
  CheckCircle2,
  TrendingUp,
  Users,
  Lock,
  Sparkles,
  Github,
  CreditCard,
  Wallet,
  Loader2,
} from "lucide-react";
import { ListingCard } from "@/components/listings/listing-card";
import { CategoryCard } from "@/components/home/category-card";
import { StatsCounter } from "@/components/home/stats-counter";
import { HowItWorksStep } from "@/components/home/how-it-works-step";

const categoriesBase = [
  { name: "SaaS", slug: "saas", dbKey: "SAAS", icon: "💼" },
  { name: "AI & ML", slug: "ai-ml", dbKey: "AI_ML", icon: "🤖" },
  { name: "Mobile Apps", slug: "mobile-app", dbKey: "MOBILE_APP", icon: "📱" },
  { name: "Crypto & Web3", slug: "crypto-web3", dbKey: "CRYPTO_WEB3", icon: "⛓️" },
  { name: "E-commerce", slug: "ecommerce", dbKey: "ECOMMERCE", icon: "🛒" },
  { name: "Developer Tools", slug: "developer-tools", dbKey: "DEVELOPER_TOOLS", icon: "🛠️" },
];

export default function HomePage() {
  const t = useTranslations("home");
  const tCommon = useTranslations("common");

  const [featuredListings, setFeaturedListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [platformStats, setPlatformStats] = useState({
    projectsSold: 0,
    totalVolume: 0,
    activeSellers: 0,
    avgSaleTime: 7,
  });

  const stats = [
    { label: t("stats.projectsSold"), value: platformStats.projectsSold, suffix: "" },
    { label: t("stats.totalVolume"), value: Math.round(platformStats.totalVolume * 100) / 100, prefix: "", suffix: " SOL" },
    { label: t("stats.activeSellers"), value: platformStats.activeSellers, suffix: "" },
    { label: t("stats.avgSaleTime"), value: platformStats.avgSaleTime, suffix: ` ${t("stats.days")}` },
  ];

  const howItWorks = [
    {
      step: 1,
      title: t("howItWorks.step1.title"),
      description: t("howItWorks.step1.description"),
      icon: Github,
    },
    {
      step: 2,
      title: t("howItWorks.step2.title"),
      description: t("howItWorks.step2.description"),
      icon: TrendingUp,
    },
    {
      step: 3,
      title: t("howItWorks.step3.title"),
      description: t("howItWorks.step3.description"),
      icon: Lock,
    },
    {
      step: 4,
      title: t("howItWorks.step4.title"),
      description: t("howItWorks.step4.description"),
      icon: CheckCircle2,
    },
  ];

  useEffect(() => {
    async function fetchListings() {
      try {
        // Fetch recent active listings (up to 4 for the homepage)
        const response = await fetch("/api/listings?status=ACTIVE&sort=newest&limit=4");
        if (response.ok) {
          const data = await response.json();
          setFeaturedListings(data.listings || []);
        }
      } catch (error) {
        console.error("Failed to fetch listings:", error);
      } finally {
        setLoading(false);
      }
    }

    async function fetchCategoryCounts() {
      try {
        const response = await fetch("/api/categories");
        if (response.ok) {
          const data = await response.json();
          setCategoryCounts(data.counts || {});
        }
      } catch (error) {
        console.error("Failed to fetch category counts:", error);
      }
    }

    async function fetchPlatformStats() {
      try {
        const response = await fetch("/api/stats");
        if (response.ok) {
          const data = await response.json();
          setPlatformStats({
            projectsSold: data.projectsSold || 0,
            totalVolume: data.totalVolume || 0,
            activeSellers: data.activeSellers || 0,
            avgSaleTime: data.avgSaleTime || 7,
          });
        }
      } catch (error) {
        console.error("Failed to fetch platform stats:", error);
      }
    }

    fetchListings();
    fetchCategoryCounts();
    fetchPlatformStats();
  }, []);

  // Map categories with dynamic counts
  const categories = categoriesBase.map((cat) => ({
    ...cat,
    count: categoryCounts[cat.dbKey] || 0,
  }));

  return (
    <div className="relative">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 grid-pattern" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/20 rounded-full blur-[128px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-[128px] animate-pulse animate-delay-500" />

        <div className="container-wide relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-medium mb-8 animate-fade-in">
              <Sparkles className="w-4 h-4" />
              <span>{t("badge")}</span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 animate-fade-in-up">
              {t("hero.title")}
              <br />
              <span className="gradient-text">{t("hero.titleHighlight")}</span>
            </h1>

            {/* Subheadline */}
            <p className="mt-6 text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed animate-fade-in-up animate-delay-100">
              {t("hero.subtitle")}
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up animate-delay-200">
              <Link href="/explore" className="btn-primary text-lg px-8 py-4">
                <span>{t("hero.cta")}</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/create" className="btn-secondary text-lg px-8 py-4">
                <span>{t("hero.ctaSecondary")}</span>
              </Link>
            </div>

            {/* Payment Methods */}
            <div className="mt-12 flex items-center justify-center gap-6 text-zinc-400 animate-fade-in-up animate-delay-300">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                <span className="text-sm">{t("payment.sol")}</span>
              </div>
              <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700" />
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                <span className="text-sm">{t("payment.card")}</span>
              </div>
              <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700" />
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5" />
                <span className="text-sm">{t("payment.usdc")}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-zinc-300 dark:border-zinc-700 flex items-start justify-center p-2">
            <div className="w-1 h-2 bg-zinc-400 rounded-full animate-pulse" />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-zinc-50 dark:bg-zinc-950 border-y border-zinc-200 dark:border-zinc-800">
        <div className="container-wide">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <StatsCounter key={stat.label} {...stat} delay={index * 100} />
            ))}
          </div>
        </div>
      </section>

      {/* Featured Listings */}
      <section className="section">
        <div className="container-wide">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="text-3xl md:text-4xl font-display font-semibold text-zinc-900 dark:text-zinc-100">
                {t("featured.title")}
              </h2>
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                {t("featured.subtitle")}
              </p>
            </div>
            <Link
              href="/explore?featured=true"
              className="hidden sm:flex items-center gap-2 text-green-600 dark:text-green-400 font-medium hover:gap-3 transition-all"
            >
              {t("featured.viewAll")}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
          ) : featuredListings.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-zinc-500 dark:text-zinc-400 mb-4">
                {t("featured.empty")}
              </p>
              <Link href="/create" className="btn-primary">
                {t("featured.listProject")}
              </Link>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredListings.map((listing, index) => (
                <ListingCard key={listing.id} listing={listing} index={index} />
              ))}
            </div>
          )}

          <div className="mt-8 text-center sm:hidden">
            <Link href="/explore?featured=true" className="btn-secondary">
              {t("featured.viewAll")}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="section bg-zinc-50 dark:bg-zinc-950">
        <div className="container-wide">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-display font-semibold text-zinc-900 dark:text-zinc-100">
              {t("categories.title")}
            </h2>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              {t("categories.subtitle")}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category, index) => (
              <CategoryCard key={category.slug} category={category} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="section">
        <div className="container-wide">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-semibold text-zinc-900 dark:text-zinc-100">
              {t("howItWorks.title")}
            </h2>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              {t("howItWorks.subtitle")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {howItWorks.map((step, index) => (
              <HowItWorksStep key={step.step} {...step} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section bg-black text-white">
        <div className="container-wide">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-semibold">
              {t("features.title")}
            </h2>
            <p className="mt-2 text-zinc-400">
              {t("features.subtitle")}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-8 rounded-3xl bg-zinc-900 border border-zinc-800 hover:border-green-500/50 transition-colors">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mb-6">
                <Shield className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{t("features.escrow.title")}</h3>
              <p className="text-zinc-400 leading-relaxed">
                {t("features.escrow.description")}
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-8 rounded-3xl bg-zinc-900 border border-zinc-800 hover:border-green-500/50 transition-colors">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mb-6">
                <Zap className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{t("features.settlement.title")}</h3>
              <p className="text-zinc-400 leading-relaxed">
                {t("features.settlement.description")}
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-8 rounded-3xl bg-zinc-900 border border-zinc-800 hover:border-green-500/50 transition-colors">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mb-6">
                <Github className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{t("features.ownership.title")}</h3>
              <p className="text-zinc-400 leading-relaxed">
                {t("features.ownership.description")}
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-8 rounded-3xl bg-zinc-900 border border-zinc-800 hover:border-green-500/50 transition-colors">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mb-6">
                <Globe className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{t("features.global.title")}</h3>
              <p className="text-zinc-400 leading-relaxed">
                {t("features.global.description")}
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-8 rounded-3xl bg-zinc-900 border border-zinc-800 hover:border-green-500/50 transition-colors">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mb-6">
                <Users className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{t("features.disputes.title")}</h3>
              <p className="text-zinc-400 leading-relaxed">
                {t("features.disputes.description")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section">
        <div className="container-tight">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500 p-12 md:p-16 text-center">
            {/* Background decoration */}
            <div className="absolute inset-0 bg-[url('/grid-white.svg')] opacity-10" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />

            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-display font-semibold text-white mb-4">
                {t("cta.title")}
              </h2>
              <p className="text-lg text-white/80 max-w-xl mx-auto mb-8">
                {t("cta.subtitle")}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/create"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-white text-green-600 font-semibold rounded-full hover:bg-zinc-100 transition-colors"
                >
                  {t("cta.listProject")}
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  href="/explore"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 text-white font-semibold rounded-full hover:bg-white/20 transition-colors backdrop-blur-sm border border-white/20"
                >
                  {t("cta.browseMarketplace")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
