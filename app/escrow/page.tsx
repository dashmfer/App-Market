import { CheckCircle, Lock, Shield, UserCheck } from "lucide-react";

export default function EscrowPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="container-wide py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <Shield className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              Blockchain Escrow Protection
            </h1>
            <p className="text-xl text-zinc-600 dark:text-zinc-400">
              Your funds are safe with smart contract-powered escrow
            </p>
          </div>

          {/* How It Works */}
          <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">How Escrow Works</h2>
            <div className="space-y-6">
              {[
                {
                  step: 1,
                  title: "Buyer Pays",
                  description: "When a buyer purchases or wins an auction, their payment is immediately locked in a blockchain escrow account.",
                  icon: Lock,
                },
                {
                  step: 2,
                  title: "Seller Transfers Assets",
                  description: "The seller transfers all project assets (GitHub repo, domain, credentials, etc.) to the buyer.",
                  icon: UserCheck,
                },
                {
                  step: 3,
                  title: "Buyer Confirms",
                  description: "The buyer reviews and confirms they've received everything as described.",
                  icon: CheckCircle,
                },
                {
                  step: 4,
                  title: "Funds Released",
                  description: "Once confirmed, the smart contract automatically releases funds to the seller.",
                  icon: Shield,
                },
              ].map((item) => (
                <div key={item.step} className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                      <item.icon className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-sm font-semibold text-green-600 dark:text-green-400">Step {item.step}</span>
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</h3>
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{item.description}</p>
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

          {/* Security Features */}
          <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">Security Features</h2>
            <div className="space-y-4">
              {[
                {
                  title: "Audited Smart Contracts",
                  description: "Our escrow contracts have been professionally audited for security vulnerabilities.",
                },
                {
                  title: "Multi-Signature Controls",
                  description: "Critical operations require multiple signatures to prevent unauthorized access.",
                },
                {
                  title: "Time-Locked Releases",
                  description: "Automatic refund if seller doesn't deliver within the agreed timeframe.",
                },
                {
                  title: "Dispute Resolution",
                  description: "Built-in mechanism for handling conflicts with evidence-based arbitration.",
                },
                {
                  title: "Immutable Records",
                  description: "All escrow transactions are permanently recorded on Solana blockchain.",
                },
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

          {/* For Buyers */}
          <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">For Buyers</h2>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Your Protection</h3>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  Your payment is locked in escrow until you confirm receipt of all promised assets. If the seller
                  doesn't deliver, you can open a dispute and potentially receive a full refund.
                </p>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Transfer Timeline</h3>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  Sellers typically have 7-14 days to complete the transfer. If they don't deliver within this
                  timeframe, you can request a refund or open a dispute.
                </p>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Verification Process</h3>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  Review all assets carefully before confirming. Check GitHub access, test credentials, verify domain
                  ownership, and ensure everything matches the listing description.
                </p>
              </div>
            </div>
          </section>

          {/* For Sellers */}
          <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">For Sellers</h2>
            <div className="space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Your Protection</h3>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  Once you transfer all assets and the buyer confirms, funds are immediately released. The buyer can't
                  falsely claim non-delivery if you've properly documented the transfer.
                </p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Documentation Matters</h3>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  Document everything you transfer. Take screenshots, save email confirmations, and use the platform's
                  built-in transfer tracking system to protect yourself in case of disputes.
                </p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Quick Transfers</h3>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  The faster you complete the transfer, the sooner you receive payment. Prepare all access credentials
                  before the sale to ensure a smooth handoff.
                </p>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">Common Questions</h2>
            <div className="space-y-6">
              {[
                {
                  q: "What if the seller never delivers?",
                  a: "If the seller doesn't deliver within the agreed timeframe, you can request a refund. If there's a dispute, our team reviews the evidence and makes a fair decision.",
                },
                {
                  q: "Can the seller access my payment before I confirm?",
                  a: "No. Funds remain locked in the smart contract escrow until you explicitly confirm receipt or the dispute period expires.",
                },
                {
                  q: "What happens if there's a disagreement?",
                  a: "Either party can open a dispute. Both sides submit evidence, and our team makes a determination based on the facts. The losing party pays a 2% dispute fee.",
                },
                {
                  q: "How long does escrow last?",
                  a: "Typically 7-14 days for the transfer. Once you confirm, funds are released immediately. If there's no confirmation, there's an automatic review period.",
                },
                {
                  q: "Are blockchain escrow smart contracts safe?",
                  a: "Yes. Our contracts have been audited and battle-tested. All code is open source and verifiable on-chain.",
                },
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
