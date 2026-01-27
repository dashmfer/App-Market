"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Flag, Loader2, AlertTriangle } from "lucide-react";

export default function NewDisputePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const transactionId = searchParams.get("transaction");
  const itemId = searchParams.get("item");

  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!transactionId) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            Missing transaction
          </h1>
          <p className="text-zinc-500 mb-4">This page requires a valid transaction reference.</p>
          <Link href="/dashboard" className="text-green-600 hover:underline">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || !description.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          transactionId,
          itemId: itemId || undefined,
          reason,
          description: description.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit dispute");
      }

      setSubmitted(true);
    } catch (err: unknown) {
      console.error("Error submitting dispute:", err);
      alert(err instanceof Error ? err.message : "Failed to submit dispute");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <Flag className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            Dispute Submitted
          </h1>
          <p className="text-zinc-500 mb-6">
            Your dispute has been submitted and our team will review it. You will be notified of any updates.
          </p>
          <Link
            href={`/dashboard/transfers/${transactionId}`}
            className="btn-primary inline-flex items-center gap-2"
          >
            Back to Transfer
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="container-wide max-w-2xl py-8">
        <Link
          href={`/dashboard/transfers/${transactionId}`}
          className="flex items-center gap-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Transfer
        </Link>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Flag className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Open a Dispute
              </h1>
              <p className="text-sm text-zinc-500">
                Report an issue with assets transferred to you
              </p>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 mb-6">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800 dark:text-yellow-200">
                <p className="font-medium mb-1">Before opening a dispute</p>
                <p>
                  Please try messaging the seller first to resolve any issues. Disputes should be used
                  when transferred assets are incorrect, incomplete, or not as described.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Reason for dispute
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="input-field"
                required
              >
                <option value="">Select a reason...</option>
                <option value="wrong_assets">Wrong assets transferred</option>
                <option value="incomplete">Incomplete transfer (missing files/access)</option>
                <option value="not_as_described">Assets not as described in listing</option>
                <option value="non_functional">Assets are non-functional or broken</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Describe the issue
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide details about what's wrong with the transferred assets..."
                className="input-field min-h-[120px] resize-y"
                required
              />
            </div>

            <button
              type="submit"
              disabled={!reason || !description.trim() || isSubmitting}
              className="btn-primary w-full justify-center"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Flag className="w-4 h-4" />
                  Submit Dispute
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
