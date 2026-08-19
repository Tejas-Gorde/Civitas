"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, User, ArrowRight, Vote, Check, X } from "lucide-react";
import { toast } from "sonner";

interface Candidate {
  id: string;
  name: string;
  party: string;
  manifesto?: string;
  photo_url?: string | null;
}

interface CustomBallotProps {
  title: string;
  description?: string;
  candidates: Candidate[];
  maxSelections?: number;
  selectedCandidateId: string;
  selectedCandidateIds: string[];
  onSelectSingle: (id: string) => void;
  onSelectMultiple: (ids: string[]) => void;
  onProceedToReview: () => void;
  onBackToIntro?: () => void;
}

export default function CustomBallot({
  title,
  description,
  candidates,
  maxSelections = 1,
  selectedCandidateId,
  selectedCandidateIds,
  onSelectSingle,
  onSelectMultiple,
  onProceedToReview,
  onBackToIntro,
}: CustomBallotProps) {
  const isMulti = maxSelections > 1;
  const [singleId, setSingleId] = useState<string>(selectedCandidateId);
  const [multiIds, setMultiIds] = useState<string[]>(selectedCandidateIds || []);

  const handleSingleClick = (id: string) => {
    setSingleId(id);
    onSelectSingle(id);
  };

  const handleMultiClick = (id: string) => {
    if (multiIds.includes(id)) {
      const updated = multiIds.filter((item) => item !== id);
      setMultiIds(updated);
      onSelectMultiple(updated);
    } else {
      if (multiIds.length >= maxSelections) {
        toast.error(`Maximum ${maxSelections} choices allowed.`);
        return;
      }
      const updated = [...multiIds, id];
      setMultiIds(updated);
      onSelectMultiple(updated);
    }
  };

  const handleContinue = () => {
    if (isMulti) {
      if (multiIds.length === 0) {
        toast.error("Please select at least one choice.");
        return;
      }
    } else {
      if (!singleId) {
        toast.error("Please select an option.");
        return;
      }
    }
    onProceedToReview();
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div>
          <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-sky-800 text-xs font-black">
              1
            </span>
            Custom Election Ballot
          </h3>
          <p className="text-xs text-slate-600 mt-0.5">
            {isMulti
              ? `Select up to ${maxSelections} options below (${multiIds.length}/${maxSelections} selected).`
              : "Choose one option from the certified choices below."}
          </p>
        </div>

        <span className="badge badge-open text-xs font-bold self-start sm:self-auto">
          {isMulti ? `Multi-Choice (${maxSelections} Max)` : "Single Choice"}
        </span>
      </div>

      {/* Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {candidates.map((c, idx) => {
          const isSelected = isMulti ? multiIds.includes(c.id) : singleId === c.id;

          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: idx * 0.05 }}
              onClick={() => (isMulti ? handleMultiClick(c.id) : handleSingleClick(c.id))}
              className={`p-5 sm:p-6 rounded-2xl border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between space-y-4 bg-white relative ${
                isSelected
                  ? "border-sky-600 bg-sky-50/70 ring-4 ring-sky-500/20 shadow-md transform -translate-y-0.5"
                  : "border-slate-200 hover:border-sky-300 hover:bg-slate-50/50 shadow-xs"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-700 block mb-0.5 truncate">
                    {c.party || "Custom Option"}
                  </span>
                  <h4 className="text-base sm:text-lg font-black text-slate-900 truncate">
                    {c.name}
                  </h4>
                  {c.manifesto && (
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                      {c.manifesto}
                    </p>
                  )}
                </div>

                <div
                  className={`h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${
                    isSelected
                      ? "border-sky-600 bg-sky-600 text-white shadow-xs"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  {isSelected && <Check className="h-4 w-4 stroke-[3]" />}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
                <span className={isSelected ? "text-sky-800 font-extrabold" : "text-slate-400"}>
                  {isSelected ? "Active Choice" : "Click to select"}
                </span>

                <span
                  className={`text-[11px] px-2.5 py-1 rounded-lg transition-colors ${
                    isSelected
                      ? "bg-sky-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {isSelected ? "Selected" : "Select"}
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
          disabled={isMulti ? multiIds.length === 0 : !singleId}
          className="button button-teal text-xs font-bold py-3 px-8 w-full sm:w-auto min-h-[46px] ml-auto flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
        >
          <span>Continue to Review</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
