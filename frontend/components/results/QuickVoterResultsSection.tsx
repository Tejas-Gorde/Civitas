"use client";

import React, { useState } from "react";
import {
  Users,
  UserCheck,
  Search,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface QuickVoterResultsSectionProps {
  results: any;
}

export default function QuickVoterResultsSection({ results }: QuickVoterResultsSectionProps) {
  const voterRecords: any[] = results?.voter_records || results?.quick_voter_records || [];
  const candidateVoters: any[] = results?.candidate_voters || [];
  const [activeTab, setActiveTab] = useState<"candidate_centric" | "voter_record">("candidate_centric");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCandidates, setExpandedCandidates] = useState<Record<string, boolean>>({});

  if (!voterRecords.length && !candidateVoters.length) {
    return (
      <div className="card p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-2">
        <Users className="h-8 w-8 text-slate-400 mx-auto" />
        <h4 className="text-sm font-bold text-slate-700">Quick Voter Records</h4>
        <p className="text-xs text-slate-500">
          No quick entry ballots have been recorded for this election yet.
        </p>
      </div>
    );
  }

  const toggleCandidateExpand = (candId: string) => {
    setExpandedCandidates((prev) => ({
      ...prev,
      [candId]: !prev[candId],
    }));
  };

  const filteredVoters = voterRecords.filter((r) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (r.voter_name && r.voter_name.toLowerCase().includes(q)) ||
      (r.prn && r.prn.includes(q)) ||
      (r.vote_given_to && r.vote_given_to.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 pt-4 border-t border-slate-200">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gradient-to-r from-teal-900 to-slate-900 text-white p-5 rounded-2xl shadow-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest bg-teal-500/30 text-teal-300 px-2 py-0.5 rounded-md border border-teal-400/30">
              AUDIT TRAIL
            </span>
            <span className="text-xs text-slate-300 font-semibold">
              {voterRecords.length} Verified Submissions
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-black">
            Quick Voter Verification & Vote Records
          </h3>
          <p className="text-xs text-slate-300">
            Real-time candidate-centric breakdown and voter-wise audit log.
          </p>
        </div>

        {/* View Toggle Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700">
          <button
            type="button"
            onClick={() => setActiveTab("candidate_centric")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "candidate_centric"
                ? "bg-teal-600 text-white shadow-xs"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Candidate-Centric</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("voter_record")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "voter_record"
                ? "bg-teal-600 text-white shadow-xs"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Voter-wise Records</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: CANDIDATE-CENTRIC RESULTS */}
      {activeTab === "candidate_centric" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              Candidate-Wise Voter Breakdown
            </h4>
            <span className="text-xs font-bold text-slate-500">
              {candidateVoters.length} Candidates / Options
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {candidateVoters.map((cg: any, idx: number) => {
              const candKey = cg.candidate_id || `cand_${idx}`;
              const isExpanded = expandedCandidates[candKey] !== false; // expanded by default
              const voters = cg.voters || [];

              return (
                <div
                  key={candKey}
                  className="card p-0 overflow-hidden border border-slate-200 rounded-2xl shadow-xs"
                >
                  {/* Candidate Header Bar */}
                  <div
                    onClick={() => toggleCandidateExpand(candKey)}
                    className="p-4 sm:p-5 bg-slate-50/80 hover:bg-slate-100/80 cursor-pointer transition-colors flex items-center justify-between gap-3 border-b border-slate-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-800 font-black text-sm">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="font-black text-slate-900 text-base">
                            {cg.candidate_name}
                          </h5>
                          {cg.party && (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-200 text-slate-700">
                              {cg.party}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {voters.length === 1 ? "1 Voter" : `${voters.length} Voters`} voted for this option
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="px-3.5 py-1 rounded-xl font-extrabold text-xs bg-teal-50 text-teal-800 border border-teal-200 shadow-xs">
                        Total Votes: {cg.total_votes || voters.length}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Voters List for this Candidate */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 bg-white">
                      {voters.length === 0 ? (
                        <p className="text-xs italic text-slate-400 text-center py-3">
                          No individual votes recorded for this candidate yet.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {voters.map((v: any, vIdx: number) => (
                            <div
                              key={vIdx}
                              className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl space-y-1 hover:border-teal-300 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-extrabold text-xs text-slate-900">
                                  {vIdx + 1}. {v.name || v.voter_name}
                                </span>
                                <CheckCircle2 className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-slate-600">
                                <span className="font-mono font-bold text-slate-700">
                                  PRN: {v.prn}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {v.timestamp || v.cast_at ? new Date(v.timestamp || v.cast_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: VOTER-WISE VOTE RECORD TABLE */}
      {activeTab === "voter_record" && (
        <div className="card p-6 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Voter-Wise Vote Record
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Complete sequential ledger of all participating voters and their selections.
              </p>
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-64">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filter by Name, PRN, or Vote..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input text-xs pl-9 py-2"
              />
            </div>
          </div>

          {filteredVoters.length === 0 ? (
            <p className="text-xs italic text-slate-400 text-center py-6">
              No voter records match your search query.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-extrabold uppercase text-[11px]">
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">Voter Full Name</th>
                    <th className="py-3 px-4">10-Digit PRN</th>
                    <th className="py-3 px-4">Vote Given To</th>
                    <th className="py-3 px-4">Date / Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredVoters.map((r: any, idx: number) => (
                    <tr key={r.id || idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {r.voter_name}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-teal-800">
                        {r.prn}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-indigo-50 text-indigo-800 border border-indigo-200">
                          {r.vote_given_to}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {r.cast_at || r.timestamp
                          ? new Date(r.cast_at || r.timestamp).toLocaleString()
                          : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
