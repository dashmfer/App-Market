import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Toaster } from "@/components/ui/toaster";
import { ScrollToTop } from "@/components/scroll-to-top";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "App Market",
  description: "The marketplace for apps, prototypes, and MVPs. Secure on-chain auctions and transfers.",
  keywords: ["marketplace", "apps", "MVP", "prototype", "Solana", "crypto", "SaaS"],
  authors: [{ name: "App Market" }],
  openGraph: {
    title: "App Market",
    description: "The marketplace for apps, prototypes, and MVPs. Secure on-chain auctions and transfers.",
    url: "https://app.market",
    siteName: "App Market",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "App Market",
    description: "The marketplace for apps, prototypes, and MVPs. Secure on-chain auctions and transfers.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>
          <ScrollToTop />
          {/* Devnet Banner */}
          <div className="bg-gradient-to-r from-emerald-600 via-green-500 to-emerald-600 text-white text-center py-2 px-4 text-sm font-medium">
            <span className="inline-flex items-center gap-2">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
              <span>DEVNET</span>
            </span>
            <span className="hidden sm:inline mx-2 opacity-80">—</span>
            <span className="hidden sm:inline opacity-90">Test deployment on Solana Devnet. Enable Testnet Mode in Phantom Settings.</span>
            <span className="sm:hidden"> — </span>
            <a href="https://faucet.solana.com" target="_blank" rel="noopener noreferrer" className="ml-2 underline decoration-white/50 hover:decoration-white transition-all">Get Devnet SOL</a>
          </div>
          <div className="flex flex-col min-h-screen">
            <Navbar />
            <main className="flex-1">
              {children}
            </main>
            <Footer />
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
