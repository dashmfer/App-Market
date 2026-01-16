"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Github,
  Gavel,
  Shield,
  CheckCircle2,
  ArrowRight,
  Upload,
  Users,
  CreditCard,
  Lock,
  RefreshCw,
  AlertTriangle,
  Coins,
  Wallet,
  FileCheck,
  Scale,
} from "lucide-react";

const sellerSteps = [
  {
    icon: Github,
    title: "Connect Your GitHub",
    description:
      "Link your GitHub account to verify ownership of the repository you want to sell. This ensures buyers know you're the real owner.",
  },
  {
    icon: Upload,
    title: "Create Your Listing",
    description:
      "Describe your project, add screenshots, specify what's included (domain, database, hosting), and set your auction parameters.",
  },
  {
    icon: Gavel,
    title: "Receive Bids",
    description:
      "Watch as buyers discover your project and place bids. Set a reserve price if you have a minimum in mind, or enable Buy Now for instant sales.",
  },
  {
    icon: Lock,
    title: "Escrow Protection",
    description:
      "When your auction ends or someone buys now, funds are locked in our Solana smart contract escrow. No middleman holds your money.",
  },
  {
    icon: FileCheck,
    title: "Transfer Assets",
    description:
      "Transfer the GitHub repo, domain, and any other assets to the buyer. Check off each item as you complete it.",
  },
  {
    icon: Coins,
    title: "Get Paid",
    description:
      "Once the buyer confirms receipt of all assets, funds are automatically released to your wallet. Simple as that.",
  },
];

const buyerSteps = [
  {
    icon: Users,
    title: "Browse & Discover",
    description:
      "Explore our curated marketplace of apps, prototypes, and MVPs. Filter by category, tech stack, price range, and more.",
  },
  {
    icon: CheckCircle2,
    title: "Verify & Research",
    description:
      "Review the project details, check the seller's reputation, examine the demo, and verify what's included in the sale.",
  },
  {
    icon: Gavel,
    title: "Place Your Bid",
    description:
      "Bid on projects you're interested in, or use Buy Now for instant acquisition. Pay with SOL, USDC, or credit card.",
  },
  {
    icon: Lock,
    title: "Funds in Escrow",
    description:
      "Your payment is held securely in our smart contract. The seller can't access it until you confirm the transfer is complete.",
  },
  {
    icon: RefreshCw,
    title: "Receive Assets",
    description:
      "The seller transfers the GitHub repo, domain, and other assets to you. Confirm each item as you receive it.",
  },
  {
    icon: Shield,
    title: "Ownership Secured",
    description:
      "Once you confirm receipt, you're the new owner! All assets are transferred and the sale is complete.",
  },
];

const features = [
  {
    icon: Shield,
    title: "Trustless Escrow",
    description:
      "Built on Solana smart contracts. Funds are never held by us—they're locked in code until both parties are satisfied.",
  },
  {
    icon: CreditCard,
    title: "Multiple Payment Options",
    description:
      "Pay with SOL, USDC, or credit card. We handle the conversion so you can use whatever works best for you.",
  },
  {
    icon: Github,
    title: "Verified Ownership",
    description:
      "We verify GitHub ownership before any listing goes live. No fake sellers, no stolen code.",
  },
  {
    icon: Scale,
    title: "Fair Dispute Resolution",
    description:
      "If something goes wrong, our dispute system ensures fair resolution. Evidence-based decisions, 2% fee to the losing party.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        <div className="absolute inset-0 grid-pattern" />
        <div className="container-wide relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl lg:text-6xl font-display font-semibold text-zinc-900 dark:text-zinc-100"
            >
              How App Market Works
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-6 text-xl text-zinc-600 dark:text-zinc-400"
            >
              Buy and sell digital products with confidence. Trustless escrow,
              verified ownership, and fair dispute resolution.
            </motion.p>
          </div>
        </div>
      </section>

      {/* For Sellers */}
      <section className="py-20 bg-zinc-50 dark:bg-zinc-950">
        <div className="container-wide">
          <div className="text-center mb-16">
            <span className="badge-green mb-4">For Sellers</span>
            <h2 className="text-3xl md:text-4xl font-display font-semibold text-zinc-900 dark:text-zinc-100">
              Sell Your Project
            </h2>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
              Turn your side projects into cash. List in minutes, get paid securely.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {sellerSteps.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="relative"
              >
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 h-full">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                      <step.icon className="w-6 h-6" />
                    </div>
                    <span className="text-4xl font-display font-bold text-zinc-200 dark:text-zinc-800">
                      {index + 1}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link href="/create" className="btn-success text-lg px-8 py-4">
              Start Selling
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* For Buyers */}
      <section className="py-20">
        <div className="container-wide">
          <div className="text-center mb-16">
            <span className="badge-green mb-4">For Buyers</span>
            <h2 className="text-3xl md:text-4xl font-display font-semibold text-zinc-900 dark:text-zinc-100">
              Acquire a Project
            </h2>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
              Skip months of development. Buy a working product and make it your own.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {buyerSteps.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="relative"
              >
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 h-full">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <step.icon className="w-6 h-6" />
                    </div>
                    <span className="text-4xl font-display font-bold text-zinc-200 dark:text-zinc-800">
                      {index + 1}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link href="/explore" className="btn-primary text-lg px-8 py-4">
              Browse Projects
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Platform Features */}
      <section className="py-20 bg-black text-white">
        <div className="container-wide">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-semibold">
              Built for Trust
            </h2>
            <p className="mt-4 text-zinc-400 max-w-2xl mx-auto">
              Every feature designed to make buying and selling secure and fair.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-8 rounded-2xl bg-zinc-900 border border-zinc-800"
              >
                <div className="w-14 h-14 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400 mb-6">
                  <feature.icon className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-zinc-400">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Fees */}
      <section className="py-20">
        <div className="container-tight">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-semibold text-zinc-900 dark:text-zinc-100">
              Simple, Transparent Pricing
            </h2>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">
              No hidden fees. You know exactly what you're paying.
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="p-8 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                    Platform Fee
                  </h3>
                  <p className="text-zinc-500 mt-1">
                    Deducted from the sale price
                  </p>
                </div>
                <div className="text-4xl font-display font-bold text-green-500">
                  5%
                </div>
              </div>
            </div>

            <div className="p-8 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                    Listing Fee
                  </h3>
                  <p className="text-zinc-500 mt-1">
                    Free to list your project
                  </p>
                </div>
                <div className="text-4xl font-display font-bold text-green-500">
                  $0
                </div>
              </div>
            </div>

            <div className="p-8 bg-zinc-50 dark:bg-zinc-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                    Dispute Resolution Fee
                  </h3>
                  <p className="text-zinc-500 mt-1">
                    Only charged to the losing party if a dispute occurs
                  </p>
                </div>
                <div className="text-4xl font-display font-bold text-yellow-500">
                  2%
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 p-6 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-900 dark:text-blue-100">
                  Example: Selling a $100 SOL Project
                </h4>
                <p className="text-blue-700 dark:text-blue-300 mt-2">
                  Sale price: 100 SOL<br />
                  Platform fee (5%): 5 SOL<br />
                  <strong>You receive: 95 SOL</strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500">
        <div className="container-tight text-center">
          <h2 className="text-3xl md:text-4xl font-display font-semibold text-white mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-lg text-white/80 max-w-xl mx-auto mb-8">
            Join the marketplace where builders buy and sell digital products
            with confidence.
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
      </section>
    </div>
  );
}
