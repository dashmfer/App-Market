"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  DollarSign,
  Copy,
  Check,
  ExternalLink,
  Gift,
  TrendingUp,
  Edit3,
  AlertCircle,
  Loader2,
} from "lucide-react";

// Data loaded from database - starts empty
const referralData = {
  code: "", // Generated on user registration
  isCustomized: false,
  totalReferrals: 0,
  activeReferrals: 0,
  totalEarnings: 0,
  pendingEarnings: 0,
  availableEarnings: 0,
  referrals: [] as any[],
};

export default function ReferralsPage() {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newCode, setNewCode] = useState(referralData.code || "yourcode");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const referralLink = `https://appmarket.xyz/r/${newCode}`;

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveCode = async () => {
    if (newCode.length < 3) {
      setError("Code must be at least 3 characters");
      return;
    }
    if (newCode.length > 20) {
      setError("Code must be 20 characters or less");
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(newCode)) {
      setError("Only letters, numbers, underscore, and hyphen allowed");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      // API call to save custom code
      await new Promise((r) => setTimeout(r, 1500));
      setIsEditing(false);
    } catch (e) {
      setError("Code already taken");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="container-wide py-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
              <Gift className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-semibold text-zinc-900 dark:text-zinc-100">
                Referral Program
              </h1>
              <p className="text-zinc-500">
                Earn 2% commission when people you refer make sales
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container-wide py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Referral Link Card */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Your Referral Link
              </h2>

              <div className="flex items-center gap-3 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                <div className="flex-1 font-mono text-sm text-zinc-600 dark:text-zinc-400 truncate">
                  {referralLink}
                </div>
                <button
                  onClick={copyToClipboard}
                  className="btn-secondary py-2"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-green-500" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>

              {/* Custom Code */}
              <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                      Your Referral Code
                    </h3>
                    <p className="text-sm text-zinc-500">
                      {referralData.isCustomized
                        ? "You've already customized your code"
                        : "Customize once to make it memorable"}
                    </p>
                  </div>
                  {!referralData.isCustomized && !isEditing && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="btn-secondary py-2 text-sm"
                    >
                      <Edit3 className="w-4 h-4" />
                      Customize
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-400">app.market/r/</span>
                      <input
                        type="text"
                        value={newCode}
                        onChange={(e) => setNewCode(e.target.value.toLowerCase())}
                        className="input-field flex-1"
                        placeholder="your-code"
                        maxLength={20}
                      />
                    </div>
                    {error && (
                      <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                      </p>
                    )}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleSaveCode}
                        disabled={isSaving}
                        className="btn-success py-2 text-sm"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            Save Code
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setIsEditing(false);
                          setNewCode(referralData.code);
                          setError("");
                        }}
                        className="btn-secondary py-2 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                    <p className="text-xs text-yellow-600 dark:text-yellow-400">
                      ⚠️ You can only customize your code once!
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <span className="font-mono font-medium text-green-700 dark:text-green-400">
                      {referralData.code}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* How It Works */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                How It Works
              </h2>
              <div className="space-y-4">
                {[
                  { step: 1, title: "Share Your Link", desc: "Send your unique referral link to friends, on social media, or anywhere builders hang out" },
                  { step: 2, title: "They Sign Up", desc: "When someone clicks your link and creates an account, they're linked to you" },
                  { step: 3, title: "They Sell", desc: "When your referral sells a project on App Market, you earn 2% of the sale" },
                  { step: 4, title: "Get Paid", desc: "Earnings are added to your balance and can be withdrawn anytime" },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-sm font-semibold text-green-600 dark:text-green-400">
                      {item.step}
                    </div>
                    <div>
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">
                        {item.title}
                      </div>
                      <div className="text-sm text-zinc-500">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Referrals Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Your Referrals
              </h2>
              
              {referralData.referrals.length > 0 ? (
                <div className="space-y-3">
                  {referralData.referrals.map((ref) => (
                    <div
                      key={ref.id}
                      className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                          <span className="text-white font-medium text-sm">
                            {ref.user[0].toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-zinc-900 dark:text-zinc-100">
                            {ref.user}
                          </div>
                          <div className="text-sm text-zinc-500">
                            Joined {Math.floor((Date.now() - ref.joinedAt.getTime()) / 86400000)}d ago
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-medium ${
                          ref.status === "ACTIVE" 
                            ? "text-green-600 dark:text-green-400" 
                            : "text-yellow-600 dark:text-yellow-400"
                        }`}>
                          {ref.status === "ACTIVE" ? "Active" : "Pending"}
                        </div>
                        <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                          {ref.earnings > 0 ? `${ref.earnings} SOL` : "-"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-zinc-500">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No referrals yet. Share your link to get started!</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Stats */}
          <div className="space-y-6">
            {/* Earnings Card */}
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white">
              <div className="flex items-center gap-2 text-green-100 mb-2">
                <DollarSign className="w-5 h-5" />
                <span className="text-sm font-medium">Total Earnings</span>
              </div>
              <div className="text-4xl font-display font-bold">
                {referralData.totalEarnings} SOL
              </div>
              <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-green-100">Available</div>
                  <div className="text-xl font-semibold">
                    {referralData.availableEarnings} SOL
                  </div>
                </div>
                <div>
                  <div className="text-sm text-green-100">Pending</div>
                  <div className="text-xl font-semibold">
                    {referralData.pendingEarnings} SOL
                  </div>
                </div>
              </div>
              <button className="w-full mt-4 py-3 bg-white/20 hover:bg-white/30 rounded-xl font-medium transition-colors">
                Withdraw Earnings
              </button>
            </div>

            {/* Stats */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Stats
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Users className="w-4 h-4" />
                    <span>Total Referrals</span>
                  </div>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {referralData.totalReferrals}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <TrendingUp className="w-4 h-4" />
                    <span>Active Sellers</span>
                  </div>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {referralData.activeReferrals}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <DollarSign className="w-4 h-4" />
                    <span>Commission Rate</span>
                  </div>
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    2%
                  </span>
                </div>
              </div>
            </div>

            {/* Share Tips */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800 p-6">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
                💡 Pro Tips
              </h3>
              <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                <li>• Share in developer communities</li>
                <li>• Post on Twitter/X when you see builders</li>
                <li>• Help friends list their projects</li>
                <li>• Quality referrals earn more over time</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
