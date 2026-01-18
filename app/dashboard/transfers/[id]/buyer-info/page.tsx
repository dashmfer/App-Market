"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Github,
  Globe,
  Mail,
  Wallet,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Info,
} from "lucide-react";

interface RequiredInfoItem {
  required: boolean;
  description?: string;
}

interface RequiredBuyerInfo {
  github?: RequiredInfoItem;
  domain?: RequiredInfoItem;
  email?: RequiredInfoItem;
  walletAddress?: RequiredInfoItem;
  other?: RequiredInfoItem;
}

interface BuyerInfoData {
  requiredInfo: RequiredBuyerInfo | null;
  providedInfo: Record<string, string> | null;
  status: "PENDING" | "PROVIDED" | "DEADLINE_PASSED";
  deadline: string | null;
  timeRemaining: number | null;
  submittedAt: string | null;
  isBuyer: boolean;
  isSeller: boolean;
}

const FIELD_CONFIG = {
  github: {
    icon: Github,
    label: "GitHub Username",
    placeholder: "e.g., octocat",
    helpText: "Your GitHub username for repository transfer",
  },
  domain: {
    icon: Globe,
    label: "Domain Registrar Info",
    placeholder: "e.g., GoDaddy account email or customer ID",
    helpText: "Your registrar account details for domain push",
  },
  email: {
    icon: Mail,
    label: "Email Address",
    placeholder: "your@email.com",
    helpText: "Email for receiving credentials or instructions",
  },
  walletAddress: {
    icon: Wallet,
    label: "Wallet Address",
    placeholder: "Your wallet address",
    helpText: "For receiving on-chain assets or admin rights",
  },
  other: {
    icon: FileText,
    label: "Other Information",
    placeholder: "Additional information requested by seller",
    helpText: "Any other details the seller needs",
  },
};

function formatTimeRemaining(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h remaining`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }
  return `${minutes}m remaining`;
}

export default function BuyerInfoPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<BuyerInfoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetchBuyerInfo();
  }, [params.id]);

  const fetchBuyerInfo = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/transactions/${params.id}/buyer-info`, {
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to load buyer info");
      }

      const responseData = await res.json();
      setData(responseData);

      // Pre-fill form with any existing data
      if (responseData.providedInfo) {
        setFormData(responseData.providedInfo);
      }
    } catch (err) {
      console.error("Error fetching buyer info:", err);
      setError(err instanceof Error ? err.message : "Failed to load buyer info");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!data?.requiredInfo) return;

    // Validate required fields
    const missingFields: string[] = [];
    for (const [key, value] of Object.entries(data.requiredInfo)) {
      if (value?.required && (!formData[key] || !formData[key].trim())) {
        missingFields.push(FIELD_CONFIG[key as keyof typeof FIELD_CONFIG]?.label || key);
      }
    }

    if (missingFields.length > 0) {
      setSubmitError(`Please fill in: ${missingFields.join(", ")}`);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(`/api/transactions/${params.id}/buyer-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ info: formData }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to submit info");
      }

      // Redirect to transfer page
      router.push(`/dashboard/transfers/${params.id}`);
    } catch (err) {
      console.error("Error submitting buyer info:", err);
      setSubmitError(err instanceof Error ? err.message : "Failed to submit info");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-zinc-600 dark:text-zinc-400">{error || "Failed to load"}</p>
          <Link href="/dashboard/purchases" className="btn-primary mt-4 inline-flex">
            Back to Purchases
          </Link>
        </div>
      </div>
    );
  }

  // If already submitted, show success
  if (data.status === "PROVIDED") {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Link
            href={`/dashboard/transfers/${params.id}`}
            className="inline-flex items-center gap-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Transfer
          </Link>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              Information Submitted
            </h1>
            <p className="text-zinc-500 mb-6">
              Your information has been sent to the seller. They will begin the transfer process shortly.
            </p>
            <Link href={`/dashboard/transfers/${params.id}`} className="btn-primary">
              View Transfer Status
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // If deadline passed
  if (data.status === "DEADLINE_PASSED") {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Link
            href={`/dashboard/transfers/${params.id}`}
            className="inline-flex items-center gap-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Transfer
          </Link>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-amber-500" />
            </div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              Deadline Passed
            </h1>
            <p className="text-zinc-500 mb-6">
              The 48-hour window to submit your information has passed. The seller will use the fallback transfer process.
              Check the transfer page for next steps.
            </p>
            <Link href={`/dashboard/transfers/${params.id}`} className="btn-primary">
              View Transfer Status
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Show form for pending submission
  const requiredFields = data.requiredInfo
    ? Object.entries(data.requiredInfo).filter(([_, v]) => v?.required)
    : [];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          href={`/dashboard/transfers/${params.id}`}
          className="inline-flex items-center gap-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Transfer
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              Provide Your Information
            </h1>
            <p className="text-zinc-500">
              The seller needs this information to complete the transfer of assets.
            </p>

            {/* Deadline countdown */}
            {data.timeRemaining && data.timeRemaining > 0 && (
              <div
                className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
                  data.timeRemaining < 6 * 60 * 60 * 1000
                    ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                    : data.timeRemaining < 24 * 60 * 60 * 1000
                    ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                    : "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                }`}
              >
                <Clock className="w-5 h-5" />
                <span className="font-medium">{formatTimeRemaining(data.timeRemaining)}</span>
              </div>
            )}
          </div>

          {/* Form */}
          <div className="p-6 space-y-6">
            {requiredFields.map(([key, value]) => {
              const config = FIELD_CONFIG[key as keyof typeof FIELD_CONFIG];
              if (!config) return null;

              const Icon = config.icon;
              return (
                <div key={key}>
                  <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    <Icon className="w-4 h-4" />
                    {config.label}
                    <span className="text-red-500">*</span>
                  </label>
                  {key === "other" ? (
                    <textarea
                      value={formData[key] || ""}
                      onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                      placeholder={config.placeholder}
                      rows={3}
                      className="input-field resize-none"
                    />
                  ) : (
                    <input
                      type={key === "email" ? "email" : "text"}
                      value={formData[key] || ""}
                      onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                      placeholder={config.placeholder}
                      className="input-field"
                    />
                  )}
                  {value?.description ? (
                    <p className="mt-1 text-sm text-zinc-500">{value.description}</p>
                  ) : (
                    <p className="mt-1 text-sm text-zinc-500">{config.helpText}</p>
                  )}
                </div>
              );
            })}

            {submitError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {submitError}
                </p>
              </div>
            )}

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  This information will only be shared with the seller to complete the asset transfer.
                  It will be securely stored and deleted after the transfer is complete.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-6 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3">
            <Link href={`/dashboard/transfers/${params.id}`} className="btn-secondary">
              Cancel
            </Link>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-primary"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Submit Information
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
