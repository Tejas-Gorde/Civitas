"use client";

import React from "react";
import {
  CheckCircle2,
  XCircle,
  Vote,
  Users,
  TrendingUp,
  FileSpreadsheet,
  HelpCircle,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";

interface DecisionDashboardProps {
  results: any;
  onExportExcel: () => void;
  exporting?: boolean;
}

export default function DecisionDashboard({
  results,
  onExportExcel,
  exporting = false,
}: DecisionDashboardProps) {
  const el = results?.election || {};
  const stats = results?.statistics || {};
  const dec = results?.decision || {};

  const totalVotes = dec.total_votes || stats.votes_cast || 0;
  const yesVotes = dec.yes_votes || 0;
  const noVotes = dec.no_votes || 0;
  const yesPct = dec.yes_percentage || (totalVotes > 0 ? ((yesVotes / totalVotes) * 100).toFixed(1) : 0);
  const noPct = dec.no_percentage || (totalVotes > 0 ? ((noVotes / totalVotes) * 100).toFixed(1) : 0);
  const isApproved = dec.result === "APPROVED";
  const isRejected = dec.result === "REJECTED";
  const isTied = dec.result === "TIED";

  const chartData = [
    { name: "YES / APPROVE", value: yesVotes, percentage: yesPct, color: "#10b981" },
    { name: "NO / REJECT", value: noVotes, percentage: noPct, color: "#f43f5e" },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header & Export Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-[#0a0d11] dark:to-[#0d1117] p-6 rounded-2xl text-white shadow-md border border-slate-700 dark:border-[#1a222c]">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs font-bold uppercase tracking-wider">
              Yes / No Decision
            </span>
            <span className="text-xs text-slate-400 font-mono">
              ID: {el.election_id || el.id}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black mt-2 tracking-tight text-white">
            {el.name}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Referendum Ballot & Proposal Decision Determination
          </p>
        </div>

        <button
          type="button"
          onClick={onExportExcel}
          disabled={exporting}
          className="button bg-emerald-600 hover:bg-emerald-500 text-white min-h-[46px] px-5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shrink-0 shadow-md shadow-emerald-950/20 rounded-xl"
        >
          {exporting ? (
            <span className="inline-block animate-spin">⟳</span>
          ) : (
            <FileSpreadsheet className="h-4 w-4 text-emerald-100" />
          )}
          <span>Export Results to Excel</span>
        </button>
      </div>

      {/* Proposal Statement Card */}
      <div className="card p-5 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2">
        <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
          <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
          Proposal / Measure Text
        </span>
        <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
          "{dec.proposal || el.description || el.name}"
        </h3>
      </div>

      {/* Decision Outcome Banner */}
      <div
        className={`p-6 sm:p-8 rounded-2xl border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-5 ${
          isApproved
            ? "bg-gradient-to-r from-emerald-50 via-teal-50 to-white border-emerald-300"
            : isRejected
            ? "bg-gradient-to-r from-rose-50 via-pink-50 to-white border-rose-300"
            : "bg-gradient-to-r from-amber-50 to-white border-amber-300"
        }`}
      >
        <div className="flex items-start sm:items-center gap-4">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-md shrink-0 ${
              isApproved
                ? "bg-emerald-600 shadow-emerald-600/30"
                : isRejected
                ? "bg-rose-600 shadow-rose-600/30"
                : "bg-amber-600 shadow-amber-600/30"
            }`}
          >
            {isApproved ? (
              <CheckCircle2 className="h-8 w-8" />
            ) : isRejected ? (
              <XCircle className="h-8 w-8" />
            ) : (
              <AlertTriangle className="h-8 w-8" />
            )}
          </div>
          <div>
            <span
              className={`text-xs font-black uppercase tracking-widest ${
                isApproved
                  ? "text-emerald-800"
                  : isRejected
                  ? "text-rose-800"
                  : "text-amber-800"
              }`}
            >
              Certified Ballot Outcome
            </span>
            <h3
              className={`text-2xl sm:text-4xl font-black mt-0.5 tracking-tight ${
                isApproved
                  ? "text-emerald-950"
                  : isRejected
                  ? "text-rose-950"
                  : "text-amber-950"
              }`}
            >
              {dec.result || "PENDING"}
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              {isApproved && `Measure passed by ${dec.margin_percentage || 0}% margin.`}
              {isRejected && `Measure failed by ${dec.margin_percentage || 0}% margin.`}
              {isTied && "Exact tie recorded. Awaiting resolution."}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:items-end gap-1.5 self-start sm:self-auto bg-white/90 p-4 rounded-xl border border-slate-200">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Total Ballots Counted
          </span>
          <span className="text-2xl font-black text-slate-900 font-mono">
            {totalVotes.toLocaleString()}
          </span>
        </div>
      </div>

      {/* YES vs NO Split Bar */}
      <div className="card p-5 sm:p-6 border border-slate-200 rounded-2xl bg-white shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-emerald-500" />
            <span className="font-extrabold text-sm text-slate-900">
              YES: {Number(yesPct).toFixed(1)}% ({yesVotes.toLocaleString()} votes)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm text-slate-900">
              NO: {Number(noPct).toFixed(1)}% ({noVotes.toLocaleString()} votes)
            </span>
            <span className="inline-block h-3 w-3 rounded-full bg-rose-500" />
          </div>
        </div>

        {/* Visual Progress Split */}
        <div className="h-6 w-full bg-slate-100 rounded-full overflow-hidden flex p-1 border border-slate-200">
          <div
            className="h-full bg-emerald-500 rounded-l-full transition-all duration-500"
            style={{ width: `${Math.max(2, Math.min(98, Number(yesPct)))}%` }}
          />
          <div
            className="h-full bg-rose-500 rounded-r-full transition-all duration-500"
            style={{ width: `${Math.max(2, Math.min(98, Number(noPct)))}%` }}
          />
        </div>
      </div>

      {/* Metrics Breakdown & Pie Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Detail Cards */}
        <div className="space-y-3 sm:space-y-4">
          <div className="card p-4 sm:p-5 border-l-4 border-l-emerald-500 border border-slate-200 rounded-2xl bg-white shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-800">
                In Favor (YES)
              </span>
              <p className="text-xl sm:text-2xl font-black text-emerald-950 mt-0.5">
                {yesVotes.toLocaleString()} votes
              </p>
            </div>
            <span className="text-2xl font-black text-emerald-700 font-mono">
              {Number(yesPct).toFixed(1)}%
            </span>
          </div>

          <div className="card p-4 sm:p-5 border-l-4 border-l-rose-500 border border-slate-200 rounded-2xl bg-white shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-rose-800">
                In Opposition (NO)
              </span>
              <p className="text-xl sm:text-2xl font-black text-rose-950 mt-0.5">
                {noVotes.toLocaleString()} votes
              </p>
            </div>
            <span className="text-2xl font-black text-rose-700 font-mono">
              {Number(noPct).toFixed(1)}%
            </span>
          </div>

          <div className="card p-4 sm:p-5 border border-slate-200 rounded-2xl bg-white shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
                Voter Turnout Rate
              </span>
              <p className="text-lg font-bold text-slate-800 mt-0.5">
                {(stats.turnout_percentage || 0).toFixed(1)}% of eligible electorate
              </p>
            </div>
            <span className="text-sm font-extrabold text-slate-900 font-mono">
              {(stats.eligible_voters || stats.registered_voters || 0).toLocaleString()} Registered
            </span>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="card p-5 sm:p-6 border border-slate-200 rounded-2xl bg-white shadow-xs space-y-3">
          <div className="border-b border-slate-100 pb-2">
            <h4 className="text-sm font-bold text-slate-900">
              Decision Share Breakdown
            </h4>
          </div>
          <div className="h-56 sm:h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  innerRadius={40}
                  paddingAngle={4}
                  label={(entry) => `${entry.name}: ${Number(entry.percentage).toFixed(1)}%`}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(val: any, name: any) => [`${val} votes`, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
