"use client";

import { useState } from "react";
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
  Upload,
  ExternalLink,
  Shield,
  MessageSquare,
  Flag,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// Mock transfer data
const mockTransfer = {
  id: "t1",
  listing: {
    id: "l1",
    title: "AI Recipe Generator",
    slug: "ai-recipe-generator",
  },
  salePrice: 45,
  platformFee: 2.25,
  sellerProceeds: 42.75,
  currency: "SOL",
  status: "TRANSFER_IN_PROGRESS",
  buyer: {
    id: "b1",
    name: "buyer1.sol",
    walletAddress: "7x...def",
  },
  seller: {
    id: "s1",
    name: "alex.sol",
    walletAddress: "9y...abc",
  },
  escrowAddress: "Es...xyz",
  createdAt: new Date(Date.now() - 86400000),
  transferDeadline: new Date(Date.now() + 86400000 * 6),
  checklist: [
    {
      id: "github",
      label: "GitHub Repository",
      description: "Transfer ownership of the repository to buyer",
      icon: Github,
      required: true,
      sellerConfirmed: true,
      sellerConfirmedAt: new Date(Date.now() - 3600000),
      sellerEvidence: "Transferred to @buyer1",
      buyerConfirmed: false,
      buyerConfirmedAt: null,
      verifiable: true,
      verified: true,
    },
    {
      id: "domain",
      label: "Domain",
      description: "Transfer domain ownership via registrar",
      icon: Globe,
      required: true,
      sellerConfirmed: true,
      sellerConfirmedAt: new Date(Date.now() - 1800000),
      sellerEvidence: "Transfer initiated, auth code sent",
      buyerConfirmed: false,
      buyerConfirmedAt: null,
      verifiable: true,
      verified: false,
    },
    {
      id: "database",
      label: "Database Access",
      description: "Provide database credentials and data export",
      icon: Database,
      required: true,
      sellerConfirmed: false,
      sellerConfirmedAt: null,
      sellerEvidence: null,
      buyerConfirmed: false,
      buyerConfirmedAt: null,
      verifiable: false,
      verified: false,
    },
    {
      id: "apiKeys",
      label: "API Keys & Credentials",
      description: "Share all necessary API keys and service credentials",
      icon: Key,
      required: true,
      sellerConfirmed: false,
      sellerConfirmedAt: null,
      sellerEvidence: null,
      buyerConfirmed: false,
      buyerConfirmedAt: null,
      verifiable: false,
      verified: false,
    },
    {
      id: "designFiles",
      label: "Design Files",
      description: "Share Figma/Sketch files",
      icon: Palette,
      required: false,
      sellerConfirmed: true,
      sellerConfirmedAt: new Date(Date.now() - 7200000),
      sellerEvidence: "Figma access shared",
      buyerConfirmed: true,
      buyerConfirmedAt: new Date(Date.now() - 3600000),
      verifiable: false,
      verified: false,
    },
    {
      id: "documentation",
      label: "Documentation",
      description: "Provide setup guides and documentation",
      icon: FileText,
      required: false,
      sellerConfirmed: true,
      sellerConfirmedAt: new Date(Date.now() - 7200000),
      sellerEvidence: "Docs in /docs folder",
      buyerConfirmed: true,
      buyerConfirmedAt: new Date(Date.now() - 3600000),
      verifiable: false,
      verified: false,
    },
  ],
};

type ViewMode = "seller" | "buyer";

export default function TransferPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("seller");
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [evidence, setEvidence] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const transfer = mockTransfer;
  const isSeller = viewMode === "seller";
  const isBuyer = viewMode === "buyer";

  const completedItems = transfer.checklist.filter(
    (item) => item.sellerConfirmed && item.buyerConfirmed
  ).length;
  const totalRequiredItems = transfer.checklist.filter((item) => item.required).length;
  const pendingSellerItems = transfer.checklist.filter(
    (item) => item.required && !item.sellerConfirmed
  ).length;
  const pendingBuyerItems = transfer.checklist.filter(
    (item) => item.required && item.sellerConfirmed && !item.buyerConfirmed
  ).length;

  const timeLeft = formatDistanceToNow(transfer.transferDeadline, { addSuffix: false });

  const handleSellerConfirm = async (itemId: string) => {
    setIsSubmitting(true);
    // API call to confirm
    await new Promise((r) => setTimeout(r, 1500));
    setIsSubmitting(false);
    setSelectedItem(null);
    setEvidence("");
  };

  const handleBuyerConfirm = async (itemId: string) => {
    setIsSubmitting(true);
    // API call to confirm
    await new Promise((r) => setTimeout(r, 1500));
    setIsSubmitting(false);
  };

  const handleBuyerDispute = async (itemId: string) => {
    // Navigate to dispute flow
  };

  const allConfirmed = transfer.checklist
    .filter((item) => item.required)
    .every((item) => item.sellerConfirmed && item.buyerConfirmed);

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
                Complete the asset transfer to release escrow funds
              </p>
            </div>
            
            {/* View Toggle (for demo) */}
            <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode("seller")}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === "seller"
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400"
                }`}
              >
                Seller View
              </button>
              <button
                onClick={() => setViewMode("buyer")}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === "buyer"
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400"
                }`}
              >
                Buyer View
              </button>
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
                  const Icon = item.icon;
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
                            {item.verified && (
                              <span className="text-xs px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                ✓ Verified
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
                                  className="btn-success text-sm py-2"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
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
            {allConfirmed && isBuyer && (
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
                    <button className="btn-success mt-4">
                      <Shield className="w-5 h-5" />
                      Release Escrow & Complete Transfer
                    </button>
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

              <div className="mt-6 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="w-4 h-4 text-green-500" />
                  <span className="text-zinc-600 dark:text-zinc-400">
                    Funds held in escrow
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-1 font-mono">
                  {transfer.escrowAddress}
                </p>
              </div>
            </div>

            {/* Deadline */}
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
                <button className="w-full btn-outline text-sm py-2 justify-center text-red-600 border-red-300 hover:bg-red-50">
                  <Flag className="w-4 h-4" />
                  Open Dispute
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
