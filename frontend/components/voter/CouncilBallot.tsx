"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckSquare,
  Square,
  CheckCircle2,
  User,
  ArrowRight,
  AlertCircle,
  Scale,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface Candidate {
  id: string;
  name: string;
  party: string;
  manifesto?: string;
  photo_url?: string | null;
  symbol_url?: string | null;
}

interface CouncilBallotProps {
  candidates: Candidate[];
  selectedCandidateIds: string[];
  maxSelections: number;
  onSelectCandidateIds: (ids: string[]) => void;
  onProceedToReview: () => void;
  onBackToIntro?: () => void;
}

export default function CouncilBallot({
  candidates,
  selectedCandidateIds,
  maxSelections = 1,
  onSelectCandidateIds,
  onProceedToReview,
  onBackToIntro,
}: CouncilBallotProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(selectedCandidateIds || []);

  const seatsAvailable = Math.max(1, maxSelections);
  const remainingSlots = seatsAvailable - selectedIds.length;

  const toggleCandidate = (id: string) => {
    if (selectedIds.includes(id)) {
      const updated = selectedIds.filter((item) => item !== id);
      setSelectedIds(updated);
      onSelectCandidateIds(updated);
    } else {
      if (selectedIds.length >= seatsAvailable) {
        toast.error(
          `Maximum ${seatsAvailable} candidate${seatsAvailable > 1 ? "s" : ""} allowed. Deselect one first.`
        );
        return;
      }
      const updated = [...selectedIds, id];
      setSelectedIds(updated);
      onSelectCandidateIds(updated);
    }
  };

  const handleContinue = () => {
    if (selectedIds.length === 0) {
      toast.error("Please select at least one candidate before proceeding.");
      return;
    }
    onProceedToReview();
  };

  return (
    <div className="space-y-6">
      {/* Live Selection Counter Header Pill */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-purple-300" />
            <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
              Council / Committee Ballot
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-black">
            Select up to {seatsAvailable} Candidate{seatsAvailable > 1 ? "s" : ""}
          </h3>
        </div>

        {/* Dynamic Selection Meter */}
        <div className="flex items-center gap-3 self-start sm:self-auto bg-white/10 backdrop-blur-xs px-4 py-2 rounded-xl border border-white/15">
          <div className="text-right">
            <span className="text-xs text-purple-200 block">Selection Status:</span>
            <span className="text-sm sm:text-base font-extrabold text-white">
              {selectedIds.length} / {seatsAvailable} Selected
            </span>
          </div>
          <div
            className={`h-9 w-9 rounded-full flex items-center justify-center font-black text-xs ${
              selectedIds.length === seatsAvailable
                ? "bg-emerald-500 text-white"
                : selectedIds.length > 0
                ? "bg-purple-500 text-white"
                : "bg-white/20 text-white"
            }`}
          >
            {remainingSlots === 0 ? <Check className="h-5 w-5 stroke-[3]" /> : `${remainingSlots}`}
          </div>
        </div>
      </div>

      {/* Helper Status Alert */}
      <div className="flex items-center justify-between text-xs text-slate-600 px-1 font-medium">
        <span>
          {remainingSlots > 0
            ? `You may pick ${remainingSlots} more candidate${remainingSlots > 1 ? "s" : ""}.`
            : "All available seat selections allocated."}
        </span>
        <span className="text-purple-700 font-bold">
          Click any card to select or deselect
        </span>
      </div>

      {/* Candidate Grid */}
      {candidates.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 text-sm">
          No candidates registered for this council election yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {candidates.map((cand, idx) => {
            const isSelected = selectedIds.includes(cand.id);

            return (
              <motion.div
                key={cand.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.04 }}
                onClick={() => toggleCandidate(cand.id)}
                className={`p-5 sm:p-6 rounded-2xl border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between space-y-4 bg-white relative ${
                  isSelected
                    ? "border-purple-600 bg-purple-50/70 ring-4 ring-purple-500/20 shadow-md transform -translate-y-0.5"
                    : "border-slate-200 hover:border-purple-300 hover:bg-slate-50/50 shadow-xs"
                }`}
              >
                {/* Top Info */}
                <div className="flex items-start gap-3.5 sm:gap-4">
                  <div className="h-16 w-16 sm:h-18 sm:w-18 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                    {cand.photo_url ? (
                      <img
                        src={cand.photo_url}
                        alt={cand.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="h-8 w-8 text-slate-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-purple-700 truncate">
                        {cand.party || "Council Nominee"}
                      </span>

                      {/* Checkbox Indicator */}
                      <div
                        className={`h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                          isSelected
                            ? "border-purple-600 bg-purple-600 text-white shadow-xs"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {isSelected && <Check className="h-4 w-4 stroke-[3]" />}
                      </div>
                    </div>

                    <h4 className="text-base sm:text-lg font-black text-slate-900 mt-0.5 truncate">
                      {cand.name}
                    </h4>

                    {cand.manifesto && (
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                        "{cand.manifesto}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer State */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
                  <span
                    className={
                      isSelected
                        ? "text-purple-800 font-extrabold flex items-center gap-1"
                        : "text-slate-400 font-medium"
                    }
                  >
                    {isSelected ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-purple-600 inline" />
                        Selected for Seat
                      </>
                    ) : (
                      "Click to toggle"
                    )}
                  </span>

                  <span
                    className={`text-[11px] px-2.5 py-1 rounded-lg transition-colors ${
                      isSelected
                        ? "bg-purple-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {isSelected ? "Selected" : "Add Selection"}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Selected Items Quick Pill Tray */}
      {selectedIds.length > 0 && (
        <div className="p-3.5 sm:p-4 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-purple-900 block">
            Selected Roster ({selectedIds.length} candidate{selectedIds.length > 1 ? "s" : ""}):
          </span>
          <div className="flex flex-wrap gap-2">
            {selectedIds.map((id) => {
              const cand = candidates.find((c) => c.id === id);
              if (!cand) return null;
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold shadow-xs"
                >
                  <span>{cand.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCandidate(id);
                    }}
                    className="hover:bg-purple-700 rounded-full p-0.5 transition"
                    aria-label={`Remove ${cand.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

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
          disabled={selectedIds.length === 0}
          className="button button-teal text-xs font-bold py-3 px-8 w-full sm:w-auto min-h-[46px] ml-auto flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
        >
          <span>Review {selectedIds.length} Selection{selectedIds.length === 1 ? "" : "s"}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
