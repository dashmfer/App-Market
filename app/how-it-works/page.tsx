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
import { useTranslations } from "next-intl";

export default function HowItWorksPage() {
  const t = useTranslations("howItWorks");

  const sellerSteps = [
    { icon: Github, key: "step1" },
    { icon: Upload, key: "step2" },
    { icon: Gavel, key: "step3" },
    { icon: Lock, key: "step4" },
    { icon: FileCheck, key: "step5" },
    { icon: Coins, key: "step6" },
  ];

  const buyerSteps = [
    { icon: Users, key: "step1" },
    { icon: CheckCircle2, key: "step2" },
    { icon: Gavel, key: "step3" },
    { icon: Lock, key: "step4" },
    { icon: RefreshCw, key: "step5" },
    { icon: Shield, key: "step6" },
  ];

  const features = [
    { icon: Shield, key: "escrow" },
    { icon: CreditCard, key: "payment" },
    { icon: Github, key: "verified" },
    { icon: Scale, key: "disputes" },
  ];

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
              {t("title")}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-6 text-xl text-zinc-600 dark:text-zinc-400"
            >
              {t("subtitle")}
            </motion.p>
          </div>
        </div>
      </section>

      {/* For Sellers */}
      <section className="py-20 bg-zinc-50 dark:bg-zinc-950">
        <div className="container-wide">
          <div className="text-center mb-16">
            <span className="badge-green mb-4">{t("forSellers.badge")}</span>
            <h2 className="text-3xl md:text-4xl font-display font-semibold text-zinc-900 dark:text-zinc-100">
              {t("forSellers.title")}
            </h2>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
              {t("forSellers.subtitle")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {sellerSteps.map((step, index) => (
              <motion.div
                key={step.key}
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
                    {t(`forSellers.${step.key}.title`)}
                  </h3>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    {t(`forSellers.${step.key}.description`)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link href="/create" className="btn-success text-lg px-8 py-4">
              {t("forSellers.cta")}
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* For Buyers */}
      <section className="py-20">
        <div className="container-wide">
          <div className="text-center mb-16">
            <span className="badge-green mb-4">{t("forBuyers.badge")}</span>
            <h2 className="text-3xl md:text-4xl font-display font-semibold text-zinc-900 dark:text-zinc-100">
              {t("forBuyers.title")}
            </h2>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
              {t("forBuyers.subtitle")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {buyerSteps.map((step, index) => (
              <motion.div
                key={step.key}
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
                    {t(`forBuyers.${step.key}.title`)}
                  </h3>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    {t(`forBuyers.${step.key}.description`)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link href="/explore" className="btn-primary text-lg px-8 py-4">
              {t("forBuyers.cta")}
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
              {t("features.title")}
            </h2>
            <p className="mt-4 text-zinc-400 max-w-2xl mx-auto">
              {t("features.subtitle")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.key}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-8 rounded-2xl bg-zinc-900 border border-zinc-800"
              >
                <div className="w-14 h-14 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400 mb-6">
                  <feature.icon className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-semibold mb-3">
                  {t(`features.${feature.key}.title`)}
                </h3>
                <p className="text-zinc-400">
                  {t(`features.${feature.key}.description`)}
                </p>
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
              {t("fees.title")}
            </h2>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">
              {t("fees.subtitle")}
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="p-8 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                    {t("fees.platformFee")}
                  </h3>
                  <p className="text-zinc-500 mt-1">
                    {t("fees.deducted")}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-display font-bold text-green-500">
                    3-5%
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    {t("fees.discount")}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-8 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                    {t("fees.listingFee")}
                  </h3>
                  <p className="text-zinc-500 mt-1">
                    {t("fees.freeToList")}
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
                    {t("fees.disputeFee")}
                  </h3>
                  <p className="text-zinc-500 mt-1">
                    {t("fees.losingParty")}
                  </p>
                </div>
                <div className="text-4xl font-display font-bold text-yellow-500">
                  2%
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 grid md:grid-cols-2 gap-4">
            <div className="p-6 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-4">
                <AlertTriangle className="w-6 h-6 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100">
                    {t("fees.example")}: 100 SOL
                  </h4>
                  <p className="text-blue-700 dark:text-blue-300 mt-2">
                    Sale price: 100 SOL<br />
                    Platform fee (5%): 5 SOL<br />
                    <strong>You receive: 95 SOL</strong>
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <div className="flex items-start gap-4">
                <AlertTriangle className="w-6 h-6 text-green-600 dark:text-green-400 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-green-900 dark:text-green-100">
                    {t("fees.example")}: 100 $APP
                  </h4>
                  <p className="text-green-700 dark:text-green-300 mt-2">
                    Sale price: 100 $APP<br />
                    Platform fee (3%): 3 $APP<br />
                    <strong>You receive: 97 $APP</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500">
        <div className="container-tight text-center">
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
      </section>
    </div>
  );
}
