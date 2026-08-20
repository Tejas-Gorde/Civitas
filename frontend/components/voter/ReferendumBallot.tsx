"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ThumbsUp,
  ThumbsDown,
  MinusCircle,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  Check,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

interface Candidate {
  id: string;
  name: string;
  party: string;
  manifesto?: string;
}

interface ReferendumBallotProps {
  proposalTitle: string;
  proposalDescription?: string;
  candidates: Candidate[];
  selectedOptionId: string;
  allowAbstain?: boolean;
  onSelectOption: (id: string) => void;
  onProceedToReview: () => void;
  onBackToIntro?: () => void;
}

export default function ReferendumBallot({
  proposalTitle,
  proposalDescription,
  candidates,
  selectedOptionId,
  allowAbstain = false,
  onSelectOption,
  onProceedToReview,
  onBackToIntro,
}: ReferendumBallotProps) {
  const [selectedId, setSelectedId] = useState<string>(selectedOptionId);

  // Group or generate choices based on candidates
  const options = candidates.map((c) => {
    const nameLower = c.name.toLowerCase();
    const isYes =
      nameLower.includes("yes") ||
      nameLower.includes("approve") ||
      nameLower.includes("for") ||
      nameLower.includes("agree");
    const isNo =
      nameLower.includes("no") ||
      nameLower.includes("reject") ||
      nameLower.includes("against") ||
      nameLower.includes("disagree");
    const isAbstain = nameLower.includes("abstain") || nameLower.includes("neutral");

    return {
      id: c.id,
      name: c.name,
      party: c.party,
      description:
        c.manifesto ||
        (isYes
          ? "Vote in favor of the proposal / measure."
          : isNo
          ? "Vote against the proposal / measure."
          : "Abstain from voting on this proposal."),
      type: isYes ? "yes" : isNo ? "no" : isAbstain ? "abstain" : "custom",
    };
  });

  const handleSelect = (id: string) => {
    setSelectedId(id);
    onSelectOption(id);
  };

  const handleContinue = () => {
    if (!selectedId) {
      toast.error("Please cast your decision (Yes / No) to continue.");
      return;
    }
    onProceedToReview();
  };

  return (
    <div className="space-y-6">
      {/* Proposal Question Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 to-teal-950 dark:from-[#0a0d11] dark:to-[#0d1117] text-white shadow-lg space-y-3 border border-slate-800 dark:border-[#1a222c]">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-teal-400 dark:text-[#2dd4bf]">
          <HelpCircle className="h-4 w-4" />
          <span>Official Referendum / Ballot Question</span>
        </div>
        <h3 className="text-xl sm:text-2xl font-black leading-snug">
          "{proposalDescription || proposalTitle}"
        </h3>
        <p className="text-xs text-slate-300">
          Please carefully review the resolution statement above before registering your vote.
        </p>
      </div>

      {/* Decision Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {options.map((opt, idx) => {
          const isSelected = selectedId === opt.id;
          const isYes = opt.type === "yes";
          const isNo = opt.type === "no";
          const isAbstain = opt.type === "abstain";

          let borderBgClasses = isSelected
            ? isYes
              ? "border-emerald-600 bg-emerald-50/80 ring-4 ring-emerald-500/20 shadow-md transform -translate-y-0.5"
              : isNo
              ? "border-rose-600 bg-rose-50/80 ring-4 ring-rose-500/20 shadow-md transform -translate-y-0.5"
              : "border-slate-700 bg-slate-100 ring-4 ring-slate-400/20 shadow-md"
            : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs";

          return (
            <motion.div
              key={opt.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: idx * 0.06 }}
              onClick={() => handleSelect(opt.id)}
              className={`p-6 sm:p-8 rounded-3xl border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between space-y-5 ${borderBgClasses}`}
            >
              <div className="flex items-center justify-between">
                {/* Icon */}
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl font-bold text-white shadow-xs ${
                    isYes
                      ? "bg-emerald-600"
                      : isNo
                      ? "bg-rose-600"
                      : "bg-slate-600"
                  }`}
                >
                  {isYes ? (
                    <ThumbsUp className="h-6 w-6" />
                  ) : isNo ? (
                    <ThumbsDown className="h-6 w-6" />
                  ) : (
                    <MinusCircle className="h-6 w-6" />
                  )}
                </div>

                {/* Radio indicator */}
                <div
                  className={`h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all ${
                    isSelected
                      ? isYes
                        ? "border-emerald-600 bg-emerald-600 text-white shadow-xs"
                        : isNo
                        ? "border-rose-600 bg-rose-600 text-white shadow-xs"
                        : "border-slate-700 bg-slate-700 text-white"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  {isSelected && <Check className="h-4 w-4 stroke-[3]" />}
                </div>
              </div>

              <div>
                <span
                  className={`text-[10px] sm:text-xs font-black uppercase tracking-wider block mb-1 ${
                    isYes
                      ? "text-emerald-700"
                      : isNo
                      ? "text-rose-700"
                      : "text-slate-600"
                  }`}
                >
                  {isYes ? "Approve Measure" : isNo ? "Reject Measure" : "Neutral Stand"}
                </span>
                <h4
                  className={`text-xl sm:text-2xl font-black ${
                    isSelected
                      ? isYes
                        ? "text-emerald-950"
                        : isNo
                        ? "text-rose-950"
                        : "text-slate-900"
                      : "text-slate-900"
                  }`}
                >
                  {opt.name}
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {opt.description}
                </p>
              </div>

              {/* Status State */}
              <div className="pt-2 border-t border-slate-100/90 flex items-center justify-between text-xs font-bold">
                <span
                  className={
                    isSelected
                      ? isYes
                        ? "text-emerald-800 font-extrabold"
                        : isNo
                        ? "text-rose-800 font-extrabold"
                        : "text-slate-800"
                      : "text-slate-400 font-medium"
                  }
                >
                  {isSelected ? "Decision Registered" : "Click to select"}
                </span>

                <span
                  className={`text-xs px-3 py-1 rounded-xl transition-all ${
                    isSelected
                      ? isYes
                        ? "bg-emerald-600 text-white"
                        : isNo
                        ? "bg-rose-600 text-white"
                        : "bg-slate-700 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {isSelected ? "Selected Choice" : "Select"}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Action Footer */}
      <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
        {onBackToIntro && (
          <button
            type="button"
            onClick={onBackToIntro}
            className="button button-secondary text-xs w-full sm:w-auto py-2.5 px-4 min-h-[44px]"
          >
            ← Back to Overview
          </button>
        )}

        <button
          type="button"
          onClick={handleContinue}
          disabled={!selectedId}
          className="button button-teal text-xs font-bold py-3 px-8 w-full sm:w-auto min-h-[46px] ml-auto flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
        >
          <span>Confirm Decision</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
