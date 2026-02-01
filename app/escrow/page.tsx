"use client";

import { CheckCircle, Lock, Shield, UserCheck } from "lucide-react";
import { useTranslations } from "next-intl";

export default function EscrowPage() {
  const t = useTranslations("escrow");

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="container-wide py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <Shield className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              {t("title")}
            </h1>
            <p className="text-xl text-zinc-600 dark:text-zinc-400">
              {t("subtitle")}
            </p>
          </div>

          {/* How It Works */}
          <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">{t("howItWorks")}</h2>
            <div className="space-y-6">
              {[
                { key: "step1", icon: Lock },
                { key: "step2", icon: UserCheck },
                { key: "step3", icon: CheckCircle },
                { key: "step4", icon: Shield },
              ].map((item, idx) => (
                <div key={item.key} className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                      <item.icon className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-sm font-semibold text-green-600 dark:text-green-400">{t("stepLabel", { number: idx + 1 })}</span>
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{t(`${item.key}.title`)}</h3>
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{t(`${item.key}.description`)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Benefits */}
          <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">{t("benefits.title")}</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {[
                { key: "trustless", icon: Shield },
                { key: "transparent", icon: CheckCircle },
                { key: "noMiddleman", icon: UserCheck },
                { key: "instant", icon: Lock },
              ].map((benefit) => (
                <div key={benefit.key} className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                  <benefit.icon className="w-8 h-8 text-green-500 mb-3" />
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">{t(`benefits.${benefit.key}.title`)}</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{t(`benefits.${benefit.key}.description`)}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Protection */}
          <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">{t("protection.title")}</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">{t("protection.forBuyers")}</h3>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  {t("protection.buyer")}
                </p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">{t("protection.forSellers")}</h3>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  {t("protection.seller")}
                </p>
              </div>
            </div>
          </section>

          {/* Security Features */}
          <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">{t("security.title")}</h2>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((idx) => (
                <div key={idx} className="flex items-start gap-3 p-4 border-l-4 border-green-500 bg-green-50 dark:bg-green-900/20">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">{t(`security.feature${idx}.title`)}</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{t(`security.feature${idx}.description`)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* FAQ */}
          <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">{t("faq.title")}</h2>
            <div className="space-y-6">
              {[1, 2, 3, 4, 5].map((idx) => (
                <div key={idx}>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">{t(`faq.q${idx}`)}</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{t(`faq.a${idx}`)}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
