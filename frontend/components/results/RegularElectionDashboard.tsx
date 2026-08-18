"use client";

import React from "react";
import {
  Trophy,
  Users,
  Vote,
  TrendingUp,
  Award,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const CHART_COLORS = [
  "#0ea5e9", // Sky blue
  "#6366f1", // Indigo
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#8b5cf6", // Purple
  "#14b8a6", // Teal
  "#f97316", // Orange
];

interface RegularElectionDashboardProps {
  results: any;
  onExportExcel: () => void;
  exporting?: boolean;
}

export default function RegularElectionDashboard({
  results,
  onExportExcel,
  exporting = false,
}: RegularElectionDashboardProps) {
  const el = results?.election || {};
  const stats = results?.statistics || {};
  const candidates = results?.candidates || [];
  const winner = results?.winner;
  const hasTie = results?.has_tie;

  // Chart data
  const chartData = candidates.map((c: any, idx: number) => ({
    name: c.name.length > 18 ? c.name.slice(0, 16) + "..." : c.name,
    fullName: c.name,
    party: c.party || "Independent",
    votes: c.votes || 0,
    percentage: c.percentage || 0,
    fill: CHART_COLORS[idx % CHART_COLORS.length],
  }));

  return (
    <div className="space-y-6">
      {/* Top Header & Export Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 rounded-2xl text-white shadow-md border border-slate-700">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge bg-teal-500/20 text-teal-300 border-teal-500/40 text-xs font-bold uppercase tracking-wider">
              Regular Election
            </span>
            <span className="text-xs text-slate-400 font-mono">
              ID: {el.election_id || el.id}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black mt-2 tracking-tight text-white">
            {el.name}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Single-Choice Candidate Ballot — Certified Real-Time Tally
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

      {/* Winner Banner */}
      {winner ? (
        <div className="p-5 sm:p-6 bg-gradient-to-r from-amber-50 via-emerald-50 to-teal-50 border border-emerald-300/80 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20 shrink-0">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-800">
                Current Projected Winner
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                {winner.name}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {winner.party} • Secured <strong>{winner.votes.toLocaleString()}</strong> votes ({winner.percentage}% of cast ballots)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto bg-white/90 px-4 py-2 rounded-xl border border-emerald-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-bold text-slate-800">
              Leading by Rank 1
            </span>
          </div>
        </div>
      ) : hasTie ? (
        <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-900 text-xs">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <p className="font-bold text-sm">Tie Detected for First Place</p>
            <p className="mt-0.5 text-amber-800">
              Multiple candidates share the highest vote count. Monitor incoming ballots until voting concludes.
            </p>
          </div>
        </div>
      ) : null}

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="card p-4 sm:p-5 border border-slate-200 rounded-2xl bg-white shadow-xs space-y-1">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-slate-400" />
            Registered Voters
          </span>
          <p className="text-xl sm:text-2xl font-black text-slate-900">
            {(stats.registered_voters || 0).toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500">Total in voter roll</p>
        </div>

        <div className="card p-4 sm:p-5 border border-slate-200 rounded-2xl bg-white shadow-xs space-y-1">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-teal-700 flex items-center gap-1.5">
            <Vote className="h-3.5 w-3.5 text-teal-600" />
            Votes Cast
          </span>
          <p className="text-xl sm:text-2xl font-black text-teal-900">
            {(stats.votes_cast || 0).toLocaleString()}
          </p>
          <p className="text-[11px] text-teal-700">Verified ballots cast</p>
        </div>

        <div className="card p-4 sm:p-5 border border-slate-200 rounded-2xl bg-white shadow-xs space-y-1">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-indigo-500" />
            Turnout Rate
          </span>
          <p className="text-xl sm:text-2xl font-black text-indigo-900">
            {(stats.turnout_percentage || 0).toFixed(1)}%
          </p>
          <p className="text-[11px] text-indigo-600">Of eligible electorate</p>
        </div>

        <div className="card p-4 sm:p-5 border border-slate-200 rounded-2xl bg-white shadow-xs space-y-1">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Award className="h-3.5 w-3.5 text-slate-400" />
            Candidates
          </span>
          <p className="text-xl sm:text-2xl font-black text-slate-900">
            {candidates.length}
          </p>
          <p className="text-[11px] text-slate-500">Contenders registered</p>
        </div>
      </div>

      {/* Visual Charts */}
      {candidates.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Bar Chart */}
          <div className="card p-5 sm:p-6 border border-slate-200 rounded-2xl bg-white shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h4 className="text-sm font-bold text-slate-900">
                Candidate Vote Count Comparison
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Absolute vote tallies per candidate
              </p>
            </div>
            <div className="h-64 sm:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} interval={0} angle={-15} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                  <RechartsTooltip
                    formatter={(val: any, _name: any, item: any) => [
                      `${val} votes (${item.payload.percentage}%)`,
                      item.payload.fullName,
                    ]}
                  />
                  <Bar dataKey="votes" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pie Chart */}
          <div className="card p-5 sm:p-6 border border-slate-200 rounded-2xl bg-white shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h4 className="text-sm font-bold text-slate-900">
                Vote Share Distribution
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Percentage breakdown of total ballots cast
              </p>
            </div>
            <div className="h-64 sm:h-72 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="votes"
                    nameKey="fullName"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={45}
                    paddingAngle={3}
                    label={(entry) => `${entry.percentage}%`}
                  >
                    {chartData.map((entry: any, index: number) => (
                      <Cell key={`pie-cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(val: any, name: any) => [`${val} votes`, name]} />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Candidate Rankings Table */}
      <div className="card p-5 sm:p-6 border border-slate-200 rounded-2xl bg-white shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Candidate Leaderboard & Rankings
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Rank-ordered results based on certified vote totals
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {candidates.length} Contenders
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 uppercase font-bold text-[10px] tracking-wider">
                <th className="py-3 px-3 w-14 text-center">Rank</th>
                <th className="py-3 px-3">Candidate</th>
                <th className="py-3 px-3">Party</th>
                <th className="py-3 px-3 text-right">Votes</th>
                <th className="py-3 px-3 w-44">Share</th>
                <th className="py-3 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {candidates.map((c: any) => {
                const isWin = c.rank === 1 && c.votes > 0 && !hasTie;
                return (
                  <tr
                    key={c.id}
                    className={`hover:bg-slate-50/60 transition-colors ${
                      isWin ? "bg-emerald-50/40" : ""
                    }`}
                  >
                    <td className="py-3.5 px-3 text-center font-bold">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                          c.rank === 1
                            ? "bg-amber-100 text-amber-900 font-black border border-amber-300"
                            : c.rank === 2
                            ? "bg-slate-200 text-slate-800 font-bold"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {c.rank}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <p className="font-extrabold text-slate-900 text-sm">
                        {c.name}
                      </p>
                      {c.manifesto && (
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                          {c.manifesto}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="badge bg-slate-100 text-slate-700 border-slate-200 text-[11px]">
                        {c.party || "Independent"}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-extrabold text-slate-900 text-sm">
                      {(c.votes || 0).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="font-bold text-slate-700">
                            {(c.percentage || 0).toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isWin ? "bg-emerald-500" : "bg-indigo-500"
                            }`}
                            style={{ width: `${Math.min(100, c.percentage || 0)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      {isWin ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[10px] border border-emerald-200">
                          <Trophy className="h-3 w-3" />
                          WINNER
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
