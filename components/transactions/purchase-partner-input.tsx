"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  UserPlus,
  X,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Percent,
  Crown,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { debounce } from "@/lib/utils";

// Types
interface PartnerUser {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  image: string | null;
  walletAddress: string | null;
  twitterUsername: string | null;
  twitterVerified: boolean;
}

export interface PurchasePartner {
  id: string;
  walletAddress: string;
  user: PartnerUser | null;
  percentage: number;
  depositAmount: number;
  isLead: boolean;
}

interface PurchasePartnerInputProps {
  partners: PurchasePartner[];
  onChange: (partners: PurchasePartner[]) => void;
  totalPrice: number;
  currentUserPercentage: number;
  onCurrentUserPercentageChange: (percentage: number) => void;
  disabled?: boolean;
  maxPartners?: number;
}

export function PurchasePartnerInput({
  partners,
  onChange,
  totalPrice,
  currentUserPercentage,
  onCurrentUserPercentageChange,
  disabled = false,
  maxPartners = 10,
}: PurchasePartnerInputProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<PartnerUser | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [newPartnerPercentage, setNewPartnerPercentage] = useState(10);

  // Calculate totals
  const partnersTotalPercentage = partners.reduce((sum, p) => sum + p.percentage, 0);
  const totalPercentage = currentUserPercentage + partnersTotalPercentage;
  const remainingPercentage = 100 - totalPercentage;

  // Debounced search
  const searchUser = useCallback(
    debounce(async (query: string) => {
      if (!query || query.length < 2) {
        setSearchResult(null);
        setSearchError("");
        return;
      }

      setIsSearching(true);
      setSearchError("");

      try {
        const response = await fetch(`/api/users/lookup?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (!response.ok) {
          setSearchError(data.error || "Search failed");
          setSearchResult(null);
        } else if (data.user) {
          setSearchResult(data.user);
          setSearchError("");
        } else {
          setSearchResult(null);
          setSearchError("No user found");
        }
      } catch {
        setSearchError("Search failed");
        setSearchResult(null);
      } finally {
        setIsSearching(false);
      }
    }, 300),
    []
  );

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    searchUser(value);
  };

  const handleAddPartner = () => {
    if (!searchResult?.walletAddress) {
      setSearchError("User must have a wallet address");
      return;
    }

    // Check if already added
    if (partners.some(p => p.walletAddress.toLowerCase() === searchResult.walletAddress!.toLowerCase())) {
      setSearchError("This user is already a partner");
      return;
    }

    // Check percentage
    if (newPartnerPercentage <= 0 || totalPercentage + newPartnerPercentage > 100) {
      setSearchError("Invalid percentage");
      return;
    }

    const depositAmount = (totalPrice * newPartnerPercentage) / 100;

    const newPartner: PurchasePartner = {
      id: `temp-${Date.now()}`,
      walletAddress: searchResult.walletAddress,
      user: searchResult,
      percentage: newPartnerPercentage,
      depositAmount,
      isLead: false,
    };

    onChange([...partners, newPartner]);

    // Reset form
    setSearchQuery("");
    setSearchResult(null);
    setNewPartnerPercentage(10);
    setIsAdding(false);
  };

  const handleRemovePartner = (id: string) => {
    onChange(partners.filter(p => p.id !== id));
  };

  const handleUpdatePercentage = (id: string, percentage: number) => {
    const otherPartnersTotal = partners
      .filter(p => p.id !== id)
      .reduce((sum, p) => sum + p.percentage, 0);

    const maxAllowed = 100 - currentUserPercentage - otherPartnersTotal;
    const newPercentage = Math.max(1, Math.min(percentage, maxAllowed));
    const depositAmount = (totalPrice * newPercentage) / 100;

    onChange(
      partners.map(p =>
        p.id === id ? { ...p, percentage: newPercentage, depositAmount } : p
      )
    );
  };

  const getDisplayName = (p: PurchasePartner) => {
    if (p.user?.displayName) return p.user.displayName;
    if (p.user?.username) return `@${p.user.username}`;
    if (p.user?.name) return p.user.name;
    return `${p.walletAddress.slice(0, 4)}...${p.walletAddress.slice(-4)}`;
  };

  const currentUserDepositAmount = (totalPrice * currentUserPercentage) / 100;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-zinc-900 dark:text-white">
            Purchase Partners
          </h3>
        </div>
        {partners.length < maxPartners && !disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAdding(true)}
            className="gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Add Partner
          </Button>
        )}
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <Clock className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
        <div className="text-sm text-blue-700 dark:text-blue-300">
          <p className="font-medium">30-minute deposit window</p>
          <p className="text-blue-600 dark:text-blue-400">
            All partners must deposit within 30 minutes. If not all deposits are made, everyone gets refunded.
          </p>
        </div>
      </div>

      {/* Your Share */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800">
        <div className="flex items-center gap-3 mb-3">
          <Crown className="w-5 h-5 text-green-500" />
          <span className="font-medium text-zinc-900 dark:text-white">Your Share (Lead Buyer)</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <input
              type="range"
              min={1}
              max={100 - partnersTotalPercentage}
              value={currentUserPercentage}
              onChange={(e) => onCurrentUserPercentageChange(parseInt(e.target.value))}
              disabled={disabled}
              className="w-full accent-green-500"
            />
          </div>
          <div className="flex items-center gap-2 min-w-[140px]">
            <input
              type="number"
              value={currentUserPercentage}
              onChange={(e) => {
                const val = Math.max(1, Math.min(100 - partnersTotalPercentage, parseInt(e.target.value) || 1));
                onCurrentUserPercentageChange(val);
              }}
              disabled={disabled}
              className="w-16 px-2 py-1 text-center text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
            />
            <span className="text-zinc-500">%</span>
            <span className="text-sm font-medium text-green-600 dark:text-green-400">
              {currentUserDepositAmount.toFixed(2)} SOL
            </span>
          </div>
        </div>
      </div>

      {/* Partners List */}
      <AnimatePresence mode="popLayout">
        {partners.map((partner) => (
          <motion.div
            key={partner.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700"
          >
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="relative w-10 h-10 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-700 shrink-0">
                {partner.user?.image ? (
                  <Image
                    src={partner.user.image}
                    alt={getDisplayName(partner)}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-400">
                    <Users className="w-5 h-5" />
                  </div>
                )}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-zinc-900 dark:text-white truncate">
                  {getDisplayName(partner)}
                </p>
                <p className="text-xs text-zinc-500 truncate">
                  {partner.walletAddress.slice(0, 8)}...{partner.walletAddress.slice(-6)}
                </p>
              </div>

              {/* Percentage & Amount */}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={partner.percentage}
                  onChange={(e) => handleUpdatePercentage(partner.id, parseInt(e.target.value) || 1)}
                  disabled={disabled}
                  min={1}
                  max={100 - currentUserPercentage - partners.filter(p => p.id !== partner.id).reduce((s, p) => s + p.percentage, 0)}
                  className="w-14 px-2 py-1 text-center text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
                />
                <Percent className="w-4 h-4 text-zinc-400" />
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400 min-w-[70px]">
                  {partner.depositAmount.toFixed(2)} SOL
                </span>
              </div>

              {/* Remove */}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemovePartner(partner.id)}
                  className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-zinc-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Add Partner Form */}
      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-xl border-2 border-dashed border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10 space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search by username or wallet address..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 animate-spin" />
                )}
              </div>

              {/* Search Result */}
              {searchResult && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                  <div className="relative w-10 h-10 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-700 shrink-0">
                    {searchResult.image ? (
                      <Image
                        src={searchResult.image}
                        alt=""
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-400">
                        <Users className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-zinc-900 dark:text-white truncate">
                      {searchResult.displayName || searchResult.username || searchResult.name}
                    </p>
                    {searchResult.twitterVerified && (
                      <p className="text-xs text-blue-500">@{searchResult.twitterUsername} ✓</p>
                    )}
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                </div>
              )}

              {/* Error */}
              {searchError && (
                <div className="flex items-center gap-2 text-sm text-red-500">
                  <AlertCircle className="w-4 h-4" />
                  {searchError}
                </div>
              )}

              {/* Percentage Input */}
              {searchResult && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Their Share
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={1}
                      max={Math.max(1, remainingPercentage)}
                      value={newPartnerPercentage}
                      onChange={(e) => setNewPartnerPercentage(parseInt(e.target.value))}
                      className="flex-1 accent-blue-500"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={newPartnerPercentage}
                        onChange={(e) => setNewPartnerPercentage(Math.max(1, Math.min(remainingPercentage, parseInt(e.target.value) || 1)))}
                        min={1}
                        max={remainingPercentage}
                        className="w-14 px-2 py-1 text-center text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
                      />
                      <span className="text-zinc-500">%</span>
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        {((totalPrice * newPartnerPercentage) / 100).toFixed(2)} SOL
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsAdding(false);
                    setSearchQuery("");
                    setSearchResult(null);
                    setSearchError("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddPartner}
                  disabled={!searchResult}
                  className="gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Add Partner
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Total Progress */}
      {partners.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500">Total Allocation</span>
            <span className={`font-medium ${totalPercentage === 100 ? 'text-green-500' : 'text-amber-500'}`}>
              {totalPercentage}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
            <div
              className={`h-full transition-all ${totalPercentage === 100 ? 'bg-green-500' : 'bg-amber-500'}`}
              style={{ width: `${totalPercentage}%` }}
            />
          </div>
          {totalPercentage < 100 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {remainingPercentage}% unallocated. Add more partners or increase shares to reach 100%.
            </p>
          )}
          {totalPercentage === 100 && (
            <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Ready to proceed!
            </p>
          )}
        </div>
      )}
    </div>
  );
}
