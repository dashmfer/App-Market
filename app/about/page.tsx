import { Code, Globe, Shield, Zap } from "lucide-react";
import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="container-wide py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              About App Market
            </h1>
            <p className="text-xl text-zinc-600 dark:text-zinc-400">
              The premier marketplace for buying and selling digital projects
            </p>
          </div>

          {/* Mission */}
          <section className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800 p-8 mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">Our Mission</h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
              We're building the future of digital asset transactions. App Market makes it safe, fast, and affordable
              to buy and sell web applications, mobile apps, SaaS products, and digital prototypes.
            </p>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              By leveraging blockchain technology and smart contracts, we've eliminated the traditional barriers and
              risks of digital acquisitions. No more lengthy negotiations with brokers, no more trust issues with
              escrow services - just secure, peer-to-peer transactions.
            </p>
          </section>

          {/* Values */}
          <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">What Sets Us Apart</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {[
                {
                  icon: Shield,
                  title: "Security First",
                  description:
                    "Built on Solana blockchain with audited smart contracts. Your funds and assets are always protected.",
                },
                {
                  icon: Zap,
                  title: "Lightning Fast",
                  description:
                    "No waiting weeks for bank transfers. Escrow releases happen instantly on-chain when conditions are met.",
                },
                {
                  icon: Code,
                  title: "Developer Focused",
                  description:
                    "Made by developers, for developers. We understand what matters: clean code, good docs, and honest metrics.",
                },
                {
                  icon: Globe,
                  title: "Global Access",
                  description:
                    "Accept payments in SOL, USDC, or fiat. Sell to anyone, anywhere, without geographical restrictions.",
                },
              ].map((value, idx) => (
                <div key={idx} className="p-6 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                  <value.icon className="w-10 h-10 text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">{value.title}</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{value.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Story */}
          <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">Our Story</h2>
            <div className="space-y-4 text-zinc-700 dark:text-zinc-300">
              <p>
                App Market was born from frustration with existing marketplaces. As serial builders and indie hackers,
                we've bought and sold dozens of projects over the years. Every transaction involved:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Excessive fees (10-15% to platforms)</li>
                <li>Slow, manual escrow processes</li>
                <li>Limited buyer/seller protection</li>
                <li>Geographic restrictions on payments</li>
                <li>Weeks of waiting for fund transfers</li>
              </ul>
              <p>
                We knew blockchain could solve these problems. After months of development and security audits, we
                launched App Market - the first truly decentralized marketplace for digital products.
              </p>
              <p>
                Today, we're proud to serve thousands of developers, entrepreneurs, and investors who trust our
                platform for their acquisitions.
              </p>
            </div>
          </section>

          {/* Stats */}
          <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 text-center">By The Numbers</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { value: "$2M+", label: "Total Volume" },
                { value: "500+", label: "Projects Sold" },
                { value: "2,000+", label: "Active Users" },
                { value: "5%", label: "Platform Fee" },
              ].map((stat, idx) => (
                <div key={idx} className="text-center">
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">{stat.value}</div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">{stat.label}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Team */}
          <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">The Team</h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
              We're a small, remote team of engineers and product builders passionate about enabling entrepreneurship
              and innovation. Our backgrounds span web3, fintech, marketplace businesses, and developer tools.
            </p>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              We believe in building in public, shipping fast, and listening to our community. All of our smart
              contracts are open source and audited. We're committed to transparency and putting users first.
            </p>
          </section>

          {/* Values */}
          <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">Our Principles</h2>
            <div className="space-y-4">
              {[
                {
                  title: "Fair & Transparent",
                  description: "Simple, honest pricing. No hidden fees, no surprises.",
                },
                {
                  title: "Security-Obsessed",
                  description: "Multiple security audits, rigorous testing, and ongoing monitoring.",
                },
                {
                  title: "Community-Driven",
                  description: "We build features based on your feedback and suggestions.",
                },
                {
                  title: "Long-Term Thinking",
                  description: "Sustainable business model aligned with user success.",
                },
              ].map((principle, idx) => (
                <div key={idx} className="border-l-4 border-green-500 pl-4">
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">{principle.title}</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{principle.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="text-center bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800 p-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-3">Join Our Community</h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              Whether you're buying your first project or selling your latest creation, we're here to help.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/explore" className="btn-primary">
                Explore Marketplace
              </Link>
              <Link href="/contact" className="btn-secondary">
                Get in Touch
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
