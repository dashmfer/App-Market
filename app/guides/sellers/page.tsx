"use client";

import { ArrowRight, CheckCircle, DollarSign, Shield, Users } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function SellersGuidePage() {
  const t = useTranslations("guides.sellers");

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
                {[1, 2, 3, 4, 5].map((idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 flex items-center justify-center font-semibold">
                      {idx}
                    </div>
                    <div>
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">{t(`steps.step${idx}.title`)}</h3>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">{t(`steps.step${idx}.description`)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* What to Include */}
            <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">{t("whatToInclude")}</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-zinc-700 dark:text-zinc-300">{t(`includes.item${idx}`)}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Best Practices */}
            <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">{t("bestPractices")}</h2>
              <div className="space-y-4">
                {[1, 2, 3, 4].map((idx) => (
                  <div key={idx}>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">{t(`practices.practice${idx}.title`)}</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {t(`practices.practice${idx}.description`)}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Fee Structure */}
            <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">{t("feeStructure")}</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-3 border-b border-zinc-200 dark:border-zinc-800">
                  <div>
                    <span className="text-zinc-700 dark:text-zinc-300">{t("fees.appFee.label")}</span>
                    <p className="text-xs text-green-600 dark:text-green-400">{t("fees.appFee.note")}</p>
                  </div>
                  <span className="font-semibold text-green-600 dark:text-green-400">3%</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-zinc-200 dark:border-zinc-800">
                  <span className="text-zinc-700 dark:text-zinc-300">{t("fees.solFee.label")}</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">5%</span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-zinc-700 dark:text-zinc-300">{t("fees.blockchainFee.label")}</span>
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
