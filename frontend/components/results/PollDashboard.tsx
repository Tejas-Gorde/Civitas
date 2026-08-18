"use client";

import React from "react";
import {
  HelpCircle,
  MessageSquare,
  Users,
  TrendingUp,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  BarChart3,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell,
} from "recharts";

const POLL_COLORS = [
  "#0d9488", // Teal
  "#0284c7", // Sky
  "#059669", // Emerald
  "#d97706", // Amber
  "#7c3aed", // Violet
  "#e11d48", // Rose
];

interface PollDashboardProps {
  results: any;
  onExportExcel: () => void;
  exporting?: boolean;
}

export default function PollDashboard({
  results,
  onExportExcel,
  exporting = false,
}: PollDashboardProps) {
  const el = results?.election || {};
  const stats = results?.statistics || {};
  const poll = results?.poll || {};
  const options = results?.options || results?.candidates || [];
  const mostSelected = poll?.most_selected_option;
  const hasTie = poll?.has_tie;

  const chartData = options.map((opt: any, idx: number) => ({
    name: opt.name.length > 22 ? opt.name.slice(0, 20) + "..." : opt.name,
    fullName: opt.name,
    votes: opt.votes || 0,
    percentage: opt.percentage || 0,
    fill: POLL_COLORS[idx % POLL_COLORS.length],
  }));

  return (
    <div className="space-y-6">
      {/* Top Banner & Excel Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-teal-950 via-slate-900 to-teal-950 p-6 rounded-2xl text-white shadow-md border border-teal-800/40">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge bg-teal-500/20 text-teal-300 border-teal-500/40 text-xs font-bold uppercase tracking-wider">
              Opinion Poll
            </span>
            <span className="text-xs text-teal-200/70 font-mono">
              ID: {el.election_id || el.id}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black mt-2 tracking-tight text-white">
            {el.name}
          </h2>
          <p className="text-xs sm:text-sm text-teal-100/80 mt-1">
            Community Opinion Survey & Preference Analysis
          </p>
        </div>

        <button
          type="button"
          onClick={onExportExcel}
          disabled={exporting}
          className="button bg-teal-600 hover:bg-teal-500 text-white min-h-[46px] px-5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shrink-0 shadow-md shadow-teal-950/30 rounded-xl"
        >
          {exporting ? (
            <span className="inline-block animate-spin">⟳</span>
          ) : (
            <FileSpreadsheet className="h-4 w-4 text-teal-100" />
          )}
          <span>Export Results to Excel</span>
        </button>
      </div>

      {/* Poll Question Card */}
      <div className="card p-5 sm:p-6 bg-gradient-to-r from-teal-50/70 via-sky-50/50 to-white border border-teal-200 rounded-2xl shadow-xs space-y-2">
        <span className="text-[11px] font-extrabold uppercase tracking-widest text-teal-800 flex items-center gap-1.5">
          <HelpCircle className="h-3.5 w-3.5 text-teal-600" />
          Survey Question
        </span>
        <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
          "{poll.question || el.description || el.name}"
        </h3>
      </div>

      {/* Most Selected Option Banner */}
      {mostSelected && (
        <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border border-teal-300 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-md shadow-teal-600/20 shrink-0">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-teal-800">
                Most Selected Option
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                {mostSelected.name}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Received <strong>{mostSelected.votes.toLocaleString()}</strong> responses ({mostSelected.percentage}% of total responses)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto bg-white/90 px-4 py-2 rounded-xl border border-teal-200">
            <CheckCircle2 className="h-4 w-4 text-teal-600" />
            <span className="text-xs font-bold text-slate-800">
              Top Choice (Rank 1)
            </span>
          </div>
        </div>
      )}

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="card p-4 sm:p-5 border border-slate-200 rounded-2xl bg-white shadow-xs space-y-1">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-teal-700 flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 text-teal-600" />
            Total Responses
          </span>
          <p className="text-xl sm:text-2xl font-black text-slate-900">
            {(poll.total_responses || stats.votes_cast || 0).toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500">Completed submissions</p>
        </div>

        <div className="card p-4 sm:p-5 border border-slate-200 rounded-2xl bg-white shadow-xs space-y-1">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-slate-400" />
            Target Electorate
          </span>
          <p className="text-xl sm:text-2xl font-black text-slate-900">
            {(stats.eligible_voters || stats.registered_voters || 0).toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500">Eligible respondents</p>
        </div>

        <div className="card p-4 sm:p-5 border border-slate-200 rounded-2xl bg-white shadow-xs space-y-1">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-indigo-500" />
            Response Rate
          </span>
          <p className="text-xl sm:text-2xl font-black text-indigo-900">
            {(poll.response_rate || stats.turnout_percentage || 0).toFixed(1)}%
          </p>
          <p className="text-[11px] text-indigo-600">Turnout percentage</p>
        </div>

        <div className="card p-4 sm:p-5 border border-slate-200 rounded-2xl bg-white shadow-xs space-y-1">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5 text-slate-400" />
            Options Provided
          </span>
          <p className="text-xl sm:text-2xl font-black text-slate-900">
            {options.length}
          </p>
          <p className="text-[11px] text-slate-500">Choices evaluated</p>
        </div>
      </div>

      {/* Distribution Chart */}
      {options.length > 0 && (
        <div className="card p-5 sm:p-6 border border-slate-200 rounded-2xl bg-white shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h4 className="text-sm font-bold text-slate-900">
              Poll Option Response Distribution
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Breakdown of participant choices across survey options
            </p>
          </div>
          <div className="h-64 sm:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 30, left: 40, bottom: 10 }}>
                <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#475569" }} width={120} />
                <RechartsTooltip
                  formatter={(val: any, _name: any, item: any) => [
                    `${val} responses (${item.payload.percentage}%)`,
                    item.payload.fullName,
                  ]}
                />
                <Bar dataKey="votes" radius={[0, 6, 6, 0]}>
                  {chartData.map((entry: any, index: number) => (
                    <Cell key={`poll-cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Option Results Table */}
      <div className="card p-5 sm:p-6 border border-slate-200 rounded-2xl bg-white shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Option Breakdown & Tally
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Rank-ordered summary of community responses
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {options.length} Options
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 uppercase font-bold text-[10px] tracking-wider">
                <th className="py-3 px-3 w-14 text-center">Rank</th>
                <th className="py-3 px-3">Option</th>
                <th className="py-3 px-3 text-right">Responses</th>
                <th className="py-3 px-3 w-48">Share %</th>
                <th className="py-3 px-3 text-center">Preference Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {options.map((opt: any) => {
                const isTop = opt.rank === 1 && opt.votes > 0 && !hasTie;
                return (
                  <tr
                    key={opt.id}
                    className={`hover:bg-slate-50/60 transition-colors ${
                      isTop ? "bg-teal-50/40" : ""
                    }`}
                  >
                    <td className="py-3.5 px-3 text-center font-bold">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                          opt.rank === 1
                            ? "bg-teal-100 text-teal-900 font-black border border-teal-300"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {opt.rank}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <p className="font-extrabold text-slate-900 text-sm">
                        {opt.name}
                      </p>
                      {opt.description && (
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {opt.description}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-extrabold text-slate-900 text-sm">
                      {(opt.votes || 0).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="font-bold text-slate-700">
                            {(opt.percentage || 0).toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-teal-500 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, opt.percentage || 0)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      {isTop ? (
                        <span className="inline-flex items-center gap-1 bg-teal-100 text-teal-800 font-bold px-2.5 py-0.5 rounded-full text-[10px] border border-teal-200">
                          <Sparkles className="h-3 w-3" />
                          TOP CHOICE
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium text-xs">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
