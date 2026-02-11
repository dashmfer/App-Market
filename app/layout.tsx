import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
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
  metadataBase: new URL("https://www.appmrkt.xyz"),
  openGraph: {
    title: "App Market",
    description: "Buy & Sell Apps, MVPs, and Prototypes. Secure on-chain escrow and transfers.",
    url: "https://www.appmrkt.xyz",
    siteName: "App Market",
    type: "website",
    images: [
      {
        url: "https://i.imgur.com/wF56zDW.png",
        width: 1200,
        height: 630,
        alt: "App Market - Buy & Sell Apps",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "App Market",
    description: "Buy & Sell Apps, MVPs, and Prototypes. Secure on-chain escrow and transfers.",
    images: {
      url: "https://i.imgur.com/wF56zDW.png",
      type: "image/png",
      width: 1200,
      height: 630,
      alt: "App Market - Buy & Sell Apps",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // SECURITY [H7]: Read CSP nonce from the request header set by middleware
  // and pass it to script elements so they satisfy the Content-Security-Policy.
  const nonce = headers().get("x-nonce") ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="csp-nonce" content={nonce ?? ""} />
      </head>
      <body className={`${inter.variable} font-sans antialiased`} nonce={nonce}>
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
