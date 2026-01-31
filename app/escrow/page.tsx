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
                      <span className="text-sm font-semibold text-green-600 dark:text-green-400">Step {idx + 1}</span>
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
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">Why Blockchain Escrow?</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {[
                {
                  title: "Trustless Transactions",
                  description: "Smart contracts execute automatically without requiring trust between parties.",
                  icon: Shield,
                },
                {
                  title: "Transparent & Auditable",
                  description: "All transactions are recorded on-chain and can be verified by anyone.",
                  icon: CheckCircle,
                },
                {
                  title: "No Middleman",
                  description: "Funds go directly from buyer to seller without intermediaries holding your money.",
                  icon: UserCheck,
                },
                {
                  title: "Instant Settlement",
                  description: "Once confirmed, funds are released immediately - no waiting for bank transfers.",
                  icon: Lock,
                },
              ].map((benefit, idx) => (
                <div key={idx} className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                  <benefit.icon className="w-8 h-8 text-green-500 mb-3" />
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">{benefit.title}</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{benefit.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Protection */}
          <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">{t("protection.title")}</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">For Buyers</h3>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  {t("protection.buyer")}
                </p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">For Sellers</h3>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  {t("protection.seller")}
                </p>
              </div>
            </div>
          </section>

          {/* Security Features */}
          <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">Security Features</h2>
            <div className="space-y-4">
              {[
                { title: "Audited Smart Contracts", description: "Our escrow contracts have been professionally audited for security vulnerabilities." },
                { title: "Multi-Signature Controls", description: "Critical operations require multiple signatures to prevent unauthorized access." },
                { title: "Time-Locked Releases", description: "Automatic refund if seller doesn't deliver within the agreed timeframe." },
                { title: "Dispute Resolution", description: "Built-in mechanism for handling conflicts with evidence-based arbitration." },
                { title: "Immutable Records", description: "All escrow transactions are permanently recorded on Solana blockchain." },
              ].map((feature, idx) => (
                <div key={idx} className="flex items-start gap-3 p-4 border-l-4 border-green-500 bg-green-50 dark:bg-green-900/20">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">{feature.title}</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* FAQ */}
          <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">Common Questions</h2>
            <div className="space-y-6">
              {[
                { q: "What if the seller never delivers?", a: "If the seller doesn't deliver within the agreed timeframe, you can request a refund. If there's a dispute, our team reviews the evidence and makes a fair decision." },
                { q: "Can the seller access my payment before I confirm?", a: "No. Funds remain locked in the smart contract escrow until you explicitly confirm receipt or the dispute period expires." },
                { q: "What happens if there's a disagreement?", a: "Either party can open a dispute. Both sides submit evidence, and our team makes a determination based on the facts. The losing party pays a 2% dispute fee." },
                { q: "How long does escrow last?", a: "Typically 7-14 days for the transfer. Once you confirm, funds are released immediately. If there's no confirmation, there's an automatic review period." },
                { q: "Are blockchain escrow smart contracts safe?", a: "Yes. Our contracts have been audited and battle-tested. All code is open source and verifiable on-chain." },
              ].map((faq, idx) => (
                <div key={idx}>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">{faq.q}</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{faq.a}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
