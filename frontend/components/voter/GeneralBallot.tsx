"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, User, ArrowRight, ShieldCheck, FileText, Check } from "lucide-react";
import { toast } from "sonner";

interface Candidate {
  id: string;
  name: string;
  party: string;
  manifesto?: string;
  photo_url?: string | null;
  symbol_url?: string | null;
}

interface GeneralBallotProps {
  candidates: Candidate[];
  selectedCandidateId: string;
  onSelectCandidate: (id: string) => void;
  onProceedToReview: () => void;
  onBackToIntro?: () => void;
}

export default function GeneralBallot({
  candidates,
  selectedCandidateId,
  onSelectCandidate,
  onProceedToReview,
  onBackToIntro,
}: GeneralBallotProps) {
  const [selectedId, setSelectedId] = useState<string>(selectedCandidateId);

  const handleCardClick = (id: string) => {
    setSelectedId(id);
    onSelectCandidate(id);
  };

  const handleContinue = () => {
    if (!selectedId) {
      toast.error("Please select a candidate to continue.");
      return;
    }
    onProceedToReview();
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div>
          <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 text-teal-800 text-xs font-black">
              1
            </span>
            Official General Ballot
          </h3>
          <p className="text-xs text-slate-600 mt-0.5">
            Select one candidate from the ballot below. Click any card to select.
          </p>
        </div>

        <span className="badge badge-open text-xs font-bold self-start sm:self-auto">
          Single Choice Allowed
        </span>
      </div>

      {/* Candidate Cards Grid */}
      {candidates.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 text-sm">
          No candidates registered for this election yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {candidates.map((cand, idx) => {
            const isSelected = selectedId === cand.id;

            return (
              <motion.div
                key={cand.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.05 }}
                onClick={() => handleCardClick(cand.id)}
                className={`p-5 sm:p-6 rounded-2xl border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between space-y-4 relative ${
                  isSelected
                    ? "border-teal-600 bg-teal-50/70 ring-4 ring-teal-500/20 shadow-md transform -translate-y-0.5"
                    : "border-slate-200 bg-white hover:border-teal-300 hover:bg-slate-50/60 shadow-xs"
                }`}
              >
                {/* Top Row: Photo, Name, Party, Selection Radio Indicator */}
                <div className="flex items-start gap-4">
                  {/* Candidate Photo or Symbol */}
                  <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
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

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-teal-700 truncate">
                        {cand.party || "Independent"}
                      </span>

                      {/* Radio Check Indicator */}
                      <div
                        className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${
                          isSelected
                            ? "border-teal-600 bg-teal-600 text-white shadow-xs"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                      </div>
                    </div>

                    <h4 className="text-base sm:text-lg font-black text-slate-900 mt-0.5 truncate">
                      {cand.name}
                    </h4>

                    {cand.symbol_url && (
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                        <img
                          src={cand.symbol_url}
                          alt="Party symbol"
                          className="h-4 w-4 object-contain"
                        />
                        <span className="text-[11px]">Certified Symbol</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Manifesto Snippet if available */}
                {cand.manifesto && (
                  <div className="pt-2 border-t border-slate-100/90 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    "{cand.manifesto}"
                  </div>
                )}

                {/* Selection Footer State */}
                <div className="pt-1 flex items-center justify-between text-xs font-bold">
                  <span
                    className={
                      isSelected
                        ? "text-teal-800 font-extrabold flex items-center gap-1"
                        : "text-slate-400 font-medium"
                    }
                  >
                    {isSelected ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-teal-600 inline" />
                        Selected Candidate
                      </>
                    ) : (
                      "Click to choose"
                    )}
                  </span>

                  <span
                    className={`text-[11px] px-2.5 py-1 rounded-lg transition-colors ${
                      isSelected
                        ? "bg-teal-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {isSelected ? "Active Choice" : "Select"}
                  </span>
                </div>
              </motion.div>
            );
          })}
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
          disabled={!selectedId}
          className="button button-teal text-xs font-bold py-3 px-8 w-full sm:w-auto min-h-[46px] ml-auto flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
        >
          <span>Continue to Review</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
