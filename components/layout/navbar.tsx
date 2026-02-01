"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import { usePrivyAuth } from "@/components/providers/PrivyAuthProvider";
import {
  Menu,
  X,
  Search,
  Plus,
  ChevronDown,
  User,
  Settings,
  LogOut,
  Package,
  ShoppingBag,
  Heart,
  LayoutDashboard,
  MessageCircle,
  Mail,
} from "lucide-react";
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useTranslations } from "next-intl";

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const pathname = usePathname();
  const t = useTranslations("nav");

  const navLinks = [
    { href: "/explore", label: t("explore") },
    { href: "/categories", label: t("categories") },
    { href: "/how-it-works", label: t("howItWorks") },
  ];

  const { data: session } = useSession();
  const { isAuthenticated, isLoading, login, logout, walletAddress, authMethod } = usePrivyAuth();

  // Use displayName, then name, then username, then wallet address
  const displayName = (session?.user as any)?.displayName ||
    session?.user?.name ||
    (session?.user as any)?.username ||
    (walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : null);

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

  const handleSignIn = () => {
    login();
  };

  const handleDisconnect = async () => {
    await logout();
    setIsUserMenuOpen(false);
  };

  // Show auth method icon
  const getAuthIcon = () => {
    switch (authMethod) {
      case "email":
        return <Mail className="w-4 h-4 text-white" />;
      case "twitter":
        return (
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        );
      default:
        return <User className="w-4 h-4 text-white" />;
    }
  };

  return (
    <>
      <header
        className={`fixed top-[36px] left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-zinc-200/50 dark:border-zinc-800/50"
            : "bg-transparent"
        }`}
      >
        <nav className="container-wide">
          <div className="flex items-center justify-between h-16 md:h-20 relative">
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

            {/* Desktop Navigation - Centered */}
            <div className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
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
              {/* Language Switcher */}
              <LanguageSwitcher />

              {/* Search Button */}
              <Link
                href="/explore"
                className="p-2 rounded-full text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <Search className="w-5 h-5" />
              </Link>

              {isAuthenticated ? (
                <>
                  {/* Notifications */}
                  <NotificationDropdown />

                  {/* Create Listing */}
                  <Link href="/create" className="hidden sm:flex btn-success text-sm py-2">
                    <Plus className="w-4 h-4" />
                    <span>{t("listProject")}</span>
                  </Link>

                  {/* User Menu */}
                  <div className="relative">
                    <button
                      onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                      className="flex items-center gap-2 p-1.5 pr-3 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                        {getAuthIcon()}
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
                              {walletAddress && (
                                <p className="text-sm text-zinc-500 mt-0.5">
                                  {walletAddress.slice(0, 8)}...
                                  {walletAddress.slice(-8)}
                                </p>
                              )}
                              {authMethod && (
                                <p className="text-xs text-zinc-400 mt-1 capitalize">
                                  Signed in via {authMethod}
                                </p>
                              )}
                            </div>
                            <div className="p-2">
                              <Link
                                href="/dashboard"
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                              >
                                <LayoutDashboard className="w-4 h-4" />
                                <span>{t("dashboard")}</span>
                              </Link>
                              <Link
                                href="/dashboard/listings"
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                              >
                                <Package className="w-4 h-4" />
                                <span>{t("myListings")}</span>
                              </Link>
                              <Link
                                href="/dashboard/purchases"
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                              >
                                <ShoppingBag className="w-4 h-4" />
                                <span>{t("purchases")}</span>
                              </Link>
                              <Link
                                href="/dashboard/watchlist"
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                              >
                                <Heart className="w-4 h-4" />
                                <span>{t("watchlist")}</span>
                              </Link>
                              <Link
                                href="/dashboard/messages"
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                              >
                                <MessageCircle className="w-4 h-4" />
                                <span>{t("messages")}</span>
                              </Link>
                              <Link
                                href="/dashboard/settings"
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                              >
                                <Settings className="w-4 h-4" />
                                <span>{t("settings")}</span>
                              </Link>
                            </div>
                            <div className="p-2 border-t border-zinc-200 dark:border-zinc-800">
                              <button
                                onClick={handleDisconnect}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors w-full"
                              >
                                <LogOut className="w-4 h-4" />
                                <span>{t("signOut")}</span>
                              </button>
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              ) : (
                <button
                  onClick={handleSignIn}
                  disabled={isLoading}
                  className="btn-primary text-sm py-2"
                >
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">
                    {isLoading ? t("loading") : t("signIn")}
                  </span>
                </button>
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
                      <span>{t("listProject")}</span>
                    </Link>
                  ) : (
                    <button
                      onClick={handleSignIn}
                      disabled={isLoading}
                      className="btn-primary w-full justify-center"
                    >
                      <User className="w-5 h-5" />
                      <span>{isLoading ? t("loading") : t("signIn")}</span>
                    </button>
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
