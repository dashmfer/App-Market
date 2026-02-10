"use client";

import { useState, useCallback, useEffect } from "react";
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
  ChevronDown,
  Percent,
  Crown,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { debounce } from "@/lib/utils";

// Types
interface CollaboratorUser {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  image: string | null;
  walletAddress: string | null;
  isVerified: boolean;
  twitterUsername: string | null;
  twitterVerified: boolean;
  rating: number | null;
  totalSales: number;
}

export interface Collaborator {
  id: string; // Temporary client-side ID
  walletAddress: string;
  user: CollaboratorUser | null;
  role: "PARTNER" | "COLLABORATOR";
  roleDescription: string;
  customRoleDescription?: string;
  percentage: number;
}

interface CollaboratorInputProps {
  collaborators: Collaborator[];
  onChange: (collaborators: Collaborator[]) => void;
  ownerPercentage: number;
  disabled?: boolean;
  maxCollaborators?: number;
}

// Role description options
const PARTNER_ROLES = [
  { value: "CO_FOUNDER", label: "Co-founder" },
  { value: "DEVELOPER", label: "Developer" },
  { value: "TECHNICAL_LEAD", label: "Technical Lead" },
  { value: "CTO", label: "CTO" },
  { value: "OTHER", label: "Other" },
];

const COLLABORATOR_ROLES = [
  { value: "DESIGNER", label: "Designer" },
  { value: "MARKETING", label: "Marketing" },
  { value: "VIDEO_EDITOR", label: "Video Editor" },
  { value: "CONSULTANT", label: "Consultant" },
  { value: "ADVISOR", label: "Advisor" },
  { value: "BRANDING", label: "Branding" },
  { value: "COPYWRITER", label: "Copywriter" },
  { value: "COMMUNITY_MANAGER", label: "Community Manager" },
  { value: "OTHER", label: "Other" },
];

