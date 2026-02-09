"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Github,
  Globe,
  Database,
  Key,
  FileText,
  Palette,
  CheckCircle2,
  Clock,
  AlertCircle,
  Shield,
  MessageSquare,
  Flag,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  Info,
  ChevronDown,
  ChevronUp,
  Link as LinkIcon,
  Scale,
  FileCheck,
  PenTool,
  Rocket,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { LucideIcon } from "lucide-react";

import { SecurityNotice } from "@/components/transfers/SecurityNotice";
import { PATOLaunchModal } from "@/components/pato/PATOLaunchModal";
import { PATOStatusCard } from "@/components/pato/PATOStatusCard";

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  iconType: string;
  required: boolean;
  sellerConfirmed: boolean;
  sellerConfirmedAt: string | null;
  sellerEvidence: string | null;
  buyerConfirmed: boolean;
  buyerConfirmedAt: string | null;
}

interface Transfer {
  id: string;
  listing: {
    id: string;
    title: string;
    slug: string;
    offersAPA?: boolean;
    offersNonCompete?: boolean;
    nonCompeteDurationYears?: number;
  };
  salePrice: number;
  platformFee: number;
  sellerProceeds: number;
  currency: string;
  status: string;
  buyer: {
    id: string;
    name: string;
    walletAddress: string | null;
  };
  seller: {
    id: string;
    name: string;
    walletAddress: string | null;
  };
  escrowAddress: string | null;
  createdAt: string;
  transferDeadline: string;
  checklist: ChecklistItem[];
  isSeller: boolean;
  isBuyer: boolean;
  // Agreement fields
  apaSigned?: boolean;
  apaSignedAt?: string;
  apaSignature?: string;
  nonCompeteSigned?: boolean;
  nonCompeteSignedAt?: string;
  nonCompeteSignature?: string;
  buyerRequestedAPA?: boolean;
  buyerRequestedNonCompete?: boolean;
}

const iconMap: Record<string, LucideIcon> = {
  github: Github,
  domain: Globe,
  database: Database,
  apiKeys: Key,
  designFiles: Palette,
  documentation: FileText,
};

// Domain registrar info for auto-generating instructions
interface DomainRegistrarInfo {
  id: string;
  name: string;
  patterns: RegExp[];
  instructions: string[];
}

const DOMAIN_REGISTRARS: DomainRegistrarInfo[] = [
  {
    id: "godaddy",
    name: "GoDaddy",
    patterns: [/godaddy\.com/i],
    instructions: [
      "Log into your GoDaddy account",
      "Go to Domain Portfolio and select your domain",
      "Click 'Transfer' > 'Transfer domain to another GoDaddy account'",
      "Enter the buyer's GoDaddy email or customer number",
      "Confirm and share the authorization link with the buyer",
    ],
  },
  {
    id: "namecheap",
    name: "Namecheap",
    patterns: [/namecheap\.com/i],
    instructions: [
      "Log into your Namecheap account",
      "Go to Domain List and select your domain",
      "Under 'Sharing & Transfer', click 'Transfer Out'",
      "Unlock the domain and get the EPP code",
      "Share the EPP code securely with the buyer",
    ],
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    patterns: [/cloudflare\.com/i, /dash\.cloudflare\.com/i],
    instructions: [
      "Log into your Cloudflare dashboard",
      "Go to Domain Registration and select your domain",
      "Click 'Configuration' > 'Transfer Out'",
      "Unlock the domain and request the auth code",
      "Share the auth code securely with the buyer",
    ],
  },
  {
    id: "google",
    name: "Google Domains / Squarespace",
    patterns: [/domains\.google/i, /squarespace\.com/i],
    instructions: [
      "Go to domains.google.com or Squarespace Domains",
      "Select your domain and click 'Manage'",
      "Go to 'Registration settings'",
      "Unlock the domain and get the transfer code",
      "Share the authorization code securely with the buyer",
    ],
  },
  {
    id: "porkbun",
    name: "Porkbun",
    patterns: [/porkbun\.com/i],
    instructions: [
      "Log into your Porkbun account",
      "Go to Domain Management and select your domain",
      "Click 'Get Auth Code' to reveal the EPP code",
      "Ensure the domain is unlocked for transfer",
      "Share the auth code with the buyer",
    ],
  },
];

const GENERIC_INSTRUCTIONS = [
  "Log into your domain registrar account",
  "Navigate to your domain's settings page",
  "Look for 'Transfer' or 'Transfer Out' options",
  "Unlock the domain if it's locked",
  "Request or copy the EPP/Authorization code",
  "Share the transfer link and auth code with the buyer",
];

// Parse domain evidence JSON
interface DomainTransferEvidence {
  transferLink?: string;
  authCode?: string;
  registrar?: string;
  notes?: string;
}

