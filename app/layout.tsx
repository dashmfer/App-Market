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
