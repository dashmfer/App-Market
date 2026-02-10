'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { DollarSign, Check, Clock, ExternalLink } from 'lucide-react';

interface Withdrawal {
  id: string;
  amount: number;
  currency: string;
  claimed: boolean;
  createdAt: string;
  claimedAt: string | null;
  listing: {
    id: string;
    title: string;
    slug: string;
    thumbnailUrl: string | null;
  };
}

interface WithdrawalData {
  withdrawals: Withdrawal[];
  unclaimed: Withdrawal[];
  claimed: Withdrawal[];
  stats: {
    totalUnclaimed: number;
    totalClaimed: number;
    unclaimedCount: number;
    claimedCount: number;
  };
}

export default function WithdrawalList() {
  const [data, setData] = useState<WithdrawalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unclaimed' | 'claimed'>('all');

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const fetchWithdrawals = async () => {
    try {
      const response = await fetch('/api/withdrawals');
      if (!response.ok) throw new Error('Failed to fetch withdrawals');

      const data = await response.json();
      setData(data);
    } catch (error: any) {
      console.error('Error fetching withdrawals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (withdrawalId: string) => {
    try {
      setClaiming(withdrawalId);

      const response = await fetch(`/api/withdrawals/${withdrawalId}/claim`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to claim withdrawal');
      }

      // Refresh withdrawals
      await fetchWithdrawals();
    } catch (error: any) {
      console.error('Error claiming withdrawal:', error);
      alert(error instanceof Error ? error.message : 'Failed to claim withdrawal');
    } finally {
      setClaiming(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data || data.withdrawals.length === 0) {
    return (
      <div className="text-center py-12">
        <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No Withdrawals
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          You don't have any pending withdrawals yet.
        </p>
      </div>
    );
  }

  const filteredWithdrawals =
    filter === 'all'
      ? data.withdrawals
      : filter === 'unclaimed'
      ? data.unclaimed
      : data.claimed;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Unclaimed</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {Number(data.stats.totalUnclaimed).toFixed(4)} SOL
              </p>
            </div>
            <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-3">
              <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Claimed</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {Number(data.stats.totalClaimed).toFixed(4)} SOL
              </p>
            </div>
            <div className="bg-green-100 dark:bg-green-900/30 rounded-full p-3">
              <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Count</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {data.withdrawals.length}
              </p>
            </div>
            <div className="bg-purple-100 dark:bg-purple-900/30 rounded-full p-3">
              <DollarSign className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          All ({data.withdrawals.length})
        </button>
        <button
          onClick={() => setFilter('unclaimed')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            filter === 'unclaimed'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          Unclaimed ({data.stats.unclaimedCount})
        </button>
        <button
          onClick={() => setFilter('claimed')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            filter === 'claimed'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          Claimed ({data.stats.claimedCount})
        </button>
      </div>

      {/* Withdrawals List */}
      <div className="space-y-4">
        {filteredWithdrawals.map((withdrawal) => (
          <div
            key={withdrawal.id}
            className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-start justify-between gap-4">
              {/* Listing Info */}
              <div className="flex items-start gap-4 flex-1">
                {withdrawal.listing.thumbnailUrl && (
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                    <Image
                      src={withdrawal.listing.thumbnailUrl}
                      alt={withdrawal.listing.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <Link
                    href={`/listing/${withdrawal.listing.slug}`}
                    className="text-lg font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-2 group"
                  >
                    {withdrawal.listing.title}
                    <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition" />
                  </Link>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Created {new Date(withdrawal.createdAt).toLocaleDateString()}
                  </p>
                  {withdrawal.claimed && withdrawal.claimedAt && (
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                      <Check className="w-4 h-4" />
                      Claimed {new Date(withdrawal.claimedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              {/* Amount & Action */}
              <div className="flex flex-col items-end gap-3">
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {Number(withdrawal.amount).toFixed(4)} {withdrawal.currency}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    ≈ ${(Number(withdrawal.amount) * 100).toFixed(2)} USD
                  </p>
                </div>

                {!withdrawal.claimed && (
                  <button
                    onClick={() => handleClaim(withdrawal.id)}
                    disabled={claiming === withdrawal.id}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition flex items-center gap-2 whitespace-nowrap"
                  >
                    {claiming === withdrawal.id ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Claiming...
                      </>
                    ) : (
                      <>
                        <DollarSign className="w-4 h-4" />
                        Claim Now
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredWithdrawals.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">
            No {filter} withdrawals found.
          </p>
        </div>
      )}
    </div>
  );
}
