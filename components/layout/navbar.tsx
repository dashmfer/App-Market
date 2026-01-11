"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useSession, signIn, signOut } from "next-auth/react";
import {
  Menu,
  X,
  Search,
  Bell,
  Plus,
  ChevronDown,
  Wallet,
  User,
  Settings,
  LogOut,
  Package,
  ShoppingBag,
  Heart,
  LayoutDashboard,
} from "lucide-react";

const navLinks = [
  { href: "/explore", label: "Explore" },
  { href: "/categories", label: "Categories" },
  { href: "/how-it-works", label: "How It Works" },
];

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const pathname = usePathname();
  
  const { data: session } = useSession();
  const { publicKey, connected, disconnect } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();

  const isAuthenticated = session?.user || connected;
  const displayName = session?.user?.name || 
    (publicKey ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}` : null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
  }, [pathname]);

  const handleConnectWallet = () => {
    setWalletModalVisible(true);
  };

  const handleDisconnect = async () => {
    if (connected) {
      await disconnect();
    }
    if (session) {
      await signOut();
    }
    setIsUserMenuOpen(false);
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-zinc-200/50 dark:border-zinc-800/50"
            : "bg-transparent"
        }`}
      >
        <nav className="container-wide">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-2 font-display text-xl font-semibold"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <span className="text-white text-sm font-bold">A</span>
              </div>
              <span className="hidden sm:inline">App Market</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    pathname === link.href
                      ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-2 md:gap-3">
              {/* Search Button */}
              <button className="p-2 rounded-full text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <Search className="w-5 h-5" />
              </button>

              {isAuthenticated ? (
                <>
                  {/* Notifications */}
                  <button className="p-2 rounded-full text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors relative">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full" />
                  </button>

                  {/* Create Listing */}
                  <Link href="/create" className="hidden sm:flex btn-success text-sm py-2">
                    <Plus className="w-4 h-4" />
                    <span>List Project</span>
                  </Link>

                  {/* User Menu */}
                  <div className="relative">
                    <button
                      onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                      className="flex items-center gap-2 p-1.5 pr-3 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <ChevronDown className="w-4 h-4 text-zinc-500" />
                    </button>

                    <AnimatePresence>
                      {isUserMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsUserMenuOpen(false)}
                          />
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            transition={{ duration: 0.15 }}
                            className="absolute right-0 mt-2 w-64 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl shadow-black/10 border border-zinc-200 dark:border-zinc-800 overflow-hidden z-50"
                          >
                            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
                              <p className="font-medium text-zinc-900 dark:text-zinc-100">
                                {displayName}
                              </p>
                              {publicKey && (
                                <p className="text-sm text-zinc-500 mt-0.5">
                                  {publicKey.toBase58().slice(0, 8)}...
                                  {publicKey.toBase58().slice(-8)}
                                </p>
                              )}
                            </div>
                            <div className="p-2">
                              <Link
                                href="/dashboard"
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                              >
                                <LayoutDashboard className="w-4 h-4" />
                                <span>Dashboard</span>
                              </Link>
                              <Link
                                href="/dashboard/listings"
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                              >
                                <Package className="w-4 h-4" />
                                <span>My Listings</span>
                              </Link>
                              <Link
                                href="/dashboard/purchases"
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                              >
                                <ShoppingBag className="w-4 h-4" />
                                <span>Purchases</span>
                              </Link>
                              <Link
                                href="/dashboard/watchlist"
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                              >
                                <Heart className="w-4 h-4" />
                                <span>Watchlist</span>
                              </Link>
                              <Link
                                href="/dashboard/settings"
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                              >
                                <Settings className="w-4 h-4" />
                                <span>Settings</span>
                              </Link>
                            </div>
                            <div className="p-2 border-t border-zinc-200 dark:border-zinc-800">
                              <button
                                onClick={handleDisconnect}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors w-full"
                              >
                                <LogOut className="w-4 h-4" />
                                <span>Sign Out</span>
                              </button>
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              ) : (
                <>
                  <button
                    onClick={() => signIn()}
                    className="hidden sm:flex text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={handleConnectWallet}
                    className="btn-primary text-sm py-2"
                  >
                    <Wallet className="w-4 h-4" />
                    <span className="hidden sm:inline">Connect Wallet</span>
                  </button>
                </>
              )}

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-full text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors md:hidden"
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </nav>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 md:hidden"
          >
            <div
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="absolute right-0 top-0 bottom-0 w-80 bg-white dark:bg-zinc-900 shadow-2xl"
            >
              <div className="p-6 pt-20">
                <nav className="space-y-2">
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`block px-4 py-3 rounded-xl text-lg font-medium transition-colors ${
                        pathname === link.href
                          ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20"
                          : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>

                <div className="mt-8 pt-8 border-t border-zinc-200 dark:border-zinc-800">
                  {isAuthenticated ? (
                    <Link href="/create" className="btn-success w-full justify-center">
                      <Plus className="w-5 h-5" />
                      <span>List Project</span>
                    </Link>
                  ) : (
                    <div className="space-y-3">
                      <button
                        onClick={handleConnectWallet}
                        className="btn-primary w-full justify-center"
                      >
                        <Wallet className="w-5 h-5" />
                        <span>Connect Wallet</span>
                      </button>
                      <button
                        onClick={() => signIn()}
                        className="btn-secondary w-full justify-center"
                      >
                        Sign In with Email
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacer for fixed header */}
      <div className="h-16 md:h-20" />
    </>
  );
}
