"use client";

import { Shield, UserCheck, Vote, CheckCircle2, Building, Scale, HelpCircle } from "lucide-react";

interface ElectionHeaderProps {
  name: string;
  votingType?: string;
  positionTitle?: string | null;
  voterName?: string;
  prnOrId?: string;
  isQuickMode?: boolean;
}

export function getElectionTypeInfo(type?: string) {
  const normalized = (type || "general").toLowerCase();
  switch (normalized) {
    case "presidential":
      return {
        label: "Presidential / Leader Election",
        shortLabel: "Presidential",
        badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
        icon: Building,
        ruleText: "Select one candidate to lead the executive office.",
      };
    case "council":
    case "multiple_choice":
      return {
        label: "Council / Committee Multi-Seat Election",
        shortLabel: "Council Ballot",
        badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
        icon: Scale,
        ruleText: "Select multiple representatives for open council seats.",
      };
    case "referendum":
    case "yes_no":
      return {
        label: "Referendum / Policy Ballot",
        shortLabel: "Referendum",
        badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
        icon: HelpCircle,
        ruleText: "Cast your vote on the proposed policy question.",
      };
    case "custom":
    case "poll":
    case "rating":
      return {
        label: "Custom Election / Public Poll",
        shortLabel: "Custom Election",
        badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
        icon: Vote,
        ruleText: "Cast your ballot according to configured election rules.",
      };
    case "general":
    case "regular":
    default:
      return {
        label: "General Election",
        shortLabel: "General Ballot",
        badgeClass: "bg-teal-50 text-teal-700 border-teal-200",
        icon: Shield,
        ruleText: "Select one candidate from the certified ballot roster.",
      };
  }
}

export default function ElectionHeader({
  name,
  votingType,
  positionTitle,
  voterName,
  prnOrId,
  isQuickMode,
}: ElectionHeaderProps) {
  const typeInfo = getElectionTypeInfo(votingType);
  const TypeIcon = typeInfo.icon;

  return (
    <div className="card p-5 sm:p-7 bg-gradient-to-r from-slate-950 via-slate-900 to-teal-950 text-white rounded-2xl border border-slate-800 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-teal-400 bg-teal-950/80 px-3 py-1.5 rounded-full border border-teal-800/60 shadow-xs">
          <TypeIcon className="h-3.5 w-3.5" />
          <span>{typeInfo.label}</span>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-300">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/90 border border-slate-700 text-[11px] font-medium text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Ballot Session Active
          </span>
        </div>
      </div>

      <div>
        {positionTitle && (
          <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-widest text-teal-400 block mb-1">
            Office / Role: {positionTitle}
          </span>
        )}
        <h1 className="text-xl sm:text-3xl font-black tracking-tight text-white">
          {name}
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
          {typeInfo.ruleText}
        </p>
      </div>

      {(voterName || prnOrId) && (
        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <UserCheck className="h-3.5 w-3.5 text-teal-400" />
            <span>Authenticated Voter: <strong className="text-white">{voterName || "Eligible Voter"}</strong></span>
          </div>
          {prnOrId && (
            <div className="font-mono text-[11px] bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/60 text-slate-300">
              {isQuickMode ? `PRN: ${prnOrId}` : `Voter ID: ${prnOrId}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
