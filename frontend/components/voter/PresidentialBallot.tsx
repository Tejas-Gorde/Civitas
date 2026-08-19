"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, User, ArrowRight, Building, Award, Check, FileText } from "lucide-react";
import { toast } from "sonner";

interface Candidate {
  id: string;
  name: string;
  party: string;
  manifesto?: string;
  photo_url?: string | null;
  symbol_url?: string | null;
}

interface PresidentialBallotProps {
  candidates: Candidate[];
  selectedCandidateId: string;
  positionTitle?: string | null;
  onSelectCandidate: (id: string) => void;
  onProceedToReview: () => void;
  onBackToIntro?: () => void;
}

export default function PresidentialBallot({
  candidates,
  selectedCandidateId,
  positionTitle,
  onSelectCandidate,
  onProceedToReview,
  onBackToIntro,
}: PresidentialBallotProps) {
  const [selectedId, setSelectedId] = useState<string>(selectedCandidateId);

  const handleCardClick = (id: string) => {
    setSelectedId(id);
    onSelectCandidate(id);
  };

  const handleContinue = () => {
    if (!selectedId) {
      toast.error("Please select a presidential candidate to continue.");
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
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-800 text-xs font-black">
              1
            </span>
            Presidential Candidate Ballot
          </h3>
          <p className="text-xs text-slate-600 mt-0.5">
            Electing: <strong>{positionTitle || "President / Executive Leader"}</strong>. Choose one candidate.
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 self-start sm:self-auto">
          <Building className="h-3.5 w-3.5" />
          Single Executive Vote
        </span>
      </div>

      {/* Candidate Profile Cards Grid */}
      {candidates.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 text-sm">
          No presidential candidates registered yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
          {candidates.map((cand, idx) => {
            const isSelected = selectedId === cand.id;

            return (
              <motion.div
                key={cand.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.08 }}
                onClick={() => handleCardClick(cand.id)}
                className={`p-6 sm:p-7 rounded-3xl border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between space-y-5 bg-white relative ${
                  isSelected
                    ? "border-indigo-600 bg-indigo-50/50 ring-4 ring-indigo-500/20 shadow-lg transform -translate-y-1"
                    : "border-slate-200 hover:border-indigo-300 hover:shadow-md"
                }`}
              >
                {/* Presidential Candidate Card Body */}
                <div className="space-y-4">
                  <div className="flex items-start gap-4 sm:gap-5">
                    {/* Large Candidate Portrait */}
                    <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl bg-slate-100 border-2 border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                      {cand.photo_url ? (
                        <img
                          src={cand.photo_url}
                          alt={cand.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User className="h-10 w-10 text-slate-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-indigo-700 bg-indigo-100/70 px-2.5 py-0.5 rounded-full border border-indigo-200">
                          {cand.party || "Nominee"}
                        </span>

                        {/* Large Selection Indicator */}
                        <div
                          className={`h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all ${
                            isSelected
                              ? "border-indigo-600 bg-indigo-600 text-white shadow-xs"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {isSelected && <Check className="h-4 w-4 stroke-[3]" />}
                        </div>
                      </div>

                      <h4 className="text-lg sm:text-xl font-black text-slate-950 mt-1.5 truncate">
                        {cand.name}
                      </h4>

                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                        <Award className="h-3.5 w-3.5 text-indigo-600" />
                        <span>Candidate for {positionTitle || "President"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Manifesto Section */}
                  {cand.manifesto ? (
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-700 leading-relaxed">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Platform & Vision:
                      </span>
                      <p className="italic">"{cand.manifesto}"</p>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic">
                      No platform manifesto submitted.
                    </div>
                  )}
                </div>

                {/* Card Action & Active Status Banner */}
                <div
                  className={`pt-3 border-t flex items-center justify-between text-xs font-bold transition-colors ${
                    isSelected
                      ? "border-indigo-200 text-indigo-900"
                      : "border-slate-100 text-slate-500"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {isSelected ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                        <span>Chosen Candidate for Office</span>
                      </>
                    ) : (
                      "Click to select for leadership"
                    )}
                  </span>

                  <button
                    type="button"
                    className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition-all ${
                      isSelected
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {isSelected ? "Selected" : "Select Candidate"}
                  </button>
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
