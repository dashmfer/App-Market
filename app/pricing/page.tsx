import { Check } from "lucide-react";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="container-wide py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              Simple, Transparent Pricing
            </h1>
            <p className="text-xl text-zinc-600 dark:text-zinc-400">
              No monthly fees. Only pay when you sell.
            </p>
          </div>

          {/* Main Pricing Card */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl border-2 border-green-200 dark:border-green-800 p-8 mb-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Platform Fee</h2>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-6xl font-bold text-green-600 dark:text-green-400">5%</span>
                <span className="text-2xl text-zinc-600 dark:text-zinc-400">per sale</span>
              </div>
              <p className="text-zinc-600 dark:text-zinc-400 mt-4">
                One of the lowest fees in the industry
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white dark:bg-zinc-900 rounded-xl p-6">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">What's Included</h3>
                <ul className="space-y-3">
                  {[
                    "Blockchain escrow protection",
                    "Smart contract security",
                    "Dispute resolution system",
                    "Transfer verification",
                    "Platform support",
                    "Analytics and insights",
                  ].map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white dark:bg-zinc-900 rounded-xl p-6">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Additional Costs</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">Stripe Processing</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">2.9% + $0.30</span>
                    </div>
                    <p className="text-xs text-zinc-500">Only for credit card payments</p>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">Blockchain Fee</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">~0.00001 SOL</span>
                    </div>
                    <p className="text-xs text-zinc-500">For on-chain transactions</p>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">Dispute Fee</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">2%</span>
                    </div>
                    <p className="text-xs text-zinc-500">Charged only to losing party in disputes</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl p-6">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Fee Examples</h3>
              <div className="space-y-4">
                {[
                  { sale: 1000, fee: 50, stripe: 29.3, net: 920.7 },
                  { sale: 5000, fee: 250, stripe: 145.3, net: 4604.7 },
                  { sale: 10000, fee: 500, stripe: 290.3, net: 9209.7 },
                  { sale: 50000, fee: 2500, stripe: 1450.3, net: 46049.7 },
                ].map((example, idx) => (
                  <div key={idx} className="flex items-center justify-between py-3 border-b border-zinc-200 dark:border-zinc-800 last:border-0">
                    <div>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        ${example.sale.toLocaleString()} Sale
                      </span>
                      <p className="text-xs text-zinc-500 mt-1">
                        Platform: ${example.fee} • Stripe: ${example.stripe}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-green-600 dark:text-green-400">
                        ${example.net.toLocaleString()}
                      </span>
                      <p className="text-xs text-zinc-500">You receive</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Comparison */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">How We Compare</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="text-left py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">Platform</th>
                    <th className="text-center py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">Fee</th>
                    <th className="text-center py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">Escrow</th>
                    <th className="text-center py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">Support</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-green-50 dark:bg-green-900/20">
                    <td className="py-4 px-4 font-semibold text-zinc-900 dark:text-zinc-100">App Market</td>
                    <td className="py-4 px-4 text-center text-green-600 dark:text-green-400 font-bold">5%</td>
                    <td className="py-4 px-4 text-center">
                      <Check className="w-5 h-5 text-green-500 mx-auto" />
                    </td>
                    <td className="py-4 px-4 text-center">
                      <Check className="w-5 h-5 text-green-500 mx-auto" />
                    </td>
                  </tr>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <td className="py-4 px-4 text-zinc-700 dark:text-zinc-300">Flippa</td>
                    <td className="py-4 px-4 text-center text-zinc-700 dark:text-zinc-300">10-15%</td>
                    <td className="py-4 px-4 text-center">
                      <Check className="w-5 h-5 text-zinc-400 mx-auto" />
                    </td>
                    <td className="py-4 px-4 text-center">
                      <Check className="w-5 h-5 text-zinc-400 mx-auto" />
                    </td>
                  </tr>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <td className="py-4 px-4 text-zinc-700 dark:text-zinc-300">Empire Flippers</td>
                    <td className="py-4 px-4 text-center text-zinc-700 dark:text-zinc-300">15%</td>
                    <td className="py-4 px-4 text-center">
                      <Check className="w-5 h-5 text-zinc-400 mx-auto" />
                    </td>
                    <td className="py-4 px-4 text-center">
                      <Check className="w-5 h-5 text-zinc-400 mx-auto" />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-4 px-4 text-zinc-700 dark:text-zinc-300">MicroAcquire</td>
                    <td className="py-4 px-4 text-center text-zinc-700 dark:text-zinc-300">Free*</td>
                    <td className="py-4 px-4 text-center text-zinc-500">-</td>
                    <td className="py-4 px-4 text-center text-zinc-500">Limited</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-zinc-500 mt-4">
              *MicroAcquire charges $6k+ for "listing support" on larger deals
            </p>
          </div>

          {/* FAQ */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">Frequently Asked Questions</h2>
            <div className="space-y-6">
              {[
                {
                  q: "When do I pay the fee?",
                  a: "The platform fee is deducted automatically from the sale proceeds before funds are released to you. You never pay anything upfront.",
                },
                {
                  q: "Are there any listing fees?",
                  a: "No. It's completely free to list your project. You only pay when you successfully sell.",
                },
                {
                  q: "What if my project doesn't sell?",
                  a: "You pay nothing. There are no listing fees, monthly fees, or hidden costs. You only pay the 5% fee when you make a sale.",
                },
                {
                  q: "Can I use crypto to avoid Stripe fees?",
                  a: "Yes! When buyers pay with SOL or USDC directly, you avoid Stripe's 2.9% + $0.30 fee and only pay our 5% platform fee plus minimal blockchain fees.",
                },
                {
                  q: "What happens if there's a dispute?",
                  a: "If a dispute is opened and resolved against you, an additional 2% fee applies. This incentivizes honest, complete transfers.",
                },
              ].map((faq, idx) => (
                <div key={idx}>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">{faq.q}</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
