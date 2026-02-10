'use client';

import { useState } from 'react';
import { DollarSign } from 'lucide-react';

interface MakeOfferFormProps {
  listingId: string;
  listingTitle: string;
  currentPrice?: number;
  consecutiveOfferCount?: number; // From on-chain listing data
  offerCount?: number; // Current offer count from listing (used as offer_seed for on-chain)
  onSuccess?: () => void;
}

export default function MakeOfferForm({
  listingId,
  listingTitle,
  currentPrice,
  consecutiveOfferCount = 0,
  onSuccess,
}: MakeOfferFormProps) {
  const [amount, setAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const offerAmount = parseFloat(amount);

    if (isNaN(offerAmount) || offerAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (!deadline) {
      setError('Please select a deadline');
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId,
          amount: offerAmount,
          deadline: new Date(deadline).toISOString(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create offer');
      }

      // Success!
      setAmount('');
      setDeadline('');
      onSuccess?.();
    } catch (err: any) {
      console.error('Offer error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create offer');
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate minimum date (1 hour from now)
  const minDate = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Make an Offer
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Amount Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Offer Amount (SOL)
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          {currentPrice && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Current price: {currentPrice} SOL
            </p>
          )}
        </div>

        {/* Deadline Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Offer Expires
          </label>
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            min={minDate}
            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Minimum: 1 hour from now
          </p>
        </div>

        {/* Consecutive Offer Warning */}
        {consecutiveOfferCount >= 7 && consecutiveOfferCount < 10 && (
          <div className="text-sm text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-4 py-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-start gap-2">
              <span className="text-lg">⚠️</span>
              <div>
                <p className="font-medium">Approaching offer limit</p>
                <p className="text-xs mt-1">
                  You have made {consecutiveOfferCount} consecutive offers on this listing.
                  Maximum is 10. Consider canceling an existing offer if you reach the limit.
                </p>
              </div>
            </div>
          </div>
        )}

        {consecutiveOfferCount >= 10 && (
          <div className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex items-start gap-2">
              <span className="text-lg">🚫</span>
              <div>
                <p className="font-medium">Maximum consecutive offers reached</p>
                <p className="text-xs mt-1">
                  You've made 10 consecutive offers on this listing.
                  Please cancel one of your existing offers or wait for another buyer to place an offer.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-lg">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting || consecutiveOfferCount >= 10}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Creating Offer...
            </>
          ) : (
            'Submit Offer'
          )}
        </button>

        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Funds will be held in escrow until the offer expires or is accepted
        </p>
      </form>
    </div>
  );
}
