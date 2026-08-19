"use client";

import { motion } from "framer-motion";
import {
  Shield,
  CheckCircle2,
  ArrowRight,
  Info,
  Users,
  Lock,
  Vote,
  Sparkles,
  Award,
  Layers,
  HelpCircle,
} from "lucide-react";
import { getElectionTypeInfo } from "./ElectionHeader";

interface ElectionIntroProps {
  election: {
    id: string;
    name: string;
    description?: string;
    voting_type?: string;
    max_selections?: number;
    allow_abstain?: boolean;
    position_title?: string | null;
    candidate_count?: number;
  };
  voterName?: string;
  onStartVoting: () => void;
}

export default function ElectionIntro({
  election,
  voterName,
  onStartVoting,
}: ElectionIntroProps) {
  const typeInfo = getElectionTypeInfo(election.voting_type);
  const TypeIcon = typeInfo.icon;
  const maxSel = election.max_selections || 1;
  const isCouncil =
    election.voting_type === "council" ||
    election.voting_type === "multiple_choice";
  const isReferendum =
    election.voting_type === "referendum" || election.voting_type === "yes_no";
  const isPresidential = election.voting_type === "presidential";

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="max-w-2xl mx-auto space-y-5 sm:space-y-6"
    >
      {/* Auth Verified Notification Card */}
      <div className="p-4 sm:p-5 bg-emerald-50/90 border border-emerald-200/90 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-emerald-950">
              Identity Verified & Secured
            </h4>
            <p className="text-[11px] sm:text-xs text-emerald-800">
              {voterName ? `Welcome, ${voterName}. ` : ""}You are authorized to participate in this election.
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-full border border-emerald-300/60">
          <Lock className="h-3 w-3" />
          Encrypted Session
        </div>
      </div>

      {/* Main Election Intro Showcase Card */}
      <div className="card p-6 sm:p-10 bg-white border border-slate-200/90 shadow-md rounded-3xl space-y-6">
        {/* Brand & Type Badge */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-800">
            <Shield className="h-4 w-4 text-teal-600" />
            <span>CIVITAS SECURE BALLOT</span>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${typeInfo.badgeClass}`}
          >
            <TypeIcon className="h-3.5 w-3.5" />
            {typeInfo.label}
          </span>
        </div>

        {/* Election Title & Overview */}
        <div className="space-y-2">
          {election.position_title && (
            <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-widest text-teal-700 block">
              Office / Contested Seat: {election.position_title}
            </span>
          )}
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            {election.name}
          </h2>
          {election.description && (
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed pt-1">
              {election.description}
            </p>
          )}
        </div>

        {/* Dynamic Election Rules & Constraints Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Selection Limit
            </span>
            <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
              <Vote className="h-4 w-4 text-teal-600" />
              <span>
                {isCouncil
                  ? `Select up to ${maxSel} Candidate${maxSel > 1 ? "s" : ""}`
                  : isReferendum
                  ? "Single Decision (Yes / No)"
                  : "Exactly 1 Candidate"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 pt-0.5">
              {isCouncil
                ? `You have ${maxSel} seat vote${maxSel > 1 ? "s" : ""} to allocate on this ballot.`
                : isReferendum
                ? "Choose to approve or reject the proposed measure."
                : "You may cast your vote for one candidate only."}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Ballot Privacy
            </span>
            <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
              <Lock className="h-4 w-4 text-teal-600" />
              <span>Cryptographic Secrecy</span>
            </div>
            <p className="text-[11px] text-slate-500 pt-0.5">
              Identity checks are severed from your vote to guarantee total anonymity.
            </p>
          </div>
        </div>

        {/* Voting Instructions Box */}
        <div className="p-4 rounded-2xl bg-teal-50/60 border border-teal-100/90 text-xs text-teal-950 space-y-1.5">
          <div className="font-bold flex items-center gap-1.5 text-teal-900">
            <Info className="h-4 w-4 text-teal-600 shrink-0" />
            <span>Before you begin:</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-slate-700 text-[11px] sm:text-xs">
            <li>Review candidate manifestos and credentials carefully.</li>
            <li>You will have a confirmation review step before final submission.</li>
            <li>Once submitted, ballots cannot be altered or re-cast.</li>
          </ul>
        </div>

        {/* CTA Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onStartVoting}
            className="w-full button button-teal py-3.5 sm:py-4 px-6 text-sm font-black tracking-wide rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 min-h-[50px] cursor-pointer"
          >
            <span>Start Voting & Open Ballot</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
