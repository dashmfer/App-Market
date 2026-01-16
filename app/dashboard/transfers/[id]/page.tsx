"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
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
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { LucideIcon } from "lucide-react";

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
}

const iconMap: Record<string, LucideIcon> = {
  github: Github,
  domain: Globe,
  database: Database,
  apiKeys: Key,
  designFiles: Palette,
  documentation: FileText,
};

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

  const handleSellerConfirm = async (itemId: string) => {
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

  const completedItems = transfer.checklist.filter(
    (item) => item.sellerConfirmed && item.buyerConfirmed
  ).length;

  const timeLeft = formatDistanceToNow(new Date(transfer.transferDeadline), { addSuffix: false });

  const allConfirmed = transfer.checklist
    .filter((item) => item.required)
    .every((item) => item.sellerConfirmed && item.buyerConfirmed);

  const isCompleted = transfer.status === "COMPLETED";

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
                  {completedItems}/{transfer.checklist.length} items confirmed
                </span>
              </div>
              <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${(completedItems / transfer.checklist.length) * 100}%`,
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
                {transfer.checklist.map((item) => {
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
                            {item.sellerConfirmed && (
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
                          {!isCompleted && (
                            <div className="mt-4 flex items-center gap-3">
                              {/* Seller Actions */}
                              {isSeller && awaitingSeller && (
                                <button
                                  onClick={() => setSelectedItem(item.id)}
                                  className="btn-primary text-sm py-2"
                                >
                                  Mark as Transferred
                                </button>
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

                      {/* Seller Evidence Modal */}
                      {selectedItem === item.id && (
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
                  <span className="text-zinc-500">Platform Fee (5%)</span>
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

            {/* Deadline */}
            {!isCompleted && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl border border-yellow-200 dark:border-yellow-800 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Clock className="w-5 h-5 text-yellow-600" />
                  <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
                    Transfer Deadline
                  </h3>
                </div>
                <p className="text-2xl font-display font-semibold text-yellow-900 dark:text-yellow-100">
                  {timeLeft} left
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-2">
                  {isSeller
                    ? "Complete all transfers before the deadline to receive payment."
                    : "If seller doesn't complete transfer, you can dispute."}
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

            {/* Help */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                Need Help?
              </h3>
              <p className="text-sm text-zinc-500 mb-4">
                Having issues with the transfer? Contact us or open a dispute.
              </p>
              <div className="space-y-2">
                <button className="w-full btn-secondary text-sm py-2 justify-center">
                  <MessageSquare className="w-4 h-4" />
                  Contact Support
                </button>
                {!isCompleted && (
                  <button
                    onClick={() => router.push(`/dashboard/disputes/new?transaction=${transfer.id}`)}
                    className="w-full btn-outline text-sm py-2 justify-center text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <Flag className="w-4 h-4" />
                    Open Dispute
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
