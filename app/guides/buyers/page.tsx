"use client";

import { ArrowRight, CheckCircle, Search, Shield, Star, Zap } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function BuyersGuidePage() {
  const t = useTranslations("guides.buyers");

  const stepIcons = [Search, Star, Zap, Shield, CheckCircle];

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
              {[1, 2, 3, 4, 5].map((idx) => {
                const Icon = stepIcons[idx - 1];
                return (
                  <div key={idx} className="flex gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                        <Icon className="w-6 h-6 text-green-600 dark:text-green-400" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                        {idx}. {t(`steps.step${idx}.title`)}
                      </h3>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">{t(`steps.step${idx}.description`)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Due Diligence */}
          <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">{t("dueDiligence")}</h2>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-zinc-700 dark:text-zinc-300 text-sm">{t(`checklist.item${idx}`)}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>{t("tip.label")}</strong> {t("tip.text")}
              </p>
            </div>
          </section>

          {/* Red Flags */}
          <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">{t("redFlags")}</h2>
            <div className="space-y-3">
              {[1, 2, 3, 4].map((idx) => (
                <div key={idx} className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-900 dark:text-red-100">
                    <strong>{t(`flags.flag${idx}.title`)}</strong> - {t(`flags.flag${idx}.description`)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Payment Options */}
          <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">{t("paymentOptions")}</h2>
            <div className="p-4 border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">{t("payment.crypto.title")}</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                {t("payment.crypto.description")}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">{t("payment.crypto.fee")}</p>
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
