"use client";

import React from "react";
import {
  Star,
  Users,
  TrendingUp,
  FileSpreadsheet,
  HelpCircle,
  Award,
  Sparkles,
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

const STAR_COLORS = [
  "#10b981", // 5 Star: Emerald
  "#06b6d4", // 4 Star: Cyan
  "#f59e0b", // 3 Star: Amber
  "#f97316", // 2 Star: Orange
  "#ef4444", // 1 Star: Red
];

interface RatingDashboardProps {
  results: any;
  onExportExcel: () => void;
  exporting?: boolean;
}

export default function RatingDashboard({
  results,
  onExportExcel,
  exporting = false,
}: RatingDashboardProps) {
  const el = results?.election || {};
  const stats = results?.statistics || {};
  const ratingInfo = results?.rating || {};
  const distribution = ratingInfo?.distribution || [];

  const avgRating = ratingInfo.average_rating || 0;
  const totalResponses = ratingInfo.total_responses || stats.votes_cast || 0;

  const chartData = distribution.map((d: any, idx: number) => ({
    star: `${d.star} ★`,
    starNum: d.star,
    count: d.count || 0,
    percentage: d.percentage || 0,
    fill: STAR_COLORS[idx % STAR_COLORS.length],
  }));

  // Render Star icons visual for average
  const fullStars = Math.floor(avgRating);
  const hasHalfStar = avgRating - fullStars >= 0.3;

  return (
    <div className="space-y-6">
      {/* Top Banner & Export Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 p-6 rounded-2xl text-white shadow-md border border-amber-800/40">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-bold uppercase tracking-wider">
              Rating & Evaluation
            </span>
            <span className="text-xs text-amber-200/70 font-mono">
              ID: {el.election_id || el.id}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black mt-2 tracking-tight text-white">
            {el.name}
          </h2>
          <p className="text-xs sm:text-sm text-amber-100/80 mt-1">
            5-Star Satisfaction Scale & Community Evaluation Metric
          </p>
        </div>

        <button
          type="button"
          onClick={onExportExcel}
          disabled={exporting}
          className="button bg-amber-600 hover:bg-amber-500 text-white min-h-[46px] px-5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shrink-0 shadow-md shadow-amber-950/30 rounded-xl"
        >
          {exporting ? (
            <span className="inline-block animate-spin">⟳</span>
          ) : (
            <FileSpreadsheet className="h-4 w-4 text-amber-100" />
          )}
          <span>Export Results to Excel</span>
        </button>
      </div>

      {/* Subject Topic Card */}
      <div className="card p-5 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2">
        <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
          <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
          Evaluated Subject / Question
        </span>
        <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
          "{ratingInfo.subject || el.description || el.name}"
        </h3>
      </div>

      {/* Big Rating Banner */}
      <div className="p-6 sm:p-8 bg-gradient-to-r from-amber-50 via-yellow-50/60 to-white border border-amber-300 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-2">
          <span className="text-xs font-black uppercase tracking-widest text-amber-900">
            Overall Community Score
          </span>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl sm:text-6xl font-black text-amber-950 tracking-tight font-mono">
              {avgRating.toFixed(2)}
            </span>
            <span className="text-xl sm:text-2xl font-extrabold text-slate-400">
              / 5.00
            </span>
          </div>

          {/* Star visual */}
          <div className="flex items-center gap-1 text-amber-500 pt-1">
            {[1, 2, 3, 4, 5].map((starIdx) => (
              <Star
                key={starIdx}
                className={`h-6 w-6 ${
                  starIdx <= fullStars
                    ? "fill-amber-400 text-amber-500"
                    : starIdx === fullStars + 1 && hasHalfStar
                    ? "fill-amber-200 text-amber-400"
                    : "text-slate-300"
                }`}
              />
            ))}
            <span className="ml-2 text-xs font-bold text-slate-700">
              Standardized Rating Metric
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:items-end gap-1.5 self-start sm:self-auto bg-white/90 p-5 rounded-2xl border border-amber-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Total Rated Responses
          </span>
          <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
            {totalResponses.toLocaleString()}
          </span>
          <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            100% Cryptographically Verified
          </span>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="card p-4 sm:p-5 border border-slate-200 rounded-2xl bg-white shadow-xs space-y-1">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 text-emerald-600 fill-emerald-500" />
            5-Star Submissions
          </span>
          <p className="text-xl sm:text-2xl font-black text-slate-900">
            {(distribution.find((d: any) => d.star === 5)?.count || 0).toLocaleString()}
          </p>
          <p className="text-[11px] text-emerald-600 font-bold">
            {(distribution.find((d: any) => d.star === 5)?.percentage || 0).toFixed(1)}% of total
          </p>
        </div>

        <div className="card p-4 sm:p-5 border border-slate-200 rounded-2xl bg-white shadow-xs space-y-1">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
            <Award className="h-3.5 w-3.5 text-amber-600" />
            Satisfaction Tier
          </span>
          <p className="text-xl sm:text-2xl font-black text-slate-900">
            {avgRating >= 4.0 ? "Excellent" : avgRating >= 3.0 ? "Good" : "Needs Review"}
          </p>
          <p className="text-[11px] text-slate-500">Tier performance</p>
        </div>

        <div className="card p-4 sm:p-5 border border-slate-200 rounded-2xl bg-white shadow-xs space-y-1">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-indigo-500" />
            Participation Rate
          </span>
          <p className="text-xl sm:text-2xl font-black text-indigo-900">
            {(stats.turnout_percentage || 0).toFixed(1)}%
          </p>
          <p className="text-[11px] text-indigo-600">Of registered evaluators</p>
        </div>

        <div className="card p-4 sm:p-5 border border-slate-200 rounded-2xl bg-white shadow-xs space-y-1">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-slate-400" />
            Total Eligible
          </span>
          <p className="text-xl sm:text-2xl font-black text-slate-900">
            {(stats.eligible_voters || stats.registered_voters || 0).toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500">Registered pool</p>
        </div>
      </div>

      {/* Distribution Chart & Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Distribution Chart */}
        <div className="card p-5 sm:p-6 border border-slate-200 rounded-2xl bg-white shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h4 className="text-sm font-bold text-slate-900">
              1–5 Star Rating Distribution
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Response count per satisfaction level
            </p>
          </div>
          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                <XAxis dataKey="star" tick={{ fontSize: 12, fill: "#475569" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                <RechartsTooltip
                  formatter={(val: any, _name: any, item: any) => [
                    `${val} responses (${item.payload.percentage}%)`,
                    item.payload.star,
                  ]}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry: any, index: number) => (
                    <Cell key={`star-cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribution Table & Progress Bars */}
        <div className="card p-5 sm:p-6 border border-slate-200 rounded-2xl bg-white shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h4 className="text-sm font-bold text-slate-900">
              Distribution Frequency Table
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Exact share and percentage per star category
            </p>
          </div>

          <div className="space-y-3.5 pt-1">
            {distribution.map((d: any, idx: number) => (
              <div key={d.star} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                    <span className="font-mono">{d.star}</span>
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500 inline" />
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-slate-500 font-bold">
                      {d.count.toLocaleString()} responses
                    </span>
                    <span className="font-bold text-slate-900 w-12 text-right">
                      {d.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, d.percentage)}%`,
                      backgroundColor: STAR_COLORS[idx % STAR_COLORS.length],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
