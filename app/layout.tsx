import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "App Market | Buy & Sell AI-Generated Apps",
  description: "The premier marketplace for buying and selling AI-generated prototypes, MVPs, and micro-SaaS projects. Powered by Solana.",
  keywords: ["marketplace", "AI apps", "MVP", "prototype", "Solana", "crypto", "SaaS"],
  authors: [{ name: "App Market" }],
  openGraph: {
    title: "App Market | Buy & Sell AI-Generated Apps",
    description: "The premier marketplace for buying and selling AI-generated prototypes, MVPs, and micro-SaaS projects.",
    url: "https://app.market",
    siteName: "App Market",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "App Market | Buy & Sell AI-Generated Apps",
    description: "The premier marketplace for buying and selling AI-generated prototypes, MVPs, and micro-SaaS projects.",
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
          {/* Devnet Banner */}
          <div className="bg-amber-500 text-amber-950 text-center py-2 px-4 text-sm">
            <span className="font-semibold">🔧 DEVNET MODE</span>
            <span className="hidden sm:inline"> — This is a test deployment on Solana Devnet. You&apos;ll need Devnet SOL to interact. To connect, open Phantom → Settings → Developer Settings → Enable Testnet Mode → Select Devnet. Get free Devnet SOL: </span>
            <span className="sm:hidden"> — </span>
            <a href="https://faucet.solana.com" target="_blank" rel="noopener noreferrer" className="underline font-medium hover:text-amber-800">Solana Faucet</a>
            <span className="mx-1">|</span>
            <a href="https://faucet.quicknode.com/solana/devnet" target="_blank" rel="noopener noreferrer" className="underline font-medium hover:text-amber-800">QuickNode Faucet</a>
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
