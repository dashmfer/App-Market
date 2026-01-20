"use client";

import { useState, useEffect } from "react";
import { Star, X, Loader2, Twitter } from "lucide-react";
import Link from "next/link";

interface ReviewableItem {
  type: "TRANSACTION" | "MESSAGING";
  id: string;
  title?: string;
  alreadyReviewed: boolean;
}

interface ReviewFormProps {
  subjectId: string;
  subjectName: string;
  onClose: () => void;
  onSuccess: () => void;
}

function StarInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const [hover, setHover] = useState(0);

  return (
    <div className="space-y-1">
      <label className="text-sm text-zinc-600 dark:text-zinc-400">{label}</label>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(star)}
            className="p-0.5"
          >
            <Star
              className={`w-6 h-6 transition-colors ${
                star <= (hover || value)
                  ? "text-yellow-400 fill-yellow-400"
                  : "text-zinc-300 dark:text-zinc-600"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export function ReviewForm({ subjectId, subjectName, onClose, onSuccess }: ReviewFormProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [requiresTwitter, setRequiresTwitter] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [reviewableItems, setReviewableItems] = useState<ReviewableItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ReviewableItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [rating, setRating] = useState(0);
  const [communicationRating, setCommunicationRating] = useState(0);
  const [speedRating, setSpeedRating] = useState(0);
  const [accuracyRating, setAccuracyRating] = useState(0);
  const [comment, setComment] = useState("");

  useEffect(() => {
    async function checkEligibility() {
      try {
        const response = await fetch(`/api/reviews/can-review?userId=${subjectId}`);
        if (response.ok) {
          const data = await response.json();
          setCanReview(data.canReview);
          setRequiresTwitter(data.requiresTwitter || false);
          setReason(data.reason || null);
          setReviewableItems(data.reviewableItems || []);

          // Auto-select first unreviewed item
          const firstUnreviewed = data.reviewableItems?.find(
            (item: ReviewableItem) => !item.alreadyReviewed
          );
          if (firstUnreviewed) {
            setSelectedItem(firstUnreviewed);
          }
        }
      } catch (error) {
        setError("Failed to check review eligibility");
      } finally {
        setLoading(false);
      }
    }

    checkEligibility();
  }, [subjectId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedItem || rating === 0) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId,
          transactionId: selectedItem.type === "TRANSACTION" ? selectedItem.id : undefined,
          conversationId: selectedItem.type === "MESSAGING" ? selectedItem.id : undefined,
          type: selectedItem.type,
          rating,
          communicationRating: communicationRating || undefined,
          speedRating: speedRating || undefined,
          accuracyRating: accuracyRating || undefined,
          comment: comment.trim() || undefined,
        }),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to submit review");
      }
    } catch (error) {
      setError("Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-6">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Review {subjectName}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          {/* Twitter Required */}
          {requiresTwitter && (
            <div className="text-center py-8">
              <Twitter className="w-12 h-12 text-blue-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                Twitter Account Required
              </h3>
              <p className="text-zinc-500 mb-4">
                To leave reviews, you need to link your Twitter account first.
              </p>
              <Link
                href="/api/auth/twitter/connect"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                <Twitter className="w-4 h-4" />
                Connect Twitter
              </Link>
            </div>
          )}

          {/* Cannot Review */}
          {!requiresTwitter && !canReview && (
            <div className="text-center py-8">
              <Star className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                Cannot Leave Review
              </h3>
              <p className="text-zinc-500">{reason}</p>
            </div>
          )}

          {/* Review Form */}
          {canReview && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Select Interaction */}
              {reviewableItems.filter((i) => !i.alreadyReviewed).length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Select Interaction to Review
                  </label>
                  <select
                    value={selectedItem?.id || ""}
                    onChange={(e) => {
                      const item = reviewableItems.find((i) => i.id === e.target.value);
                      setSelectedItem(item || null);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                  >
                    {reviewableItems
                      .filter((i) => !i.alreadyReviewed)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.type === "TRANSACTION" ? "Purchase: " : "Message: "}
                          {item.title}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Overall Rating */}
              <StarInput
                value={rating}
                onChange={setRating}
                label="Overall Rating *"
              />

              {/* Criteria Ratings */}
              <div className="grid grid-cols-3 gap-4">
                <StarInput
                  value={communicationRating}
                  onChange={setCommunicationRating}
                  label="Communication"
                />
                <StarInput
                  value={speedRating}
                  onChange={setSpeedRating}
                  label="Speed"
                />
                <StarInput
                  value={accuracyRating}
                  onChange={setAccuracyRating}
                  label="Accuracy"
                />
              </div>

              {/* Comment */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Comment (optional)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share your experience..."
                  rows={4}
                  maxLength={1000}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 resize-none"
                />
                <p className="text-xs text-zinc-500 mt-1">{comment.length}/1000</p>
              </div>

              {/* Error */}
              {error && (
                <p className="text-red-500 text-sm">{error}</p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting || rating === 0}
                className="w-full py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Review"
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
