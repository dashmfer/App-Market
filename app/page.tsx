"use client";

import Link from "next/link";
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
} from "lucide-react";
import { ListingCard } from "@/components/listings/listing-card";
import { CategoryCard } from "@/components/home/category-card";
import { StatsCounter } from "@/components/home/stats-counter";
import { HowItWorksStep } from "@/components/home/how-it-works-step";

// Listings loaded from database
const featuredListings: any[] = [];

const categories = [
  { name: "SaaS", slug: "saas", count: 0, icon: "💼" },
  { name: "AI & ML", slug: "ai-ml", count: 0, icon: "🤖" },
  { name: "Mobile Apps", slug: "mobile-app", count: 0, icon: "📱" },
  { name: "Crypto & Web3", slug: "crypto-web3", count: 0, icon: "⛓️" },
  { name: "E-commerce", slug: "ecommerce", count: 0, icon: "🛒" },
  { name: "Developer Tools", slug: "developer-tools", count: 0, icon: "🛠️" },
];

const stats = [
  { label: "Projects Sold", value: 0, suffix: "" },
  { label: "Total Volume", value: 0, prefix: "", suffix: " SOL" },
  { label: "Active Sellers", value: 0, suffix: "" },
  { label: "Avg. Sale Time", value: 0, suffix: " days" },
];

const howItWorks = [
  {
    step: 1,
    title: "List Your Project",
    description: "Connect your GitHub, describe your project, and set your auction parameters. We verify ownership automatically.",
    icon: Github,
  },
  {
    step: 2,
    title: "Receive Bids",
    description: "Buyers discover and bid on your project. Watch the auction unfold in real-time with on-chain transparency.",
    icon: TrendingUp,
  },
  {
    step: 3,
    title: "Secure Escrow",
    description: "When the auction ends, funds are held in trustless escrow on Solana. No middleman, no risk.",
    icon: Lock,
  },
  {
    step: 4,
    title: "Transfer & Release",
    description: "Transfer assets to the buyer, confirm receipt, and funds are released automatically. Simple.",
    icon: CheckCircle2,
  },
];

export default function HomePage() {
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
              <span>Built on Solana • Trustless Escrow</span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 animate-fade-in-up">
              Buy & Sell
              <br />
              <span className="gradient-text">Digital Products</span>
            </h1>

            {/* Subheadline */}
            <p className="mt-6 text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed animate-fade-in-up animate-delay-100">
              The marketplace for AI-generated apps, prototypes, and MVPs.
              Secure on-chain auctions and transfer.
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up animate-delay-200">
              <Link href="/explore" className="btn-primary text-lg px-8 py-4">
                <span>Explore Projects</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/create" className="btn-secondary text-lg px-8 py-4">
                <span>Start Selling</span>
              </Link>
            </div>

            {/* Payment Methods */}
            <div className="mt-12 flex items-center justify-center gap-6 text-zinc-400 animate-fade-in-up animate-delay-300">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                <span className="text-sm">SOL</span>
              </div>
              <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700" />
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                <span className="text-sm">Credit Card</span>
              </div>
              <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700" />
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5" />
                <span className="text-sm">USDC</span>
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
                Featured Projects
              </h2>
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                Hand-picked projects with high potential
              </p>
            </div>
            <Link
              href="/explore?featured=true"
              className="hidden sm:flex items-center gap-2 text-green-600 dark:text-green-400 font-medium hover:gap-3 transition-all"
            >
              View All
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredListings.map((listing, index) => (
              <ListingCard key={listing.id} listing={listing} index={index} />
            ))}
          </div>

          <div className="mt-8 text-center sm:hidden">
            <Link href="/explore?featured=true" className="btn-secondary">
              View All Featured
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
              Browse by Category
            </h2>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Find projects in your area of interest
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
              How It Works
            </h2>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Simple, secure, and transparent
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
              Why App Market?
            </h2>
            <p className="mt-2 text-zinc-400">
              Built for builders, by builders
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-8 rounded-3xl bg-zinc-900 border border-zinc-800 hover:border-green-500/50 transition-colors">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mb-6">
                <Shield className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Trustless Escrow</h3>
              <p className="text-zinc-400 leading-relaxed">
                Funds are held in Solana smart contracts, not our wallets. 
                Release happens automatically when both parties confirm.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-8 rounded-3xl bg-zinc-900 border border-zinc-800 hover:border-green-500/50 transition-colors">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mb-6">
                <Zap className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Instant Settlement</h3>
              <p className="text-zinc-400 leading-relaxed">
                No waiting for banks. Solana transactions settle in seconds.
                Pay with crypto or credit card—your choice.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-8 rounded-3xl bg-zinc-900 border border-zinc-800 hover:border-green-500/50 transition-colors">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mb-6">
                <Coins className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Token Launches</h3>
              <p className="text-zinc-400 leading-relaxed">
                Acquire a project and launch a token in one click. 
                Fair launches, presales, and liquidity—all built in.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-8 rounded-3xl bg-zinc-900 border border-zinc-800 hover:border-green-500/50 transition-colors">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mb-6">
                <Github className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Verified Ownership</h3>
              <p className="text-zinc-400 leading-relaxed">
                We verify GitHub ownership before listing. 
                Automated checks ensure legitimate transfers.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-8 rounded-3xl bg-zinc-900 border border-zinc-800 hover:border-green-500/50 transition-colors">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mb-6">
                <Globe className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Global Access</h3>
              <p className="text-zinc-400 leading-relaxed">
                No country restrictions. Anyone with a wallet can buy or sell.
                Crypto-native with fiat rails for everyone.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-8 rounded-3xl bg-zinc-900 border border-zinc-800 hover:border-green-500/50 transition-colors">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mb-6">
                <Users className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Fair Disputes</h3>
              <p className="text-zinc-400 leading-relaxed">
                If something goes wrong, our dispute system ensures 
                fair resolution with evidence review.
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
                Ready to Get Started?
              </h2>
              <p className="text-lg text-white/80 max-w-xl mx-auto mb-8">
                Join thousands of builders buying and selling digital products 
                on the most trusted marketplace.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/create"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-white text-green-600 font-semibold rounded-full hover:bg-zinc-100 transition-colors"
                >
                  List Your Project
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  href="/explore"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 text-white font-semibold rounded-full hover:bg-white/20 transition-colors backdrop-blur-sm border border-white/20"
                >
                  Browse Marketplace
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