export function CollaboratorInput({
  collaborators,
  onChange,
  ownerPercentage,
  disabled = false,
  maxCollaborators = 10,
}: CollaboratorInputProps) {
  const [isAddingPartner, setIsAddingPartner] = useState(false);
  const [isAddingCollaborator, setIsAddingCollaborator] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<CollaboratorUser | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [newCollaborator, setNewCollaborator] = useState<{
    role: "PARTNER" | "COLLABORATOR";
    roleDescription: string;
    customRoleDescription: string;
    percentage: number;
  }>({
    role: "PARTNER",
    roleDescription: "CO_FOUNDER",
    customRoleDescription: "",
    percentage: 10,
  });

  // Calculate total allocated percentage
  const totalCollaboratorPercentage = collaborators.reduce(
    (sum, c) => sum + c.percentage,
    0
  );
  const remainingPercentage = 100 - totalCollaboratorPercentage;

  // Debounced search function
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

        if (data.user) {
          // Check if already added
          const alreadyAdded = collaborators.some(
            c => c.walletAddress.toLowerCase() === data.user.walletAddress?.toLowerCase()
          );
          if (alreadyAdded) {
            setSearchError("This user is already a collaborator");
            setSearchResult(null);
          } else {
            setSearchResult(data.user);
          }
        } else {
          // Wallet address not found - could still be valid for unregistered user
          if (data.isWalletAddress) {
            // Valid wallet format but not registered
            setSearchResult({
              id: "",
              username: null,
              displayName: null,
              name: null,
              image: null,
              walletAddress: query,
              isVerified: false,
              twitterUsername: null,
              twitterVerified: false,
              rating: null,
              totalSales: 0,
            });
          } else {
            setSearchResult(null);
            setSearchError("No user found");
          }
        }
      } catch (error: any) {
        console.error("Search error:", error);
        setSearchError("Failed to search");
      } finally {
        setIsSearching(false);
      }
    }, 300),
    [collaborators]
  );

  // Handle search input change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    searchUser(value);
  };

  // Add collaborator
  const handleAddCollaborator = () => {
    if (!searchResult?.walletAddress) return;
    if (newCollaborator.percentage <= 0) return;
    if (newCollaborator.percentage > remainingPercentage - 1) return; // Leave at least 1% for owner

    const newEntry: Collaborator = {
      id: `temp-${Date.now()}`,
      walletAddress: searchResult.walletAddress,
      user: searchResult.id ? searchResult : null,
      role: newCollaborator.role,
      roleDescription: newCollaborator.roleDescription,
      customRoleDescription:
        newCollaborator.roleDescription === "OTHER"
          ? newCollaborator.customRoleDescription
          : undefined,
      percentage: newCollaborator.percentage,
    };

    onChange([...collaborators, newEntry]);

    // Reset form
    setSearchQuery("");
    setSearchResult(null);
    setNewCollaborator({
      role: "PARTNER",
      roleDescription: "CO_FOUNDER",
      customRoleDescription: "",
      percentage: 10,
    });
    setIsAddingPartner(false);
    setIsAddingCollaborator(false);
  };

  // Remove collaborator
  const handleRemoveCollaborator = (id: string) => {
    onChange(collaborators.filter(c => c.id !== id));
  };

  // Update collaborator percentage
  const handleUpdatePercentage = (id: string, percentage: number) => {
    const updated = collaborators.map(c =>
      c.id === id ? { ...c, percentage: Math.max(1, Math.min(percentage, 99)) } : c
    );
    onChange(updated);
  };

  // Get display name for a collaborator
  const getDisplayName = (c: Collaborator) => {
    if (c.user?.displayName) return c.user.displayName;
    if (c.user?.username) return `@${c.user.username}`;
    if (c.user?.name) return c.user.name;
    return `${c.walletAddress.slice(0, 4)}...${c.walletAddress.slice(-4)}`;
  };

  // Get role label
  const getRoleLabel = (roleDescription: string, customRoleDescription?: string) => {
    if (roleDescription === "OTHER" && customRoleDescription) {
      return customRoleDescription;
    }
    const allRoles = [...PARTNER_ROLES, ...COLLABORATOR_ROLES];
    return allRoles.find(r => r.value === roleDescription)?.label || roleDescription;
  };

  // Open add form
  const openAddForm = (role: "PARTNER" | "COLLABORATOR") => {
    setNewCollaborator({
      role,
      roleDescription: role === "PARTNER" ? "CO_FOUNDER" : "DESIGNER",
      customRoleDescription: "",
      percentage: 10,
    });
    setSearchQuery("");
    setSearchResult(null);
    setSearchError("");
    if (role === "PARTNER") {
      setIsAddingPartner(true);
      setIsAddingCollaborator(false);
    } else {
      setIsAddingPartner(false);
      setIsAddingCollaborator(true);
    }
  };

  const isAddingAny = isAddingPartner || isAddingCollaborator;
  const roleOptions = newCollaborator.role === "PARTNER" ? PARTNER_ROLES : COLLABORATOR_ROLES;

  return (
    <div className="space-y-4">
      {/* Header with percentages */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          <span className="font-medium text-zinc-900 dark:text-zinc-100">Team</span>
          {collaborators.length > 0 && (
            <span className="text-sm text-zinc-500">
              ({collaborators.length} member{collaborators.length !== 1 ? "s" : ""})
            </span>
          )}
        </div>
        <div className="text-sm text-zinc-500">
          Your share: <span className="font-semibold text-green-600">{ownerPercentage}%</span>
        </div>
      </div>

      {/* Progress bar showing split */}
      {collaborators.length > 0 && (
        <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden flex">
          <div
            className="bg-green-500 transition-all duration-300"
            style={{ width: `${ownerPercentage}%` }}
            title={`You: ${ownerPercentage}%`}
          />
          {collaborators.map((c, i) => (
            <div
              key={c.id}
              className={`transition-all duration-300 ${
                c.role === "PARTNER" ? "bg-blue-500" : "bg-purple-500"
              }`}
              style={{ width: `${c.percentage}%` }}
              title={`${getDisplayName(c)}: ${c.percentage}%`}
            />
          ))}
        </div>
      )}

      {/* Current collaborators list */}
      {collaborators.length > 0 && (
        <div className="space-y-2">
          {collaborators.map((collaborator) => (
            <motion.div
              key={collaborator.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`p-3 rounded-xl border ${
                collaborator.role === "PARTNER"
                  ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20"
                  : "border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-900/20"
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                {collaborator.user?.image ? (
                  <Image
                    src={collaborator.user.image}
                    alt={getDisplayName(collaborator)}
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    collaborator.role === "PARTNER"
                      ? "bg-blue-200 dark:bg-blue-800"
                      : "bg-purple-200 dark:bg-purple-800"
                  }`}>
                    <span className="text-sm font-medium">
                      {getDisplayName(collaborator)[0].toUpperCase()}
                    </span>
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {getDisplayName(collaborator)}
                    </span>
                    {collaborator.user?.isVerified && (
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    )}
                    {collaborator.user?.twitterVerified && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600">
                        @{collaborator.user.twitterUsername}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span className={`px-1.5 py-0.5 rounded ${
                      collaborator.role === "PARTNER"
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                        : "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                    }`}>
                      {collaborator.role === "PARTNER" ? (
                        <Crown className="w-3 h-3 inline mr-1" />
                      ) : (
                        <Briefcase className="w-3 h-3 inline mr-1" />
                      )}
                      {getRoleLabel(collaborator.roleDescription, collaborator.customRoleDescription)}
                    </span>
                    {!collaborator.user && (
                      <span className="text-amber-600 dark:text-amber-400">
                        Not registered
                      </span>
                    )}
                  </div>
                </div>

                {/* Percentage */}
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={collaborator.percentage}
                    onChange={(e) => handleUpdatePercentage(collaborator.id, parseFloat(e.target.value) || 0)}
                    min={1}
                    max={99}
                    disabled={disabled}
                    className="w-16 px-2 py-1 text-center text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
                  />
                  <Percent className="w-4 h-4 text-zinc-400" />
                </div>

                {/* Remove button */}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleRemoveCollaborator(collaborator.id)}
                    className="p-1.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-zinc-400 hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add buttons */}
      {!isAddingAny && collaborators.length < maxCollaborators && !disabled && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => openAddForm("PARTNER")}
            className="flex-1 py-3 px-4 rounded-xl border-2 border-dashed border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all flex items-center justify-center gap-2"
          >
            <Crown className="w-4 h-4" />
            <span>Add Partner</span>
          </button>
          <button
            type="button"
            onClick={() => openAddForm("COLLABORATOR")}
            className="flex-1 py-3 px-4 rounded-xl border-2 border-dashed border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all flex items-center justify-center gap-2"
          >
            <Briefcase className="w-4 h-4" />
            <span>Add Collaborator</span>
          </button>
        </div>
      )}

      {/* Add form */}
      <AnimatePresence>
        {isAddingAny && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={`p-4 rounded-xl border ${
              newCollaborator.role === "PARTNER"
                ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20"
                : "border-purple-300 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/20"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-zinc-900 dark:text-zinc-100">
                Add {newCollaborator.role === "PARTNER" ? "Partner" : "Collaborator"}
              </h4>
              <button
                type="button"
                onClick={() => {
                  setIsAddingPartner(false);
                  setIsAddingCollaborator(false);
                }}
                className="p-1 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Search input */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Wallet Address or Username
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Enter wallet address or @username"
                    className="input-field pl-10"
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 animate-spin" />
                  )}
                </div>
                {searchError && (
                  <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {searchError}
                  </p>
                )}
              </div>

              {/* Search result preview */}
              {searchResult && (
                <div className="p-3 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                  <div className="flex items-center gap-3">
                    {searchResult.image ? (
                      <Image
                        src={searchResult.image}
                        alt="User"
                        width={32}
                        height={32}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                        <span className="text-xs font-medium">
                          {searchResult.walletAddress?.slice(0, 2)}
                        </span>
                      </div>
                    )}
                    <div className="flex-1">
                      {searchResult.id ? (
                        <>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-sm">
                              {searchResult.displayName || searchResult.username || searchResult.name}
                            </span>
                            {searchResult.isVerified && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            )}
                          </div>
                          <p className="text-xs text-zinc-500">
                            {searchResult.walletAddress?.slice(0, 8)}...{searchResult.walletAddress?.slice(-6)}
                          </p>
                        </>
                      ) : (
                        <>
                          <span className="text-sm text-amber-600 dark:text-amber-400">
                            Unregistered Wallet
                          </span>
                          <p className="text-xs text-zinc-500">
                            {searchResult.walletAddress}
                          </p>
                        </>
                      )}
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  </div>
                </div>
              )}

              {/* Role description */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Role
                </label>
                <select
                  value={newCollaborator.roleDescription}
                  onChange={(e) =>
                    setNewCollaborator({ ...newCollaborator, roleDescription: e.target.value })
                  }
                  className="input-field"
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom role description */}
              {newCollaborator.roleDescription === "OTHER" && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Custom Role Title
                  </label>
                  <input
                    type="text"
                    value={newCollaborator.customRoleDescription || ""}
                    onChange={(e) =>
                      setNewCollaborator({
                        ...newCollaborator,
                        customRoleDescription: e.target.value,
                      })
                    }
                    placeholder="e.g., Product Manager, Data Scientist"
                    className="input-field"
                    maxLength={30}
                  />
                </div>
              )}

              {/* Percentage */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Revenue Share
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={Math.max(1, remainingPercentage - 1)}
                    value={newCollaborator.percentage}
                    onChange={(e) =>
                      setNewCollaborator({
                        ...newCollaborator,
                        percentage: parseInt(e.target.value),
                      })
                    }
                    className="flex-1 accent-green-500"
                  />
                  <div className="flex items-center gap-1 w-20">
                    <input
                      type="number"
                      value={newCollaborator.percentage}
                      onChange={(e) =>
                        setNewCollaborator({
                          ...newCollaborator,
                          percentage: Math.max(
                            1,
                            Math.min(
                              remainingPercentage - 1,
                              parseInt(e.target.value) || 1
                            )
                          ),
                        })
                      }
                      min={1}
                      max={remainingPercentage - 1}
                      className="w-14 px-2 py-1 text-center text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
                    />
                    <Percent className="w-4 h-4 text-zinc-400" />
                  </div>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  Available: {remainingPercentage - 1}% (keeping at least 1% for you)
                </p>
              </div>

              {/* Add button */}
              <Button
                type="button"
                variant={newCollaborator.role === "PARTNER" ? "default" : "default"}
                onClick={handleAddCollaborator}
                disabled={
                  !searchResult?.walletAddress ||
                  newCollaborator.percentage <= 0 ||
                  newCollaborator.percentage > remainingPercentage - 1 ||
                  (newCollaborator.roleDescription === "OTHER" &&
                    !newCollaborator.customRoleDescription)
                }
                className="w-full"
              >
                <UserPlus className="w-4 h-4" />
                Add {newCollaborator.role === "PARTNER" ? "Partner" : "Collaborator"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info text */}
      {collaborators.length === 0 && !isAddingAny && (
        <p className="text-sm text-zinc-500 text-center py-2">
          Working with a team? Add partners or collaborators to split revenue.
        </p>
      )}

      {/* Validation warning */}
      {totalCollaboratorPercentage > 99 && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Total collaborator percentage cannot exceed 99%. Please adjust the splits.
          </p>
        </div>
      )}
    </div>
  );
}
