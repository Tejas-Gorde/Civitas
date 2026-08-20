"use client";

import { motion } from "framer-motion";
import {
  ShieldCheck,
  ArrowLeft,
  Lock,
  User,
  AlertTriangle,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  Building,
  Scale,
  Award,
} from "lucide-react";
import { getElectionTypeInfo } from "./ElectionHeader";

interface Candidate {
  id: string;
  name: string;
  party: string;
  manifesto?: string;
  photo_url?: string | null;
  symbol_url?: string | null;
}

interface VoteReviewProps {
  election: {
    id: string;
    name: string;
    description?: string;
    voting_type?: string;
    position_title?: string | null;
    max_selections?: number;
  };
  candidates: Candidate[];
  selectedCandidateId: string;
  selectedCandidateIds: string[];
  voterName?: string;
  isSubmitting?: boolean;
  onBackToBallot: () => void;
  onConfirmVote: () => void;
}

export default function VoteReview({
  election,
  candidates,
  selectedCandidateId,
  selectedCandidateIds,
  voterName,
  isSubmitting = false,
  onBackToBallot,
  onConfirmVote,
}: VoteReviewProps) {
  const typeInfo = getElectionTypeInfo(election.voting_type);
  const isCouncil =
    election.voting_type === "council" ||
    election.voting_type === "multiple_choice";
  const isReferendum =
    election.voting_type === "referendum" || election.voting_type === "yes_no";
  const isPresidential = election.voting_type === "presidential";

  // Resolve selected candidate objects
  const selectedList: Candidate[] = isCouncil
    ? candidates.filter((c) => selectedCandidateIds.includes(c.id))
    : candidates.filter((c) => c.id === selectedCandidateId);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25 }}
      className="max-w-2xl mx-auto space-y-5 sm:space-y-6"
    >
      {/* Header Banner */}
      <div className="card p-5 sm:p-8 bg-gradient-to-br from-slate-900 to-teal-950 dark:from-[#0a0d11] dark:to-[#0d1117] text-white rounded-3xl border border-slate-800 dark:border-[#1a222c] shadow-xl space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-teal-400 dark:text-[#2dd4bf]">
          <ShieldCheck className="h-4 w-4" />
          <span>BALLOT REVIEW & FINAL CONFIRMATION</span>
        </div>
        <h2 className="text-xl sm:text-3xl font-black text-white">
          Review Your Selected Vote
        </h2>
        <p className="text-xs sm:text-sm text-slate-300">
          Please verify your chosen candidate{selectedList.length > 1 ? "s" : ""} or ballot decision below before final cryptographic sealing.
        </p>
      </div>

      {/* Main Review Card */}
      <div className="card p-6 sm:p-8 bg-white border border-slate-200 shadow-md rounded-3xl space-y-6">
        {/* Election Metadata Summary */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 block">
              Election
            </span>
            <h3 className="text-base font-bold text-slate-900">{election.name}</h3>
            {election.position_title && (
              <span className="text-xs font-semibold text-teal-700">
                Office: {election.position_title}
              </span>
            )}
          </div>

          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border self-start sm:self-auto ${typeInfo.badgeClass}`}
          >
            {typeInfo.shortLabel}
          </span>
        </div>

        {/* Selected Candidates Showcase */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              Your Ballot Selection ({selectedList.length} Choice{selectedList.length === 1 ? "" : "s"}):
            </span>
            <button
              type="button"
              onClick={onBackToBallot}
              disabled={isSubmitting}
              className="text-xs font-bold text-teal-700 hover:text-teal-900 underline cursor-pointer"
            >
              Change Selection
            </button>
          </div>

          {selectedList.length === 0 ? (
            <div className="p-6 text-center bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold">
              No candidate selected. Please return to ballot to make your choice.
            </div>
          ) : (
            <div className="space-y-3">
              {selectedList.map((cand) => {
                const nameLower = cand.name.toLowerCase();
                const isYes =
                  nameLower.includes("yes") || nameLower.includes("approve");
                const isNo =
                  nameLower.includes("no") || nameLower.includes("reject");

                return (
                  <div
                    key={cand.id}
                    className={`p-4 sm:p-5 rounded-2xl border-2 flex items-center justify-between gap-4 ${
                      isReferendum
                        ? isYes
                          ? "border-emerald-500 bg-emerald-50/70"
                          : isNo
                          ? "border-rose-500 bg-rose-50/70"
                          : "border-slate-300 bg-slate-50"
                        : isPresidential
                        ? "border-indigo-500 bg-indigo-50/60"
                        : isCouncil
                        ? "border-purple-500 bg-purple-50/60"
                        : "border-teal-500 bg-teal-50/60"
                    }`}
                  >
                    <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                      {/* Avatar / Icon */}
                      {isReferendum ? (
                        <div
                          className={`h-12 w-12 rounded-2xl flex items-center justify-center text-white font-bold shrink-0 ${
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
                            <CheckCircle2 className="h-6 w-6" />
                          )}
                        </div>
                      ) : (
                        <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                          {cand.photo_url ? (
                            <img
                              src={cand.photo_url}
                              alt={cand.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <User className="h-7 w-7 text-slate-400" />
                          )}
                        </div>
                      )}

                      {/* Candidate info */}
                      <div className="min-w-0">
                        <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-500 block truncate">
                          {cand.party || "Certified Ballot Choice"}
                        </span>
                        <h4 className="text-base sm:text-lg font-black text-slate-950 truncate">
                          {cand.name}
                        </h4>
                        {election.position_title && (
                          <span className="text-[11px] text-slate-600">
                            Nominated for {election.position_title}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 bg-white px-3 py-1.5 rounded-xl border border-emerald-200 shrink-0 shadow-xs">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span className="hidden sm:inline">Confirmed</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Warning Notice */}
        <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">Final Vote Submission Confirmation</p>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Once you click <strong>"Confirm & Cast Vote"</strong>, your ballot will be cryptographically sealed and recorded on the secure ledger. You cannot change your vote after submission.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBackToBallot}
            disabled={isSubmitting}
            className="button button-secondary text-xs w-full sm:w-auto py-3 px-5 min-h-[46px] flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Change Selection</span>
          </button>

          <button
            type="button"
            onClick={onConfirmVote}
            disabled={isSubmitting || selectedList.length === 0}
            className="button button-teal text-xs font-black tracking-wide py-3 px-8 w-full sm:w-auto min-h-[48px] flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
          >
            <Lock className="h-4 w-4" />
            <span>Confirm & Cast Vote</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
