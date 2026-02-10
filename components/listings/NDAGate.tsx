"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, Lock, FileText, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NDASigningModal } from "./NDASigningModal";
import { useSession } from "next-auth/react";
import { usePrivyAuth } from "@/components/providers/PrivyAuthProvider";

interface NDAGateProps {
  listingSlug: string;
  listingTitle: string;
  requiresNDA: boolean;
  children: React.ReactNode;
  blurredPreview?: React.ReactNode;
}

export function NDAGate({
  listingSlug,
  listingTitle,
  requiresNDA,
  children,
  blurredPreview,
}: NDAGateProps) {
  const { data: session } = useSession();
  const { isAuthenticated, login } = usePrivyAuth();
  const [ndaStatus, setNdaStatus] = useState<{
    signed: boolean;
    requiresNDA: boolean;
    ndaTerms: string;
    isSeller?: boolean;
    loading: boolean;
  }>({
    signed: false,
    requiresNDA,
    ndaTerms: "",
    loading: true,
  });
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const checkNDAStatus = async () => {
      if (!requiresNDA) {
        setNdaStatus({
          signed: true,
          requiresNDA: false,
          ndaTerms: "",
          loading: false,
        });
        return;
      }

      try {
        const response = await fetch(`/api/listings/${listingSlug}/nda`);
        const data = await response.json();

        setNdaStatus({
          signed: data.signed || false,
          requiresNDA: data.requiresNDA || false,
          ndaTerms: data.ndaTerms || "",
          isSeller: data.isSeller || false,
          loading: false,
        });
      } catch (error: any) {
        console.error("Error checking NDA status:", error);
        setNdaStatus((prev) => ({ ...prev, loading: false }));
      }
    };

    checkNDAStatus();
  }, [listingSlug, requiresNDA, session]);

  const handleNDASigned = () => {
    setShowModal(false);
    setNdaStatus((prev) => ({ ...prev, signed: true }));
  };

  // Loading state
  if (ndaStatus.loading) {
    return (
      <div className="animate-pulse">
        <div className="h-64 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
      </div>
    );
  }

  // If NDA is not required or already signed, show content
  if (!ndaStatus.requiresNDA || ndaStatus.signed) {
    return <>{children}</>;
  }

  // Show NDA gate
  return (
    <>
      <div className="relative">
        {/* Blurred preview */}
        {blurredPreview ? (
          <div className="relative">
            <div className="filter blur-lg pointer-events-none select-none">
              {blurredPreview}
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-zinc-900 via-transparent to-transparent" />
          </div>
        ) : (
          <div className="h-64 bg-zinc-100 dark:bg-zinc-800 rounded-xl filter blur-sm" />
        )}

        {/* NDA overlay */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-8 max-w-md mx-4 text-center border border-zinc-200 dark:border-zinc-800">
            <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>

            <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              NDA Required
            </h3>

            <p className="text-zinc-500 mb-6">
              This listing contains confidential information. Please sign the Non-Disclosure Agreement to view full details.
            </p>

            <div className="space-y-3">
              {isAuthenticated ? (
                <Button
                  variant="primary"
                  onClick={() => setShowModal(true)}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  <FileText className="w-4 h-4" />
                  Review & Sign NDA
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={login}
                  className="w-full"
                >
                  <Lock className="w-4 h-4" />
                  Sign In to View
                </Button>
              )}
            </div>

            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-zinc-400">
              <Lock className="w-3 h-3" />
              <span>Wallet-signed for legal protection</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* NDA Signing Modal */}
      <NDASigningModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSigned={handleNDASigned}
        listingSlug={listingSlug}
        listingTitle={listingTitle}
        ndaTerms={ndaStatus.ndaTerms}
      />
    </>
  );
}