function parseDomainEvidence(evidence: string | null): DomainTransferEvidence | null {
  if (!evidence) return null;
  try {
    const parsed = JSON.parse(evidence);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as DomainTransferEvidence;
    }
  } catch {
    // Not JSON, return as notes
    return { notes: evidence };
  }
  return null;
}

function detectRegistrar(url: string): DomainRegistrarInfo | null {
  return DOMAIN_REGISTRARS.find((r) =>
    r.patterns.some((p) => p.test(url))
  ) || null;
}

export default function TransferPage() {
  const params = useParams();
  const router = useRouter();
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [evidence, setEvidence] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completingTransfer, setCompletingTransfer] = useState(false);

  // Domain transfer form state
  const [domainTransferLink, setDomainTransferLink] = useState("");
  const [domainAuthCode, setDomainAuthCode] = useState("");
  const [domainNotes, setDomainNotes] = useState("");
  const [showAuthCode, setShowAuthCode] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [detectedRegistrar, setDetectedRegistrar] = useState<DomainRegistrarInfo | null>(null);

  // Messaging state
  const [startingConversation, setStartingConversation] = useState(false);

  // Agreement signing state
  const [signingAPA, setSigningAPA] = useState(false);
  const [signingNonCompete, setSigningNonCompete] = useState(false);
  const [requestingAPA, setRequestingAPA] = useState(false);
  const [requestingNonCompete, setRequestingNonCompete] = useState(false);

  // PATO state
  const [showPATOModal, setShowPATOModal] = useState(false);
  const [tokenLaunch, setTokenLaunch] = useState<any>(null);
  const [tokenLaunchLoading, setTokenLaunchLoading] = useState(false);

  useEffect(() => {
    fetchTransfer();
  }, [params.id]);

  const fetchTransfer = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/transfers/${params.id}`, {
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (res.status === 404) {
          setError("Transfer not found");
          return;
        }
        throw new Error("Failed to fetch transfer");
      }

      const data = await res.json();
      setTransfer(data);
    } catch (err) {
      console.error("Error fetching transfer:", err);
      setError("Failed to load transfer details");
    } finally {
      setLoading(false);
    }
  };

  // Fetch existing PATO token launch for this transaction
  const fetchTokenLaunch = useCallback(async () => {
    if (!params.id) return;
    setTokenLaunchLoading(true);
    try {
      const res = await fetch(`/api/token-launch?transactionId=${params.id}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.tokenLaunches?.length > 0) {
          setTokenLaunch(data.tokenLaunches[0]);
        }
      }
    } catch (err) {
      console.error("Error fetching token launch:", err);
    } finally {
      setTokenLaunchLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    if (transfer?.status === "COMPLETED" && transfer?.isBuyer) {
      fetchTokenLaunch();
    }
  }, [transfer?.status, transfer?.isBuyer, fetchTokenLaunch]);

  // Handle domain transfer link changes for registrar detection
  const handleDomainLinkChange = useCallback((value: string) => {
    setDomainTransferLink(value);
    setLinkError(null);

    if (value.trim()) {
      const registrar = detectRegistrar(value);
      setDetectedRegistrar(registrar);
    } else {
      setDetectedRegistrar(null);
    }
  }, []);

  // Copy to clipboard helper
  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Handle messaging the other party - navigate to messages with recipient context
  const handleMessageParty = () => {
    if (!transfer) return;
    const recipientId = transfer.isSeller ? transfer.buyer.id : transfer.seller.id;
    router.push(`/dashboard/messages?new=${recipientId}&listing=${transfer.listing.id}`);
  };

  const handleSellerConfirm = async (itemId: string) => {
    // Handle domain transfers differently
    if (itemId === "domain") {
      if (!domainTransferLink.trim() && !domainAuthCode.trim()) {
        setLinkError("Please provide a transfer link or auth code");
        return;
      }

      setIsSubmitting(true);
      try {
        const res = await fetch(`/api/transfers/${params.id}/seller-confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            itemId,
            transferLink: domainTransferLink.trim() || undefined,
            authCode: domainAuthCode.trim() || undefined,
            notes: domainNotes.trim() || undefined,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setLinkError(data.error || "Failed to confirm transfer");
          if (data.suggestions) {
            setLinkError(`${data.error}\n\nSuggestions:\n${data.suggestions.join("\n")}`);
          }
          return;
        }

        // Refresh transfer data and reset form
        await fetchTransfer();
        setSelectedItem(null);
        setDomainTransferLink("");
        setDomainAuthCode("");
        setDomainNotes("");
        setDetectedRegistrar(null);
        setLinkError(null);
      } catch (err: unknown) {
        console.error("Error confirming transfer:", err);
        setLinkError(err instanceof Error ? err.message : "Failed to confirm transfer");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Handle non-domain items
    if (!evidence.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/transfers/${params.id}/seller-confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ itemId, evidence }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to confirm transfer");
      }

      // Refresh transfer data
      await fetchTransfer();
      setSelectedItem(null);
      setEvidence("");
    } catch (err: unknown) {
      console.error("Error confirming transfer:", err);
      alert(err instanceof Error ? err.message : "Failed to confirm transfer");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBuyerConfirm = async (itemId: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/transfers/${params.id}/buyer-confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ itemId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to confirm receipt");
      }

      // Refresh transfer data
      await fetchTransfer();
    } catch (err: unknown) {
      console.error("Error confirming receipt:", err);
      alert(err instanceof Error ? err.message : "Failed to confirm receipt");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteTransfer = async () => {
    if (!confirm("Are you sure you want to release escrow funds to the seller? This action cannot be undone.")) {
      return;
    }

    setCompletingTransfer(true);
    try {
      const res = await fetch(`/api/transfers/${params.id}/complete`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to complete transfer");
      }

      // Refresh transfer data
      await fetchTransfer();
      alert("Transfer completed successfully! Funds have been released to the seller.");
    } catch (err: unknown) {
      console.error("Error completing transfer:", err);
      alert(err instanceof Error ? err.message : "Failed to complete transfer");
    } finally {
      setCompletingTransfer(false);
    }
  };

  const handleBuyerDispute = async (itemId: string) => {
    router.push(`/dashboard/disputes/new?transaction=${params.id}&item=${itemId}`);
  };

  // Agreement signing handlers
  const handleSignAPA = async () => {
    if (!confirm("By signing this Asset Purchase Agreement, you agree to transfer all rights and ownership of the listed assets to the buyer. Continue?")) {
      return;
    }

    setSigningAPA(true);
    try {
      const res = await fetch(`/api/transfers/${params.id}/sign-apa`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to sign APA");
      }

      await fetchTransfer();
      alert("Asset Purchase Agreement signed successfully!");
    } catch (err) {
      console.error("Error signing APA:", err);
      alert(err instanceof Error ? err.message : "Failed to sign APA");
    } finally {
      setSigningAPA(false);
    }
  };

  const handleSignNonCompete = async () => {
    const duration = transfer?.listing.nonCompeteDurationYears || 2;
    if (!confirm(`By signing this Non-Compete Agreement, you agree not to create a competing product for ${duration} year(s). Continue?`)) {
      return;
    }

    setSigningNonCompete(true);
    try {
      const res = await fetch(`/api/transfers/${params.id}/sign-non-compete`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to sign Non-Compete");
      }

      await fetchTransfer();
      alert("Non-Compete Agreement signed successfully!");
    } catch (err) {
      console.error("Error signing Non-Compete:", err);
      alert(err instanceof Error ? err.message : "Failed to sign Non-Compete");
    } finally {
      setSigningNonCompete(false);
    }
  };

  const handleRequestAPA = async () => {
    if (!confirm("Request the seller to sign an Asset Purchase Agreement? This protects your purchase by legally transferring ownership.")) {
      return;
    }

    setRequestingAPA(true);
    try {
      const res = await fetch(`/api/transfers/${params.id}/request-apa`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to request APA");
      }

      await fetchTransfer();
      alert("APA request sent to seller!");
    } catch (err) {
      console.error("Error requesting APA:", err);
      alert(err instanceof Error ? err.message : "Failed to request APA");
    } finally {
      setRequestingAPA(false);
    }
  };

  const handleRequestNonCompete = async () => {
    if (!confirm("Request the seller to sign a Non-Compete Agreement? This protects you from the seller creating a competing product.")) {
      return;
    }

    setRequestingNonCompete(true);
    try {
      const res = await fetch(`/api/transfers/${params.id}/request-non-compete`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to request Non-Compete");
      }

      await fetchTransfer();
      alert("Non-Compete request sent to seller!");
    } catch (err) {
      console.error("Error requesting Non-Compete:", err);
      alert(err instanceof Error ? err.message : "Failed to request Non-Compete");
    } finally {
      setRequestingNonCompete(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error || !transfer) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            {error || "Transfer not found"}
          </h1>
          <Link href="/dashboard" className="text-green-600 hover:underline">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const isSeller = transfer.isSeller;
  const isBuyer = transfer.isBuyer;

  const requiredItems = transfer.checklist.filter((item) => item.required);
  const completedItems = requiredItems.filter(
    (item) => item.sellerConfirmed && item.buyerConfirmed
  ).length;

  const deadlineDate = new Date(transfer.transferDeadline);
  const isDeadlineExpired = new Date() > deadlineDate;
  const timeLeft = isDeadlineExpired
    ? "Deadline passed"
    : formatDistanceToNow(deadlineDate, { addSuffix: false });

  const allConfirmed = transfer.checklist
    .filter((item) => item.required)
    .every((item) => item.sellerConfirmed && item.buyerConfirmed);

  const isCompleted = transfer.status === "COMPLETED";
  const isRefunded = transfer.status === "REFUNDED";
  const isDisputed = transfer.status === "DISPUTED";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="container-wide py-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-semibold text-zinc-900 dark:text-zinc-100">
                Transfer: {transfer.listing.title}
              </h1>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                {isCompleted
                  ? "Transfer completed successfully"
                  : "Complete the asset transfer to release escrow funds"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                isCompleted
                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                  : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
              }`}>
                {isSeller ? "Seller" : "Buyer"} View
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="container-wide py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Progress */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Transfer Progress
                </h2>
                <span className="text-sm text-zinc-500">
                  {completedItems}/{requiredItems.length} items confirmed
                </span>
              </div>
              <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${requiredItems.length > 0 ? (completedItems / requiredItems.length) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="mt-4 flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-zinc-600 dark:text-zinc-400">Confirmed by both</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="text-zinc-600 dark:text-zinc-400">Awaiting confirmation</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                  <span className="text-zinc-600 dark:text-zinc-400">Pending</span>
                </div>
              </div>
            </div>

            {/* Security Notice for Buyers */}
            {isBuyer && !isCompleted && (
              <SecurityNotice variant="warning" />
            )}

            {/* Checklist */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Transfer Checklist
                </h2>
                <p className="text-sm text-zinc-500 mt-1">
                  {isSeller
                    ? "Mark items as transferred, then buyer will confirm receipt"
                    : "Confirm receipt of each item once you've verified it"}
                </p>
              </div>

              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {transfer.checklist.filter((item) => item.required).map((item) => {
                  const Icon = iconMap[item.iconType] || FileText;
                  const isComplete = item.sellerConfirmed && item.buyerConfirmed;
                  const awaitingBuyer = item.sellerConfirmed && !item.buyerConfirmed;
                  const awaitingSeller = !item.sellerConfirmed;

                  return (
                    <div key={item.id} className="p-4">
                      <div className="flex items-start gap-4">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            isComplete
                              ? "bg-green-100 dark:bg-green-900/30 text-green-600"
                              : awaitingBuyer
                              ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600"
                              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {isComplete ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : (
                            <Icon className="w-5 h-5" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                              {item.label}
                            </h3>
                            {item.required && (
                              <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                Required
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-zinc-500 mt-0.5">
                            {item.description}
                          </p>

                          {/* Status & Evidence */}
                          <div className="mt-3 space-y-2">
                            {item.sellerConfirmed && item.id === "domain" && (() => {
                              const domainData = parseDomainEvidence(item.sellerEvidence);
                              if (domainData) {
                                return (
                                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 space-y-2">
                                    <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-300">
                                      <CheckCircle2 className="w-4 h-4" />
                                      Domain Transfer Details
                                      {domainData.registrar && (
                                        <span className="text-xs px-2 py-0.5 rounded bg-green-100 dark:bg-green-800/50">
                                          {domainData.registrar}
                                        </span>
                                      )}
                                    </div>
                                    {domainData.transferLink && (
                                      <div className="flex items-center gap-2">
                                        <LinkIcon className="w-3.5 h-3.5 text-zinc-500" />
                                        <a
                                          href={domainData.transferLink}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[300px]"
                                        >
                                          {domainData.transferLink}
                                        </a>
                                        <button
                                          onClick={() => copyToClipboard(domainData.transferLink!, "link")}
                                          className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
                                          title="Copy link"
                                        >
                                          {copiedField === "link" ? (
                                            <Check className="w-3.5 h-3.5 text-green-500" />
                                          ) : (
                                            <Copy className="w-3.5 h-3.5 text-zinc-400" />
                                          )}
                                        </button>
                                        <a
                                          href={domainData.transferLink}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
                                          title="Open link"
                                        >
                                          <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                                        </a>
                                      </div>
                                    )}
                                    {domainData.authCode && (
                                      <div className="flex items-center gap-2">
                                        <Key className="w-3.5 h-3.5 text-zinc-500" />
                                        <code className="text-sm bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded font-mono">
                                          {showAuthCode ? domainData.authCode : "••••••••••••"}
                                        </code>
                                        <button
                                          onClick={() => setShowAuthCode(!showAuthCode)}
                                          className="text-xs text-blue-600 hover:underline"
                                        >
                                          {showAuthCode ? "Hide" : "Show"}
                                        </button>
                                        <button
                                          onClick={() => copyToClipboard(domainData.authCode!, "authCode")}
                                          className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
                                          title="Copy auth code"
                                        >
                                          {copiedField === "authCode" ? (
                                            <Check className="w-3.5 h-3.5 text-green-500" />
                                          ) : (
                                            <Copy className="w-3.5 h-3.5 text-zinc-400" />
                                          )}
                                        </button>
                                      </div>
                                    )}
                                    {domainData.notes && (
                                      <div className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                                        <span className="font-medium">Notes:</span> {domainData.notes}
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              return null;
                            })()}
                            {item.sellerConfirmed && item.id !== "domain" && (
                              <div className="flex items-start gap-2 text-sm">
                                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                                <div>
                                  <span className="text-zinc-600 dark:text-zinc-400">
                                    Seller confirmed:
                                  </span>
                                  <span className="ml-1 text-zinc-900 dark:text-zinc-100">
                                    {item.sellerEvidence}
                                  </span>
                                </div>
                              </div>
                            )}
                            {item.buyerConfirmed && (
                              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Buyer confirmed receipt</span>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          {!isCompleted && !isRefunded && (
                            <div className="mt-4 flex items-center gap-3">
                              {/* Seller Actions */}
                              {isSeller && awaitingSeller && !isDeadlineExpired && (
                                <button
                                  onClick={() => setSelectedItem(item.id)}
                                  className="btn-primary text-sm py-2"
                                >
                                  Submit Transfer Details
                                </button>
                              )}
                              {isSeller && awaitingSeller && isDeadlineExpired && (
                                <span className="text-sm text-red-600 dark:text-red-400">
                                  Deadline passed - transfer actions disabled
                                </span>
                              )}

                              {/* Buyer Actions */}
                              {isBuyer && awaitingBuyer && (
                                <>
                                  <button
                                    onClick={() => handleBuyerConfirm(item.id)}
                                    disabled={isSubmitting}
                                    className="btn-success text-sm py-2"
                                  >
                                    {isSubmitting ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="w-4 h-4" />
                                    )}
                                    Confirm Receipt
                                  </button>
                                  <button
                                    onClick={() => handleBuyerDispute(item.id)}
                                    className="btn-outline text-sm py-2 text-red-600 border-red-300 hover:bg-red-50"
                                  >
                                    <Flag className="w-4 h-4" />
                                    Dispute
                                  </button>
                                </>
                              )}

                              {isComplete && (
                                <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                                  ✓ Complete
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Seller Evidence Modal - Domain Transfer */}
                      {selectedItem === item.id && item.id === "domain" && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="mt-4 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl space-y-4"
                        >
                          {/* Auto-generated Instructions */}
                          <div className="border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
                            <button
                              onClick={() => setShowInstructions(!showInstructions)}
                              className="w-full flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                                  {detectedRegistrar
                                    ? `${detectedRegistrar.name} Transfer Instructions`
                                    : "Domain Transfer Instructions"}
                                </span>
                              </div>
                              {showInstructions ? (
                                <ChevronUp className="w-4 h-4 text-blue-600" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-blue-600" />
                              )}
                            </button>
                            <AnimatePresence>
                              {showInstructions && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <ol className="p-3 space-y-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                                    {(detectedRegistrar?.instructions || GENERIC_INSTRUCTIONS).map(
                                      (instruction, idx) => (
                                        <li key={idx} className="flex gap-2">
                                          <span className="font-medium text-blue-600 dark:text-blue-400 min-w-[20px]">
                                            {idx + 1}.
                                          </span>
                                          <span>{instruction}</span>
                                        </li>
                                      )
                                    )}
                                  </ol>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          {/* Transfer Link Field */}
                          <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                              <LinkIcon className="w-4 h-4" />
                              Domain Transfer Link
                              <span className="text-xs font-normal text-zinc-500">(from your registrar)</span>
                            </label>
                            <div className="relative">
                              <input
                                type="url"
                                value={domainTransferLink}
                                onChange={(e) => handleDomainLinkChange(e.target.value)}
                                placeholder="https://godaddy.com/... or https://namecheap.com/..."
                                className={`input-field pr-10 ${
                                  linkError && !domainAuthCode ? "border-red-300 dark:border-red-700" : ""
                                }`}
                              />
                              {detectedRegistrar && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                  <span className="text-xs px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                    {detectedRegistrar.name}
                                  </span>
                                </div>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-zinc-500">
                              Paste the transfer or authorization link from your domain registrar
                            </p>
                          </div>

                          {/* Auth/EPP Code Field */}
                          <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                              <Key className="w-4 h-4" />
                              EPP / Authorization Code
                              <span className="text-xs font-normal text-zinc-500">(if required)</span>
                            </label>
                            <div className="relative">
                              <input
                                type={showAuthCode ? "text" : "password"}
                                value={domainAuthCode}
                                onChange={(e) => setDomainAuthCode(e.target.value)}
                                placeholder="Enter EPP/Auth code"
                                className="input-field pr-20"
                              />
                              <button
                                type="button"
                                onClick={() => setShowAuthCode(!showAuthCode)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                              >
                                {showAuthCode ? "Hide" : "Show"}
                              </button>
                            </div>
                            <p className="mt-1 text-xs text-zinc-500">
                              The EPP code is required for most domain transfers between registrars
                            </p>
                          </div>

                          {/* Additional Notes Field */}
                          <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                              <FileText className="w-4 h-4" />
                              Additional Notes
                              <span className="text-xs font-normal text-zinc-500">(optional)</span>
                            </label>
                            <textarea
                              value={domainNotes}
                              onChange={(e) => setDomainNotes(e.target.value)}
                              placeholder="Any additional instructions or information for the buyer..."
                              className="input-field min-h-[60px] resize-y"
                              rows={2}
                            />
                          </div>

                          {/* Error Display */}
                          {linkError && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                              <div className="flex gap-2 text-sm text-red-700 dark:text-red-300">
                                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <p className="whitespace-pre-wrap">{linkError}</p>
                              </div>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex items-center gap-3 pt-2">
                            <button
                              onClick={() => handleSellerConfirm(item.id)}
                              disabled={
                                (!domainTransferLink.trim() && !domainAuthCode.trim()) ||
                                isSubmitting
                              }
                              className="btn-success text-sm py-2"
                            >
                              {isSubmitting ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Confirming...
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-4 h-4" />
                                  Confirm Domain Transfer
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setSelectedItem(null);
                                setDomainTransferLink("");
                                setDomainAuthCode("");
                                setDomainNotes("");
                                setLinkError(null);
                                setDetectedRegistrar(null);
                              }}
                              className="btn-secondary text-sm py-2"
                            >
                              Cancel
                            </button>
                          </div>
                        </motion.div>
                      )}

                      {/* Seller Evidence Modal - Other Items */}
                      {selectedItem === item.id && item.id !== "domain" && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="mt-4 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl"
                        >
                          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                            Describe what was transferred / provide evidence
                          </label>
                          <textarea
                            value={evidence}
                            onChange={(e) => setEvidence(e.target.value)}
                            placeholder="e.g., 'Repository transferred to @buyerusername' or 'Auth code sent via email'"
                            className="input-field min-h-[80px] resize-y"
                          />
                          <div className="mt-3 flex items-center gap-3">
                            <button
                              onClick={() => handleSellerConfirm(item.id)}
                              disabled={!evidence.trim() || isSubmitting}
                              className="btn-success text-sm py-2"
                            >
                              {isSubmitting ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Confirming...
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-4 h-4" />
                                  Confirm Transfer
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setSelectedItem(null);
                                setEvidence("");
                              }}
                              className="btn-secondary text-sm py-2"
                            >
                              Cancel
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Complete Transfer Button */}
            {allConfirmed && isBuyer && !isCompleted && (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-200 dark:border-green-800 p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
                      All items confirmed!
                    </h3>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      Click below to finalize the transfer and release funds to the seller.
                    </p>
                    <button
                      onClick={handleCompleteTransfer}
                      disabled={completingTransfer}
                      className="btn-success mt-4"
                    >
                      {completingTransfer ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Shield className="w-5 h-5" />
                          Release Escrow & Complete Transfer
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Transfer Completed */}
            {isCompleted && (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-200 dark:border-green-800 p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
                      Transfer Completed!
                    </h3>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      {isSeller
                        ? `Congratulations! ${transfer.sellerProceeds} ${transfer.currency} has been released to your wallet.`
                        : "The transfer is complete. Enjoy your new acquisition!"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* PATO Launch CTA - Buyer only, after transfer completed, no existing launch */}
            {isCompleted && isBuyer && !tokenLaunch && !tokenLaunchLoading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-2xl border border-green-200 dark:border-green-800/50 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-green-900/20 dark:via-emerald-900/20 dark:to-teal-900/20 p-6"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-200/40 to-emerald-300/40 dark:from-green-800/20 dark:to-emerald-800/20 rounded-full -translate-y-8 translate-x-8" />
                <div className="relative flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                    <Rocket className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      Launch a Token
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                      Deploy a token for <span className="font-medium">{transfer.listing.title}</span> on a Meteora bonding curve.
                      Earn trading fees in perpetuity.
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1.5">
                      Post-Acquisition Token Offering (PATO)
                    </p>
                    <button
                      onClick={() => setShowPATOModal(true)}
                      className="mt-4 inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 text-white font-medium rounded-full transition-all duration-300 hover:from-green-600 hover:via-emerald-600 hover:to-teal-600 hover:scale-105 active:scale-95 text-sm"
                    >
                      <Rocket className="w-4 h-4" />
                      Launch Token
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Transaction Summary */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Transaction Summary
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Sale Price</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {transfer.salePrice} {transfer.currency}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">
                    Platform Fee ({transfer.currency === "APP" ? "3%" : "5%"})
                  </span>
                  <span className="text-zinc-900 dark:text-zinc-100">
                    -{transfer.platformFee} {transfer.currency}
                  </span>
                </div>
                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      Seller Proceeds
                    </span>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      {transfer.sellerProceeds} {transfer.currency}
                    </span>
                  </div>
                </div>
              </div>

              {transfer.escrowAddress && (
                <div className="mt-6 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="w-4 h-4 text-green-500" />
                    <span className="text-zinc-600 dark:text-zinc-400">
                      {isCompleted ? "Funds released" : "Funds held in escrow"}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1 font-mono">
                    {transfer.escrowAddress}
                  </p>
                </div>
              )}
            </div>

            {/* PATO Status Card */}
            {tokenLaunch && (
              <PATOStatusCard tokenLaunch={tokenLaunch} isBuyer={isBuyer} />
            )}

            {/* Legal Agreements Section */}
            {(transfer.listing.offersAPA || transfer.listing.offersNonCompete || transfer.buyerRequestedAPA || transfer.buyerRequestedNonCompete) && (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Scale className="w-5 h-5 text-indigo-500" />
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                    Legal Agreements
                  </h3>
                </div>
                <div className="space-y-4">
                  {/* APA Section */}
                  {(transfer.listing.offersAPA || transfer.buyerRequestedAPA) && (
                    <div className={`p-3 rounded-lg border ${
                      transfer.apaSigned
                        ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                        : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileCheck className={`w-4 h-4 ${transfer.apaSigned ? "text-green-600" : "text-zinc-500"}`} />
                          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            Asset Purchase Agreement
                          </span>
                        </div>
                        {transfer.apaSigned ? (
                          <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                            <CheckCircle2 className="w-3 h-3" />
                            Signed
                          </span>
                        ) : transfer.buyerRequestedAPA ? (
                          <span className="text-xs text-amber-600 dark:text-amber-400">
                            Requested by buyer
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-500">
                            Offered by seller
                          </span>
                        )}
                      </div>
                      {!transfer.apaSigned && isSeller && (transfer.listing.offersAPA || transfer.buyerRequestedAPA) && (
                        <button
                          onClick={handleSignAPA}
                          disabled={signingAPA}
                          className="mt-3 w-full btn-primary text-sm py-2 justify-center"
                        >
                          {signingAPA ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Signing...
                            </>
                          ) : (
                            <>
                              <PenTool className="w-4 h-4" />
                              Sign APA
                            </>
                          )}
                        </button>
                      )}
                      {transfer.apaSigned && transfer.apaSignedAt && (
                        <p className="text-xs text-zinc-500 mt-2">
                          Signed {formatDistanceToNow(new Date(transfer.apaSignedAt), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Non-Compete Section */}
                  {(transfer.listing.offersNonCompete || transfer.buyerRequestedNonCompete) && (
                    <div className={`p-3 rounded-lg border ${
                      transfer.nonCompeteSigned
                        ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                        : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Shield className={`w-4 h-4 ${transfer.nonCompeteSigned ? "text-green-600" : "text-zinc-500"}`} />
                          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            Non-Compete ({transfer.listing.nonCompeteDurationYears || 2} years)
                          </span>
                        </div>
                        {transfer.nonCompeteSigned ? (
                          <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                            <CheckCircle2 className="w-3 h-3" />
                            Signed
                          </span>
                        ) : transfer.buyerRequestedNonCompete ? (
                          <span className="text-xs text-amber-600 dark:text-amber-400">
                            Requested by buyer
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-500">
                            Offered by seller
                          </span>
                        )}
                      </div>
                      {!transfer.nonCompeteSigned && isSeller && (transfer.listing.offersNonCompete || transfer.buyerRequestedNonCompete) && (
                        <button
                          onClick={handleSignNonCompete}
                          disabled={signingNonCompete}
                          className="mt-3 w-full btn-primary text-sm py-2 justify-center"
                        >
                          {signingNonCompete ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Signing...
                            </>
                          ) : (
                            <>
                              <PenTool className="w-4 h-4" />
                              Sign Non-Compete
                            </>
                          )}
                        </button>
                      )}
                      {transfer.nonCompeteSigned && transfer.nonCompeteSignedAt && (
                        <p className="text-xs text-zinc-500 mt-2">
                          Signed {formatDistanceToNow(new Date(transfer.nonCompeteSignedAt), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Buyer Request Agreements Section - Only show to buyer when seller didn't offer */}
            {isBuyer && !isCompleted && !isRefunded && (
              (!transfer.listing.offersAPA && !transfer.buyerRequestedAPA) ||
              (!transfer.listing.offersNonCompete && !transfer.buyerRequestedNonCompete)
            ) && (
              <div className="bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-200 dark:border-indigo-800 p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Scale className="w-5 h-5 text-indigo-500" />
                  <h3 className="font-semibold text-indigo-800 dark:text-indigo-200">
                    Request Agreements
                  </h3>
                </div>
                <p className="text-sm text-indigo-700 dark:text-indigo-300 mb-4">
                  The seller hasn't offered these agreements, but you can request them for additional protection.
                </p>
                <div className="space-y-2">
                  {!transfer.listing.offersAPA && !transfer.buyerRequestedAPA && !transfer.apaSigned && (
                    <button
                      onClick={handleRequestAPA}
                      disabled={requestingAPA}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-50"
                    >
                      {requestingAPA ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Requesting...
                        </>
                      ) : (
                        <>
                          <FileCheck className="w-4 h-4" />
                          Request Asset Purchase Agreement
                        </>
                      )}
                    </button>
                  )}
                  {!transfer.listing.offersNonCompete && !transfer.buyerRequestedNonCompete && !transfer.nonCompeteSigned && (
                    <button
                      onClick={handleRequestNonCompete}
                      disabled={requestingNonCompete}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-50"
                    >
                      {requestingNonCompete ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Requesting...
                        </>
                      ) : (
                        <>
                          <Shield className="w-4 h-4" />
                          Request Non-Compete Agreement
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Deadline */}
            {!isCompleted && !isRefunded && (
              <div className={`rounded-2xl border p-6 ${
                isDeadlineExpired
                  ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                  : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
              }`}>
                <div className="flex items-center gap-3 mb-3">
                  <Clock className={`w-5 h-5 ${isDeadlineExpired ? "text-red-600" : "text-yellow-600"}`} />
                  <h3 className={`font-semibold ${
                    isDeadlineExpired
                      ? "text-red-800 dark:text-red-200"
                      : "text-yellow-800 dark:text-yellow-200"
                  }`}>
                    Transfer Deadline
                  </h3>
                </div>
                <p className={`text-2xl font-display font-semibold ${
                  isDeadlineExpired
                    ? "text-red-900 dark:text-red-100"
                    : "text-yellow-900 dark:text-yellow-100"
                }`}>
                  {isDeadlineExpired ? "Deadline Passed" : `${timeLeft} left`}
                </p>
                <p className={`text-sm mt-2 ${
                  isDeadlineExpired
                    ? "text-red-700 dark:text-red-300"
                    : "text-yellow-700 dark:text-yellow-300"
                }`}>
                  {isDeadlineExpired
                    ? isSeller
                      ? "The transfer deadline has passed. The buyer may open a dispute for a refund."
                      : "The transfer deadline has passed. You can open a dispute to request a refund."
                    : isSeller
                      ? "Complete all transfers before the deadline to receive payment."
                      : "If seller doesn't complete transfer, you can dispute."}
                </p>
              </div>
            )}

            {/* Refunded Status */}
            {isRefunded && (
              <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <AlertCircle className="w-5 h-5 text-zinc-600" />
                  <h3 className="font-semibold text-zinc-800 dark:text-zinc-200">
                    Transaction Refunded
                  </h3>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  This transaction has been refunded to the buyer.
                </p>
              </div>
            )}

            {/* Parties */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Parties
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-zinc-500 mb-1">Seller</div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                      <span className="text-xs font-medium text-white">
                        {transfer.seller.name[0].toUpperCase()}
                      </span>
                    </div>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {transfer.seller.name}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-zinc-500 mb-1">Buyer</div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                      <span className="text-xs font-medium text-white">
                        {transfer.buyer.name[0].toUpperCase()}
                      </span>
                    </div>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {transfer.buyer.name}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Communication */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                Communication
              </h3>
              <p className="text-sm text-zinc-500 mb-4">
                Message the {isSeller ? "buyer" : "seller"} directly about this transfer.
              </p>
              <button
                onClick={handleMessageParty}
                disabled={startingConversation}
                className="w-full btn-primary text-sm py-2 justify-center"
              >
                {startingConversation ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-4 h-4" />
                    Message {isSeller ? "Buyer" : "Seller"}
                  </>
                )}
              </button>
            </div>

            {/* Help */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                Need Help?
              </h3>
              <p className="text-sm text-zinc-500 mb-4">
                Having issues with the transfer? Contact support or open a dispute.
              </p>
              <div className="space-y-2">
                <a
                  href={`mailto:support@appmarket.com?subject=${encodeURIComponent(`Transfer Issue - ${transfer.listing.title}`)}&body=${encodeURIComponent(`Transaction ID: ${transfer.id}`)}`}
                  className="w-full btn-secondary text-sm py-2 justify-center flex items-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  Contact Support
                </a>
                {!isCompleted && isBuyer && transfer.checklist.some(item => item.sellerConfirmed) && (
                  <button
                    onClick={() => router.push(`/dashboard/disputes/new?transaction=${transfer.id}`)}
                    className="w-full btn-outline text-sm py-2 justify-center text-red-600 border-red-300 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/20"
                  >
                    <Flag className="w-4 h-4" />
                    Open Dispute
                  </button>
                )}
                {!isCompleted && isBuyer && !transfer.checklist.some(item => item.sellerConfirmed) && (
                  <p className="text-xs text-zinc-400 text-center">
                    Dispute option becomes available once the seller begins transferring assets.
                    If the seller doesn&apos;t transfer before the deadline, you&apos;ll receive an automatic refund.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PATO Launch Modal */}
      <PATOLaunchModal
        isOpen={showPATOModal}
        onClose={() => setShowPATOModal(false)}
        transactionId={transfer.id}
        listingTitle={transfer.listing.title}
        onSuccess={(launch) => {
          setTokenLaunch(launch);
          setShowPATOModal(false);
          fetchTokenLaunch();
        }}
      />
    </div>
  );
}
