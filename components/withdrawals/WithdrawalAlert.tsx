'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, X } from 'lucide-react';

interface WithdrawalStats {
  totalUnclaimed: number;
  unclaimedCount: number;
}

export default function WithdrawalAlert() {
  const [stats, setStats] = useState<WithdrawalStats | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const fetchWithdrawals = async () => {
    try {
      const response = await fetch('/api/withdrawals');
      if (!response.ok) {
        if (response.status === 401) {
          // Not logged in
          setLoading(false);
          return;
        }
        throw new Error('Failed to fetch withdrawals');
      }

      const data = await response.json();
      setStats(data.stats);
    } catch (error: any) {
      console.error('Error fetching withdrawals:', error);
    } finally {
      setLoading(false);
    }
  };

  // Don't show if loading, no unclaimed withdrawals, or dismissed
  if (loading || !stats || stats.unclaimedCount === 0 || dismissed) {
    return null;
  }

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                You have {stats.unclaimedCount} pending withdrawal{stats.unclaimedCount !== 1 ? 's' : ''}
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                ({Number(stats.totalUnclaimed).toFixed(4)} SOL available)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/withdrawals"
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 whitespace-nowrap"
            >
              Claim Now →
            </Link>
            <button
              onClick={() => setDismissed(true)}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 p-1"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
