import Link from "next/link";
import { Twitter } from "lucide-react";

const footerLinks = {
  marketplace: [
    { label: "Explore", href: "/explore" },
    { label: "Categories", href: "/categories" },
    { label: "Featured", href: "/featured" },
    { label: "Recent Sales", href: "/recent-sales" },
  ],
  sellers: [
    { label: "List Your Project", href: "/create" },
    { label: "Seller Guide", href: "/guides/sellers" },
    { label: "Pricing", href: "/pricing" },
  ],
  buyers: [
    { label: "How to Buy", href: "/guides/buyers" },
    { label: "Due Diligence", href: "/guides/due-diligence" },
    { label: "Escrow Protection", href: "/escrow" },
  ],
  company: [
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
  ],
  legal: [
    { label: "Terms of Service", href: "/terms" },
    { label: "Privacy Policy", href: "/privacy" },
  ],
};

export function Footer() {
  return (
    <footer className="bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800">
      <div className="container-wide py-16 md:py-20">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 md:gap-12">
          {/* Brand */}
          <div className="col-span-2">
            <Link
              href="/"
              className="flex items-center gap-2 font-display text-xl font-semibold"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <span className="text-white text-sm font-bold">A</span>
              </div>
              <span>App Market</span>
            </Link>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed max-w-xs">
              The premier marketplace for buying and selling digital products,
              prototypes, and MVPs. Secure, trustless, and built on Solana.
            </p>
            <div className="flex items-center gap-4 mt-6">
              <a
                href="https://twitter.com/appmarketxyz"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 rounded-full text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
              >
                <Twitter className="w-5 h-5" />
                <span className="text-sm">@appmarketxyz</span>
              </a>
            </div>
          </div>

          {/* Marketplace */}
          <div>
            <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Marketplace
            </h4>
            <ul className="space-y-3">
              {footerLinks.marketplace.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Sellers */}
          <div>
            <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Sellers
            </h4>
            <ul className="space-y-3">
              {footerLinks.sellers.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Buyers */}
          <div>
            <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Buyers
            </h4>
            <ul className="space-y-3">
              {footerLinks.buyers.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Company
            </h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-16 pt-8 border-t border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-zinc-500">
            © {new Date().getFullYear()} App Market. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            {footerLinks.legal.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
