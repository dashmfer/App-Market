'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Scale,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Shield,
  Loader2,
  Flag,
  User,
  Wallet,
} from 'lucide-react';

export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED';
export type ResolutionType = 'FullRefund' | 'ReleaseToSeller' | 'PartialRefund';

interface DisputeResolutionPanelProps {
  dispute: {
    id: string;
    status: DisputeStatus;
    reason: string;
    createdAt: Date;
    initiator: 'buyer' | 'seller';
    pendingResolution?: ResolutionType;
    pendingBuyerAmount?: number;
    pendingSellerAmount?: number;
    pendingResolutionAt?: Date;
    contested?: boolean;
    resolution?: ResolutionType;
    resolvedAt?: Date;
  };
  transaction: {
    salePrice: number;
    buyer: { name: string; wallet: string };
    seller: { name: string; wallet: string };
  };
  userRole: 'admin' | 'buyer' | 'seller';
  onPropose?: (resolution: ResolutionType, buyerAmount: number, sellerAmount: number, notes: string) => Promise<void>;
  onContest?: () => Promise<void>;
  onExecute?: () => Promise<void>;
}

const TIMELOCK_SECONDS = 48 * 60 * 60; // 48 hours

export default function DisputeResolutionPanel({
  dispute,
  transaction,
  userRole,
  onPropose,
  onContest,
  onExecute,
}: DisputeResolutionPanelProps) {
  const [resolution, setResolution] = useState<ResolutionType>('FullRefund');
  const [buyerAmount, setBuyerAmount] = useState('');
  const [sellerAmount, setSellerAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Calculate time remaining for timelock
  useEffect(() => {
    if (!dispute.pendingResolutionAt) return;

    const updateTime = () => {
      const elapsed = (Date.now() - new Date(dispute.pendingResolutionAt!).getTime()) / 1000;
      const remaining = Math.max(0, TIMELOCK_SECONDS - elapsed);
      setTimeRemaining(remaining);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [dispute.pendingResolutionAt]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs}h ${mins}m ${secs}s`;
  };

  const handlePropose = async () => {
    if (!onPropose) return;
    setIsSubmitting(true);
    try {
      const buyer = resolution === 'PartialRefund' ? parseFloat(buyerAmount) :
                    resolution === 'FullRefund' ? transaction.salePrice : 0;
      const seller = resolution === 'PartialRefund' ? parseFloat(sellerAmount) :
                     resolution === 'ReleaseToSeller' ? transaction.salePrice : 0;
      await onPropose(resolution, buyer, seller, notes);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContest = async () => {
    if (!onContest) return;
    setIsSubmitting(true);
    try {
      await onContest();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecute = async () => {
    if (!onExecute) return;
    setIsSubmitting(true);
    try {
      await onExecute();
    } finally {
      setIsSubmitting(false);
    }
  };

  const canContest = dispute.pendingResolution && !dispute.contested && timeRemaining && timeRemaining > 0;
  const canExecute = dispute.pendingResolution && !dispute.contested && timeRemaining === 0;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            dispute.status === 'RESOLVED'
              ? 'bg-green-100 dark:bg-green-900/30'
              : dispute.pendingResolution
              ? 'bg-yellow-100 dark:bg-yellow-900/30'
              : 'bg-red-100 dark:bg-red-900/30'
          }`}>
            {dispute.status === 'RESOLVED' ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : dispute.pendingResolution ? (
              <Clock className="w-5 h-5 text-yellow-600" />
            ) : (
              <Scale className="w-5 h-5 text-red-600" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Dispute Resolution
            </h2>
            <p className="text-sm text-zinc-500">
              {dispute.status === 'RESOLVED'
                ? 'This dispute has been resolved'
                : dispute.pendingResolution
                ? 'Resolution proposed - awaiting timelock'
                : 'Open dispute - awaiting admin review'}
            </p>
          </div>
        </div>
      </div>

      {/* Dispute Details */}
      <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="text-sm text-zinc-500 mb-1">Dispute Reason</div>
            <p className="text-zinc-900 dark:text-zinc-100">{dispute.reason}</p>
          </div>
          <div>
            <div className="text-sm text-zinc-500 mb-1">Initiated By</div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-zinc-400" />
              <span className="text-zinc-900 dark:text-zinc-100 capitalize">
                {dispute.initiator}
              </span>
            </div>
          </div>
          <div>
            <div className="text-sm text-zinc-500 mb-1">Sale Amount</div>
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-zinc-400" />
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {transaction.salePrice} SOL
              </span>
            </div>
          </div>
          <div>
            <div className="text-sm text-zinc-500 mb-1">Status</div>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              dispute.status === 'RESOLVED'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : dispute.pendingResolution
                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
            }`}>
              {dispute.status === 'RESOLVED' ? 'Resolved' : dispute.pendingResolution ? 'Pending Execution' : 'Under Review'}
            </span>
          </div>
        </div>
      </div>

      {/* Pending Resolution - Timelock */}
      {dispute.pendingResolution && !dispute.contested && dispute.status !== 'RESOLVED' && (
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-yellow-50 dark:bg-yellow-900/10">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
                Resolution Proposed
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                {dispute.pendingResolution === 'FullRefund' && 'Full refund to buyer'}
                {dispute.pendingResolution === 'ReleaseToSeller' && 'Release funds to seller'}
                {dispute.pendingResolution === 'PartialRefund' &&
                  `Split: ${dispute.pendingBuyerAmount} SOL to buyer, ${dispute.pendingSellerAmount} SOL to seller`}
              </p>

              {timeRemaining !== null && timeRemaining > 0 && (
                <div className="mt-3 p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl">
                  <div className="text-sm text-yellow-700 dark:text-yellow-300">
                    Timelock expires in:
                  </div>
                  <div className="text-2xl font-display font-semibold text-yellow-900 dark:text-yellow-100">
                    {formatTime(timeRemaining)}
                  </div>
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                    Either party can contest within this period
                  </p>
                </div>
              )}

              {timeRemaining === 0 && (
                <div className="mt-3 p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="font-medium">Timelock expired - Ready to execute</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contested Notice */}
      {dispute.contested && (
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-red-50 dark:bg-red-900/10">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-red-800 dark:text-red-200">
                Resolution Contested
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                The proposed resolution has been contested. Admin must propose a new resolution.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Resolved */}
      {dispute.status === 'RESOLVED' && dispute.resolution && (
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-green-50 dark:bg-green-900/10">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-green-800 dark:text-green-200">
                Dispute Resolved
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                {dispute.resolution === 'FullRefund' && 'Buyer received full refund'}
                {dispute.resolution === 'ReleaseToSeller' && 'Funds released to seller'}
                {dispute.resolution === 'PartialRefund' && 'Funds split between parties'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Admin: Propose Resolution */}
      {userRole === 'admin' && !dispute.pendingResolution && dispute.status !== 'RESOLVED' && (
        <div className="p-6">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
            Propose Resolution
          </h3>

          <div className="space-y-4">
            {/* Resolution Type */}
            <div className="grid grid-cols-3 gap-3">
              {(['FullRefund', 'ReleaseToSeller', 'PartialRefund'] as ResolutionType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setResolution(type)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    resolution === type
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }`}
                >
                  <div className={`text-sm font-medium ${
                    resolution === type ? 'text-green-700 dark:text-green-400' : 'text-zinc-900 dark:text-zinc-100'
                  }`}>
                    {type === 'FullRefund' && 'Full Refund'}
                    {type === 'ReleaseToSeller' && 'Release to Seller'}
                    {type === 'PartialRefund' && 'Split'}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    {type === 'FullRefund' && 'Buyer gets all'}
                    {type === 'ReleaseToSeller' && 'Seller gets all'}
                    {type === 'PartialRefund' && 'Custom split'}
                  </div>
                </button>
              ))}
            </div>

            {/* Partial Refund Amounts */}
            {resolution === 'PartialRefund' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="grid grid-cols-2 gap-4"
              >
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Buyer Amount (SOL)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={buyerAmount}
                    onChange={(e) => {
                      setBuyerAmount(e.target.value);
                      const buyer = parseFloat(e.target.value) || 0;
                      setSellerAmount((transaction.salePrice - buyer).toFixed(2));
                    }}
                    placeholder="0.00"
                    className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Seller Amount (SOL)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={sellerAmount}
                    onChange={(e) => {
                      setSellerAmount(e.target.value);
                      const seller = parseFloat(e.target.value) || 0;
                      setBuyerAmount((transaction.salePrice - seller).toFixed(2));
                    }}
                    placeholder="0.00"
                    className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div className="col-span-2 text-sm text-zinc-500">
                  Total must equal {transaction.salePrice} SOL
                </div>
              </motion.div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Resolution Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Explain the reasoning for this resolution..."
                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent min-h-[100px] resize-y"
              />
            </div>

            {/* Submit */}
            <button
              onClick={handlePropose}
              disabled={isSubmitting || !notes.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 bg-black dark:bg-white text-white dark:text-black font-medium rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:bg-zinc-400 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Proposing...
                </>
              ) : (
                <>
                  <Scale className="w-5 h-5" />
                  Propose Resolution (48hr Timelock)
                </>
              )}
            </button>

            <p className="text-xs text-zinc-500 text-center">
              Both parties will have 48 hours to contest this resolution
            </p>
          </div>
        </div>
      )}

      {/* Buyer/Seller: Contest or Wait */}
      {(userRole === 'buyer' || userRole === 'seller') && canContest && (
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                Contest Resolution
              </h3>
              <p className="text-sm text-zinc-500 mt-1">
                If you disagree with the proposed resolution, you can contest it.
              </p>
            </div>
            <button
              onClick={handleContest}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 disabled:bg-zinc-400 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Flag className="w-4 h-4" />
              )}
              Contest
            </button>
          </div>
        </div>
      )}

      {/* Execute Resolution */}
      {canExecute && (
        <div className="p-6">
          <button
            onClick={handleExecute}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 disabled:bg-zinc-400 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <Shield className="w-5 h-5" />
                Execute Resolution
              </>
            )}
          </button>
          <p className="text-xs text-zinc-500 text-center mt-2">
            This will finalize the dispute and transfer funds accordingly
          </p>
        </div>
      )}
    </div>
  );
}
