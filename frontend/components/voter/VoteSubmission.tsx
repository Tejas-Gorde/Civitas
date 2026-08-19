"use client";

import { motion } from "framer-motion";
import { Shield, RefreshCw, Lock, AlertCircle, RotateCcw } from "lucide-react";

interface VoteSubmissionProps {
  error: string | null;
  onRetry: () => void;
  onBackToReview?: () => void;
}

export default function VoteSubmission({
  error,
  onRetry,
  onBackToReview,
}: VoteSubmissionProps) {
  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md mx-auto card p-6 sm:p-8 bg-white border border-rose-200 rounded-3xl shadow-xl text-center space-y-5"
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 shadow-xs">
          <AlertCircle className="h-8 w-8" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-lg sm:text-xl font-black text-slate-950">
            Vote Submission Failed
          </h3>
          <p className="text-xs text-rose-700 leading-relaxed font-medium">
            {error}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 text-left">
          Your ballot was not cast. Please verify your connection or retry your submission.
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {onBackToReview && (
            <button
              type="button"
              onClick={onBackToReview}
              className="button button-secondary text-xs w-full sm:w-auto py-2.5 px-4 min-h-[44px]"
            >
              Back to Review
            </button>
          )}

          <button
            type="button"
            onClick={onRetry}
            className="button button-teal text-xs font-bold w-full sm:w-auto py-2.5 px-6 min-h-[44px] flex items-center justify-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Try Again</span>
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-md mx-auto card p-8 sm:p-10 bg-gradient-to-b from-white to-slate-50 border border-slate-200 rounded-3xl shadow-xl text-center space-y-6"
    >
      {/* Animated Glowing Security Shield */}
      <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-3xl bg-teal-500/20 blur-md"
        />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-teal-600 to-teal-800 text-white shadow-lg">
          <Lock className="h-9 w-9 animate-pulse" />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Submitting Vote Securely...
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
          Encrypting ballot payload with zero-knowledge verification tokens and sealing ledger entry.
        </p>
      </div>

      {/* Progress Spinner & Security Badge */}
      <div className="flex items-center justify-center gap-2 text-xs font-bold text-teal-800 bg-teal-50 py-2.5 px-4 rounded-xl border border-teal-200/80">
        <RefreshCw className="h-4 w-4 animate-spin text-teal-600" />
        <span>Cryptographic Handshake in Progress</span>
      </div>
    </motion.div>
  );
}
