"use client";

import { useTranslations } from "next-intl";

export default function PrivacyPage() {
  const t = useTranslations("privacy");

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="container-wide py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">{t("title")}</h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-8">{t("lastUpdated")}: January 14, 2026</p>

          <div className="prose prose-zinc dark:prose-invert max-w-none">
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">1. Introduction</h2>
              <p className="text-zinc-700 dark:text-zinc-300">
                App Market (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to protecting your privacy. This Privacy Policy explains
                how we collect, use, disclose, and safeguard your information when you use our platform.
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">2. {t("sections.collection")}</h2>
              <div className="space-y-4 text-zinc-700 dark:text-zinc-300">
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Personal Information</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Email address</li>
                    <li>Name and display name</li>
                    <li>GitHub username and profile information</li>
                    <li>Wallet addresses (Solana, etc.)</li>
                    <li>Profile picture</li>
                    <li>Payment information (processed by Stripe)</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Usage Information</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Browser type and version</li>
                    <li>IP address and location data</li>
                    <li>Pages visited and actions taken</li>
                    <li>Transaction history</li>
                    <li>Device information</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Blockchain Data</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Wallet addresses</li>
                    <li>Transaction hashes</li>
                    <li>Smart contract interactions</li>
                    <li>On-chain activity (publicly visible)</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">3. {t("sections.use")}</h2>
              <div className="space-y-4 text-zinc-700 dark:text-zinc-300">
                <p>We use your information to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Provide and maintain our services</li>
                  <li>Process transactions and payments</li>
                  <li>Communicate with you about your account</li>
                  <li>Send notifications about bids, sales, and platform updates</li>
                  <li>Prevent fraud and ensure platform security</li>
                  <li>Comply with legal obligations</li>
                  <li>Improve and optimize our services</li>
                  <li>Analyze usage patterns and trends</li>
                </ul>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">4. {t("sections.sharing")}</h2>
              <div className="space-y-4 text-zinc-700 dark:text-zinc-300">
                <p>We may share your information with:</p>
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Service Providers</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Payment processors (Stripe)</li>
                    <li>Cloud hosting providers (Vercel, AWS)</li>
                    <li>Analytics services (Google Analytics)</li>
                    <li>Email service providers</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Other Users</h3>
                  <p>
                    Your public profile information (username, display name, profile picture, ratings) is visible to
                    other users. Transaction history related to your account may be visible to transaction parties.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Legal Requirements</h3>
                  <p>
                    We may disclose information if required by law, legal process, or government request, or to protect
                    our rights, users, or the public.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">5. Cookies and Tracking</h2>
              <div className="space-y-4 text-zinc-700 dark:text-zinc-300">
                <p>We use cookies and similar technologies to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Maintain your session and preferences</li>
                  <li>Analyze site traffic and usage</li>
                  <li>Personalize your experience</li>
                  <li>Prevent fraud and abuse</li>
                </ul>
                <p>You can control cookies through your browser settings, but some features may not function properly if disabled.</p>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">6. {t("sections.security")}</h2>
              <div className="space-y-4 text-zinc-700 dark:text-zinc-300">
                <p>We implement security measures including:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Encryption of data in transit and at rest</li>
                  <li>Secure authentication (OAuth, NextAuth)</li>
                  <li>Regular security audits</li>
                  <li>Access controls and monitoring</li>
                  <li>Blockchain-based escrow for transactions</li>
                </ul>
                <p>
                  However, no method of transmission over the internet is 100% secure. We cannot guarantee absolute security.
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">7. {t("sections.rights")}</h2>
              <div className="space-y-4 text-zinc-700 dark:text-zinc-300">
                <p>You have the right to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Access your personal information</li>
                  <li>Correct inaccurate information</li>
                  <li>Request deletion of your data (subject to legal requirements)</li>
                  <li>Export your data</li>
                  <li>Opt out of marketing communications</li>
                  <li>Object to certain processing of your data</li>
                </ul>
                <p>
                  To exercise these rights, contact us at{" "}
                  <a href="mailto:privacy@appmarket.xyz" className="text-green-600 dark:text-green-400 hover:underline">
                    privacy@appmarket.xyz
                  </a>
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">8. Data Retention</h2>
              <p className="text-zinc-700 dark:text-zinc-300">
                We retain your information for as long as your account is active or as needed to provide services. We
                may retain certain information after account closure for legal compliance, dispute resolution, and fraud
                prevention.
              </p>
              <p className="text-zinc-700 dark:text-zinc-300 mt-4">
                Note: Blockchain transactions are permanent and cannot be deleted.
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">9. Third-Party Services</h2>
              <div className="space-y-4 text-zinc-700 dark:text-zinc-300">
                <p>We integrate with third-party services:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>GitHub (authentication and code access)</li>
                  <li>Stripe (payment processing)</li>
                  <li>Solana blockchain (transactions)</li>
                  <li>Vercel Blob (file storage)</li>
                </ul>
                <p>
                  These services have their own privacy policies. We encourage you to review them.
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">10. Children&apos;s Privacy</h2>
              <p className="text-zinc-700 dark:text-zinc-300">
                Our services are not directed to individuals under 18. We do not knowingly collect information from
                children. If we learn we have collected information from a child, we will delete it promptly.
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">11. International Users</h2>
              <p className="text-zinc-700 dark:text-zinc-300">
                Your information may be transferred to and processed in countries other than your own. By using our
                services, you consent to the transfer of your information to the United States and other countries.
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">12. Changes to This Policy</h2>
              <p className="text-zinc-700 dark:text-zinc-300">
                We may update this Privacy Policy from time to time. We will notify you of significant changes by
                posting the new policy with an updated date and, when appropriate, via email.
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">13. {t("sections.contact")}</h2>
              <p className="text-zinc-700 dark:text-zinc-300">
                For questions about this Privacy Policy or our data practices, contact us at:{" "}
                <a href="mailto:privacy@appmarket.xyz" className="text-green-600 dark:text-green-400 hover:underline">
                  privacy@appmarket.xyz
                </a>
              </p>
              <div className="mt-4 text-zinc-700 dark:text-zinc-300">
                <p className="font-semibold">App Market, Inc.</p>
                <p className="text-sm">Data Protection Officer</p>
                <p className="text-sm">privacy@appmarket.xyz</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
