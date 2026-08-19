"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Trophy,
  Award,
  Users,
  CheckCircle2,
  TrendingUp,
  FileSpreadsheet,
  Download,
  Building,
  User,
  Shield,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";

interface PresidentialResultDashboardProps {
  results: any;
  onExportExcel: () => void;
  exporting: boolean;
}

const BAR_COLORS = ["#4f46e5", "#0d9488", "#0284c7", "#f59e0b", "#e11d48", "#8b5cf6"];

export default function PresidentialResultDashboard({
  results,
  onExportExcel,
  exporting,
}: PresidentialResultDashboardProps) {
  const winner = results?.winner;
  const runnerUp = results?.runner_up;
  const candidates = results?.candidates || [];
  const statistics = results?.statistics || {};
  const marginPct = results?.margin_percentage || 0;
  const position = results?.position_title || "President / Executive Leader";
  const hasTie = results?.has_tie;

  const chartData = candidates.map((c: any) => ({
    name: c.name.length > 16 ? `${c.name.substring(0, 14)}...` : c.name,
    fullName: c.name,
    party: c.party,
    votes: c.votes,
    percentage: c.percentage,
  }));

  return (
    <div className="space-y-6">
      {/* Header & Export Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
            <Building className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">
              Presidential Election Outcome
            </span>
            <h3 className="text-base font-bold text-slate-900">
              Official Executive Leadership Tallies
            </h3>
          </div>
        </div>

        <button
          type="button"
          onClick={onExportExcel}
          disabled={exporting}
          className="button button-secondary text-xs font-bold py-2.5 px-4 self-start sm:self-auto flex items-center gap-2 min-h-[40px]"
        >
          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
          <span>{exporting ? "Generating..." : "Export Excel"}</span>
        </button>
      </div>

      {/* WINNER SPOTLIGHT BANNER */}
      {winner && !hasTie && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6 sm:p-8 bg-gradient-to-r from-indigo-950 via-slate-900 to-teal-950 text-white rounded-3xl border border-indigo-800/80 shadow-xl relative overflow-hidden"
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
            {/* Winner Portrait & Details */}
            <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
              <div className="relative">
                <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl bg-indigo-900 border-2 border-indigo-400/80 flex items-center justify-center overflow-hidden shadow-lg shrink-0">
                  {winner.photo_url ? (
                    <img
                      src={winner.photo_url}
                      alt={winner.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="h-12 w-12 text-indigo-200" />
                  )}
                </div>
                <div className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-md border-2 border-slate-900">
                  <Trophy className="h-4 w-4" />
                </div>
              </div>

              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-extrabold bg-amber-400/20 text-amber-300 border border-amber-400/40">
                  <Award className="h-3.5 w-3.5" />
                  ELECTED {position.toUpperCase()}
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  {winner.name}
                </h2>
                <p className="text-xs sm:text-sm text-indigo-200">
                  {winner.party} • Certified Majority Winner
                </p>
              </div>
            </div>

            {/* Victory Statistics */}
            <div className="flex items-center gap-4 bg-white/10 backdrop-blur-sm p-4 rounded-2xl border border-white/15 shrink-0">
              <div className="text-center px-2">
                <span className="text-[10px] uppercase tracking-wider text-indigo-200 block font-bold">
                  Vote Share
                </span>
                <span className="text-2xl sm:text-3xl font-black text-amber-300">
                  {winner.percentage}%
                </span>
              </div>
              <div className="h-8 w-px bg-white/20" />
              <div className="text-center px-2">
                <span className="text-[10px] uppercase tracking-wider text-indigo-200 block font-bold">
                  Total Votes
                </span>
                <span className="text-2xl sm:text-3xl font-black text-white">
                  {winner.votes.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Runner-Up Comparison Bar if applicable */}
      {winner && runnerUp && (
        <div className="p-4 sm:p-5 bg-indigo-50/80 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-indigo-700 shrink-0" />
            <div className="text-xs text-indigo-950">
              <strong>Victory Margin:</strong> {winner.name} leads runner-up {runnerUp.name} by{" "}
              <strong>{marginPct}%</strong> ({(winner.votes - runnerUp.votes).toLocaleString()} votes).
            </div>
          </div>
          <span className="text-xs font-bold text-indigo-700 self-start sm:self-auto">
            Runner-Up: {runnerUp.percentage}% ({runnerUp.votes} votes)
          </span>
        </div>
      )}

      {/* Bar Chart Visualization */}
      <div className="card p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
        <h4 className="text-sm font-bold text-slate-900">Presidential Candidate Vote Distribution</h4>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(val: any, name: any, item: any) => [
                  `${val} votes (${item.payload.percentage}%)`,
                  "Total Votes",
                ]}
              />
              <Bar dataKey="votes" radius={[8, 8, 0, 0]}>
                {chartData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Ranked Candidate Cards */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-slate-900">Certified Candidate Standings</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {candidates.map((c: any) => (
            <div
              key={c.id}
              className={`p-4 sm:p-5 rounded-2xl border-2 flex items-center justify-between gap-4 bg-white ${
                c.rank === 1 && !hasTie
                  ? "border-indigo-500 bg-indigo-50/40 shadow-sm"
                  : "border-slate-200"
              }`}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                    c.rank === 1
                      ? "bg-amber-400 text-slate-950"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  #{c.rank}
                </div>

                <div className="min-w-0">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 truncate block">
                    {c.party || "Nominee"}
                  </span>
                  <h5 className="text-sm font-bold text-slate-900 truncate">{c.name}</h5>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-base font-black text-slate-900">{c.percentage}%</span>
                <span className="text-[11px] text-slate-500 block">{c.votes} votes</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
