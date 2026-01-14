export default function TermsPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="container-wide py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">Terms of Service</h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-8">Last updated: January 14, 2026</p>

          <div className="prose prose-zinc dark:prose-invert max-w-none">
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">1. Acceptance of Terms</h2>
              <p className="text-zinc-700 dark:text-zinc-300 mb-4">
                By accessing and using App Market ("the Platform"), you accept and agree to be bound by these Terms of
                Service. If you do not agree to these terms, please do not use our services.
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">2. Eligibility</h2>
              <p className="text-zinc-700 dark:text-zinc-300 mb-4">
                You must be at least 18 years old and capable of forming a binding contract to use App Market. By using
                the Platform, you represent and warrant that you meet these requirements.
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">3. User Accounts</h2>
              <div className="space-y-4 text-zinc-700 dark:text-zinc-300">
                <p>You are responsible for:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Maintaining the security of your account credentials</li>
                  <li>All activities that occur under your account</li>
                  <li>Providing accurate and complete information</li>
                  <li>Updating your information to keep it current</li>
                </ul>
                <p>
                  We reserve the right to suspend or terminate accounts that violate these terms or engage in fraudulent
                  activity.
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">4. Listing Requirements</h2>
              <div className="space-y-4 text-zinc-700 dark:text-zinc-300">
                <p>Sellers must:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Provide accurate descriptions of projects and assets</li>
                  <li>Have legal ownership of all listed assets</li>
                  <li>Not list stolen, copied, or infringing content</li>
                  <li>Transfer all promised assets within agreed timelines</li>
                  <li>Not engage in price manipulation or false advertising</li>
                </ul>
                <p>
                  Violations may result in listing removal, account suspension, and potential legal action.
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">5. Fees and Payments</h2>
              <div className="space-y-4 text-zinc-700 dark:text-zinc-300">
                <p>Platform fees:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>5% platform fee on all successful sales</li>
                  <li>Additional payment processing fees may apply (Stripe, blockchain)</li>
                  <li>2% dispute resolution fee for losing party in disputes</li>
                </ul>
                <p>
                  All fees are clearly disclosed before transactions. Fees are non-refundable except as required by law.
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">6. Escrow and Transactions</h2>
              <div className="space-y-4 text-zinc-700 dark:text-zinc-300">
                <p>
                  All transactions use blockchain-based smart contract escrow. Funds are held until the buyer confirms
                  receipt of assets or the dispute period expires.
                </p>
                <p>
                  By using our escrow service, you agree to the terms of the smart contract. Blockchain transactions are
                  final and irreversible once executed.
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">7. Disputes</h2>
              <div className="space-y-4 text-zinc-700 dark:text-zinc-300">
                <p>
                  If disputes arise, either party may open a dispute through the Platform. Both parties must provide
                  evidence supporting their claim.
                </p>
                <p>
                  Our team will review evidence and make a determination. The decision is final and binding. The losing
                  party pays a 2% dispute fee.
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">8. Intellectual Property</h2>
              <div className="space-y-4 text-zinc-700 dark:text-zinc-300">
                <p>
                  Sellers warrant they have the right to sell all listed assets. Buyers receive all intellectual
                  property rights as specified in the listing.
                </p>
                <p>
                  App Market's branding, design, and software are protected by copyright and trademark laws.
                  Unauthorized use is prohibited.
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">9. Prohibited Activities</h2>
              <div className="space-y-4 text-zinc-700 dark:text-zinc-300">
                <p>Users may not:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Engage in fraudulent activities or misrepresentation</li>
                  <li>Violate intellectual property rights</li>
                  <li>Manipulate prices or engage in wash trading</li>
                  <li>Harass, threaten, or abuse other users</li>
                  <li>Attempt to circumvent escrow or fees</li>
                  <li>Use automated tools to scrape or manipulate the Platform</li>
                  <li>List illegal content or stolen property</li>
                </ul>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">10. Disclaimers</h2>
              <div className="space-y-4 text-zinc-700 dark:text-zinc-300">
                <p>
                  THE PLATFORM IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. We do not guarantee:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>The accuracy of listings or user-provided information</li>
                  <li>The quality or legality of listed projects</li>
                  <li>Uninterrupted or error-free service</li>
                  <li>The security of blockchain networks or smart contracts</li>
                </ul>
                <p>
                  Users conduct their own due diligence before purchasing. We are a marketplace platform, not a party to
                  individual transactions.
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">11. Limitation of Liability</h2>
              <div className="space-y-4 text-zinc-700 dark:text-zinc-300">
                <p>
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, App Market shall not be liable for any indirect, incidental,
                  special, or consequential damages arising from your use of the Platform.
                </p>
                <p>
                  Our total liability for any claim shall not exceed the fees paid to us in the twelve months preceding
                  the claim.
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">12. Modifications</h2>
              <p className="text-zinc-700 dark:text-zinc-300">
                We reserve the right to modify these Terms at any time. Changes will be posted with an updated "Last
                Updated" date. Continued use of the Platform constitutes acceptance of modified terms.
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">13. Termination</h2>
              <p className="text-zinc-700 dark:text-zinc-300">
                We may suspend or terminate your account at any time for violations of these Terms or for any other
                reason. Upon termination, your right to use the Platform immediately ceases.
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">14. Governing Law</h2>
              <p className="text-zinc-700 dark:text-zinc-300">
                These Terms shall be governed by and construed in accordance with the laws of the United States. Any
                disputes shall be resolved in the courts of competent jurisdiction.
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">15. Contact</h2>
              <p className="text-zinc-700 dark:text-zinc-300">
                For questions about these Terms, contact us at:{" "}
                <a href="mailto:legal@appmarket.xyz" className="text-green-600 dark:text-green-400 hover:underline">
                  legal@appmarket.xyz
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
