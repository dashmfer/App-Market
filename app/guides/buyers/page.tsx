"use client";

import { ArrowRight, CheckCircle, Search, Shield, Star, Zap } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function BuyersGuidePage() {
  const t = useTranslations("guides.buyers");

  const howToBuySteps = [
    { title: "Browse & Search", description: "Explore listings by category, tech stack, or metrics. Use filters to find exactly what you need.", icon: Search },
    { title: "Evaluate the Project", description: "Review screenshots, code quality, metrics, and seller ratings. Ask questions if needed.", icon: Star },
    { title: "Place a Bid or Buy Now", description: "For auctions, place competitive bids. For fixed-price listings, click Buy Now to proceed.", icon: Zap },
    { title: "Secure Payment & Escrow", description: "Funds are held in blockchain escrow until you confirm receipt of all project assets.", icon: Shield },
    { title: "Receive Assets & Confirm", description: "Seller transfers GitHub repo, credentials, domain, etc. Verify and release escrow.", icon: CheckCircle },
  ];

  const dueDiligenceItems = [
    "Verify GitHub repo exists and code matches the description",
    "Check commit history for recent activity and quality",
    "Review tech stack compatibility with your needs",
    "Validate claimed metrics (users, revenue) if possible",
    "Research seller's reputation and past sales",
    "Test the demo/live version thoroughly",
    "Read through documentation quality",
    "Confirm all promised assets are listed",
    "Check for any outstanding issues or bugs",
    "Verify domain ownership if included",
  ];

  const redFlags = [
    { title: "Vague descriptions", description: "Lack of detail about features, tech stack, or metrics" },
    { title: "No demo or screenshots", description: "Unwillingness to show the actual product" },
    { title: "Unverified metrics", description: "Claims that can't be verified or seem too good to be true" },
    { title: "Poor code quality", description: "Messy, undocumented, or outdated code" },
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

          {/* Benefits */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
              <Shield className="w-8 h-8 text-green-500 mb-3" />
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">{t("benefits.escrow")}</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("benefits.escrowDesc")}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
              <CheckCircle className="w-8 h-8 text-blue-500 mb-3" />
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">{t("benefits.verified")}</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("benefits.verifiedDesc")}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
              <Star className="w-8 h-8 text-purple-500 mb-3" />
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">{t("benefits.quality")}</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("benefits.qualityDesc")}</p>
            </div>
          </div>

          {/* How to Buy */}
          <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">{t("howToBuy")}</h2>
            <div className="space-y-4">
              {howToBuySteps.map((step, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                      <step.icon className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                      {idx + 1}. {step.title}
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Due Diligence */}
          <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">{t("dueDiligence")}</h2>
            <div className="space-y-3">
              {dueDiligenceItems.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-zinc-700 dark:text-zinc-300 text-sm">{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Tip:</strong> Don&apos;t rush! Take time to evaluate thoroughly. Ask the seller questions before committing.
              </p>
            </div>
          </section>

          {/* Red Flags */}
          <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">{t("redFlags")}</h2>
            <div className="space-y-3">
              {redFlags.map((flag, idx) => (
                <div key={idx} className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-900 dark:text-red-100">
                    <strong>{flag.title}</strong> - {flag.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Payment Options */}
          <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">{t("paymentOptions")}</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Credit Card (Stripe)</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                  Pay with any major credit card. Funds held in escrow until transfer complete.
                </p>
                <p className="text-xs text-zinc-500">Fee: 2.9% + $0.30</p>
              </div>
              <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Solana (SOL/USDC)</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                  Pay directly with crypto. Lowest fees and fastest settlement.
                </p>
                <p className="text-xs text-zinc-500">Fee: ~0.00001 SOL</p>
              </div>
            </div>
          </section>

          {/* CTA */}
          <div className="text-center bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800 p-8">
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-3">{t("cta.title")}</h3>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              {t("cta.subtitle")}
            </p>
            <Link href="/explore" className="btn-primary inline-flex items-center gap-2">
              {t("cta.button")}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
