"use client";

import { ArrowRight, CheckCircle, DollarSign, Shield, Users } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function SellersGuidePage() {
  const t = useTranslations("guides.sellers");

  const gettingStartedSteps = [
    { title: "Create Your Account", description: "Sign up with GitHub to verify your identity and build trust with buyers." },
    { title: "Prepare Your Project", description: "Gather all assets: code, documentation, credentials, and access tokens." },
    { title: "Create a Listing", description: "Provide detailed information about your project, including tech stack and metrics." },
    { title: "Set Your Price", description: "Choose between auction or fixed price, set starting/reserve prices." },
    { title: "Publish & Promote", description: "Once live, share your listing and respond to buyer inquiries promptly." },
  ];

  const whatToInclude = [
    "Complete source code (GitHub repo)",
    "Documentation and setup guides",
    "Domain name (if applicable)",
    "Database credentials",
    "API keys and credentials",
    "Design files (Figma, Sketch, etc.)",
    "Social media accounts",
    "Analytics and metrics data",
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="container-wide py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              {t("title")}
            </h1>
            <p className="text-xl text-zinc-600 dark:text-zinc-400">
              {t("subtitle")}
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
              <DollarSign className="w-8 h-8 text-green-500 mb-3" />
              <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-1">{t("stats.fee")}</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("stats.feeDesc")}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
              <Shield className="w-8 h-8 text-blue-500 mb-3" />
              <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-1">{t("stats.escrow")}</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("stats.escrowDesc")}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
              <Users className="w-8 h-8 text-purple-500 mb-3" />
              <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-1">{t("stats.global")}</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("stats.globalDesc")}</p>
            </div>
          </div>

          {/* Main Content */}
          <div className="space-y-12">
            {/* Getting Started */}
            <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">{t("gettingStarted")}</h2>
              <div className="space-y-4">
                {gettingStartedSteps.map((step, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 flex items-center justify-center font-semibold">
                      {idx + 1}
                    </div>
                    <div>
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">{step.title}</h3>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* What to Include */}
            <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">{t("whatToInclude")}</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {whatToInclude.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-zinc-700 dark:text-zinc-300">{item}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Best Practices */}
            <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">{t("bestPractices")}</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Use Quality Screenshots</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Include clear, high-resolution images showing your project&apos;s key features and UI.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Be Transparent with Metrics</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Provide accurate data about users, revenue, and growth. Honesty builds trust.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Respond Quickly</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Answer buyer questions promptly to increase confidence and close deals faster.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Prepare for Transfer</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Have all access credentials ready before listing to ensure smooth handoff.
                  </p>
                </div>
              </div>
            </section>

            {/* Fee Structure */}
            <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">{t("feeStructure")}</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-3 border-b border-zinc-200 dark:border-zinc-800">
                  <div>
                    <span className="text-zinc-700 dark:text-zinc-300">Platform Fee ($APP)</span>
                    <p className="text-xs text-green-600 dark:text-green-400">Discounted rate</p>
                  </div>
                  <span className="font-semibold text-green-600 dark:text-green-400">3%</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-zinc-200 dark:border-zinc-800">
                  <span className="text-zinc-700 dark:text-zinc-300">Platform Fee (SOL/USDC)</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">5%</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-zinc-200 dark:border-zinc-800">
                  <span className="text-zinc-700 dark:text-zinc-300">Payment Processing (Stripe)</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">2.9% + $0.30</span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-zinc-700 dark:text-zinc-300">Blockchain Fee (Solana)</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">~0.00001 SOL</span>
                </div>
              </div>
            </section>

            {/* CTA */}
            <div className="text-center bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800 p-8">
              <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-3">{t("cta.title")}</h3>
              <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                {t("cta.subtitle")}
              </p>
              <Link href="/create" className="btn-primary inline-flex items-center gap-2">
                {t("cta.button")}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
