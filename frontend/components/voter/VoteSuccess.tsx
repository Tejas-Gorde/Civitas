"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2,
  Copy,
  Printer,
  Check,
  Shield,
  ArrowRight,
  Sparkles,
  Lock,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface VoteSuccessProps {
  electionName: string;
  receiptId: string;
  castTimestamp?: string;
  onReset?: () => void;
}

export default function VoteSuccess({
  electionName,
  receiptId,
  castTimestamp,
  onReset,
}: VoteSuccessProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const handleCopyReceipt = () => {
    if (!receiptId) return;
    navigator.clipboard.writeText(receiptId);
    setCopied(true);
    toast.success("Cryptographic receipt ID copied to clipboard.");
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const formattedTime = castTimestamp
    ? new Date(castTimestamp).toLocaleString()
    : new Date().toLocaleString();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="max-w-xl mx-auto card p-6 sm:p-10 bg-white border border-slate-200 rounded-3xl shadow-xl space-y-6 text-center"
    >
      {/* Animated Glowing Success Badge */}
      <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-md border-4 border-emerald-200"
        >
          <CheckCircle2 className="h-12 w-12" />
        </motion.div>
      </div>

      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
          <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
          <span>BALLOT CRYPTOGRAPHICALLY RECORDED</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
          Vote Successfully Recorded
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
          Your vote for <strong>{electionName}</strong> has been securely cast and permanently registered on the CIVITAS voting ledger.
        </p>
      </div>

      {/* Official Cryptographic Receipt Card */}
      <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-3 shadow-2xs">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-1">
            <Lock className="h-3 w-3 text-teal-600" />
            Official Vote Receipt
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            {formattedTime}
          </span>
        </div>

        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
            Receipt Reference Identifier:
          </span>
          <div className="flex items-center justify-between gap-2 p-2.5 bg-white rounded-xl border border-slate-200 font-mono text-xs text-slate-800 select-all break-all">
            <span className="truncate">{receiptId || "CIVITAS-VOTE-CONFIRMED"}</span>
            <button
              type="button"
              onClick={handleCopyReceipt}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition shrink-0 cursor-pointer"
              title="Copy receipt ID"
              aria-label="Copy receipt ID"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
          <span>Election: <strong className="text-slate-700">{electionName}</strong></span>
          <span className="text-emerald-700 font-bold">Status: Certified</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={handlePrint}
          className="button button-secondary text-xs w-full sm:w-auto py-2.5 px-4 min-h-[44px] flex items-center justify-center gap-1.5"
        >
          <Printer className="h-4 w-4" />
          <span>Print Receipt</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (onReset) {
              onReset();
            } else {
              router.push("/");
            }
          }}
          className="button button-teal text-xs font-bold w-full sm:w-auto py-2.5 px-6 min-h-[44px] flex items-center justify-center gap-2 shadow-xs"
        >
          <span>Finish & Exit Portal</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}
