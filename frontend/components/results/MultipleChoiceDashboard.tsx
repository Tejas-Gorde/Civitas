"use client";

import React from "react";
import {
  CheckSquare,
  Users,
  Layers,
  Percent,
  FileSpreadsheet,
  Info,
  BarChart2,
  TrendingUp,
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

const MC_COLORS = [
  "#4f46e5", // Indigo
  "#7c3aed", // Violet
  "#2563eb", // Blue
  "#0891b2", // Cyan
  "#059669", // Emerald
  "#d97706", // Amber
];

interface MultipleChoiceDashboardProps {
  results: any;
  onExportExcel: () => void;
  exporting?: boolean;
}

export default function MultipleChoiceDashboard({
  results,
  onExportExcel,
  exporting = false,
}: MultipleChoiceDashboardProps) {
  const el = results?.election || {};
  const stats = results?.statistics || {};
  const mc = results?.multiple_choice || {};
  const options = results?.options || results?.candidates || [];

  const totalVoters = mc?.total_voters || stats?.votes_cast || 0;
  const totalSelections = mc?.total_selections || stats?.total_vote_records || 0;
  const avgSelections = mc?.average_selections_per_voter || (totalVoters > 0 ? (totalSelections / totalVoters).toFixed(2) : 0);

  const chartData = options.map((opt: any, idx: number) => ({
    name: opt.name.length > 20 ? opt.name.slice(0, 18) + "..." : opt.name,
    fullName: opt.name,
    selections: opt.selections_count || opt.votes || 0,
    percentageOfVoters: opt.percentage_of_voters || opt.percentage || 0,
    fill: MC_COLORS[idx % MC_COLORS.length],
  }));

  return (
    <div className="space-y-6">
      {/* Top Banner & Export Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 p-6 rounded-2xl text-white shadow-md border border-indigo-800/40">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge bg-indigo-500/20 text-indigo-300 border-indigo-500/40 text-xs font-bold uppercase tracking-wider">
              Multiple Choice Ballot
            </span>
            <span className="text-xs text-indigo-200/70 font-mono">
              ID: {el.election_id || el.id}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black mt-2 tracking-tight text-white">
            {el.name}
          </h2>
          <p className="text-xs sm:text-sm text-indigo-100/80 mt-1">
            Multi-Selection Voting — Aggregated Option Support & Participation
          </p>
        </div>

        <button
          type="button"
          onClick={onExportExcel}
          disabled={exporting}
          className="button bg-indigo-600 hover:bg-indigo-500 text-white min-h-[46px] px-5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shrink-0 shadow-md shadow-indigo-950/30 rounded-xl"
        >
          {exporting ? (
            <span className="inline-block animate-spin">⟳</span>
          ) : (
            <FileSpreadsheet className="h-4 w-4 text-indigo-100" />
          )}
          <span>Export Results to Excel</span>
        </button>
      </div>

      {/* Multi-Select Explanation Banner */}
      <div className="p-4 sm:p-5 bg-indigo-50/80 border border-indigo-200 rounded-2xl text-xs text-indigo-950 flex items-start gap-3 shadow-xs">
        <Info className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-bold text-sm text-indigo-900">
            Multi-Selection Tally Methodology
          </p>
          <p className="text-indigo-800/90 leading-relaxed">
            Voters could select multiple options simultaneously. Percentages represent the proportion of <strong>participating voters</strong> who selected each respective option, which can cause the cumulative sum of percentages to exceed 100%.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="card p-4 sm:p-5 border border-slate-200 rounded-2xl bg-white shadow-xs space-y-1">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-indigo-600" />
            Participating Voters
          </span>
          <p className="text-xl sm:text-2xl font-black text-slate-900">
            {totalVoters.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500">Ballots submitted</p>
        </div>

        <div className="card p-4 sm:p-5 border border-slate-200 rounded-2xl bg-white shadow-xs space-y-1">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-teal-700 flex items-center gap-1.5">
            <CheckSquare className="h-3.5 w-3.5 text-teal-600" />
            Total Selections Made
          </span>
          <p className="text-xl sm:text-2xl font-black text-teal-900">
            {totalSelections.toLocaleString()}
          </p>
          <p className="text-[11px] text-teal-700">Accumulated votes cast</p>
        </div>

        <div className="card p-4 sm:p-5 border border-slate-200 rounded-2xl bg-white shadow-xs space-y-1">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-amber-600" />
            Avg Selections / Voter
          </span>
          <p className="text-xl sm:text-2xl font-black text-amber-900">
            {avgSelections}
          </p>
          <p className="text-[11px] text-amber-700">Choices picked per ballot</p>
        </div>

        <div className="card p-4 sm:p-5 border border-slate-200 rounded-2xl bg-white shadow-xs space-y-1">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-slate-400" />
            Turnout Rate
          </span>
          <p className="text-xl sm:text-2xl font-black text-slate-900">
            {(stats.turnout_percentage || 0).toFixed(1)}%
          </p>
          <p className="text-[11px] text-slate-500">Of registered electorate</p>
        </div>
      </div>

      {/* Chart */}
      {options.length > 0 && (
        <div className="card p-5 sm:p-6 border border-slate-200 rounded-2xl bg-white shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h4 className="text-sm font-bold text-slate-900">
              Option Selection Comparison (% of Voters)
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Percentage of participating voters who selected each option
            </p>
          </div>
          <div className="h-64 sm:h-76 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} interval={0} angle={-15} textAnchor="end" />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} unit="%" />
                <RechartsTooltip
                  formatter={(val: any, _name: any, item: any) => [
                    `${val}% of voters (${item.payload.selections} selections)`,
                    item.payload.fullName,
                  ]}
                />
                <Bar dataKey="percentageOfVoters" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry: any, index: number) => (
                    <Cell key={`mc-cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Options Table */}
      <div className="card p-5 sm:p-6 border border-slate-200 rounded-2xl bg-white shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Option Selection Leaderboard
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Detailed selection frequency and proportion across voters
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
                <th className="py-3 px-3">Option / Choice</th>
                <th className="py-3 px-3 text-right">Selections</th>
                <th className="py-3 px-3 w-48">% of Voters</th>
                <th className="py-3 px-3 text-right">% of All Selections</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {options.map((opt: any) => (
                <tr key={opt.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-3 text-center font-bold">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                        opt.rank === 1
                          ? "bg-indigo-100 text-indigo-900 font-black border border-indigo-300"
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
                    {opt.party && (
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {opt.party}
                      </p>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono font-extrabold text-slate-900 text-sm">
                    {(opt.selections_count || opt.votes || 0).toLocaleString()}
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-bold text-indigo-700">
                          {(opt.percentage_of_voters || opt.percentage || 0).toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, opt.percentage_of_voters || opt.percentage || 0)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-right text-slate-600 font-mono">
                    {(opt.percentage_of_total_selections || 0).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
