"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, readable } from "../../../lib/api";
import VotingFlow from "../../../components/VotingFlow";
import { toast } from "sonner";
import {
  ShieldCheck,
  Calendar,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  Vote,
  Smartphone,
  Lock,
  CheckCircle2,
  Users,
  Info,
  ChevronRight,
} from "lucide-react";

export default function RemoteVotePage() {
  const rawParams = useParams();
  const router = useRouter();
  const token = typeof rawParams?.token === "string" ? rawParams.token : Array.isArray(rawParams?.token) ? rawParams.token[0] : "";

  const [election, setElection] = useState<any | null>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState<boolean>(false);

  const validateToken = async () => {
    if (!token) {
      setError("No voting identifier provided in URL.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // First attempt: /voting/access/{token}
      let elecData: any = null;
      try {
        const res = await api.get(`/voting/access/${encodeURIComponent(token.trim())}`);
        elecData = res.data;
      } catch (accessErr: any) {
        // Fallback attempt: /voting/verify-election/{token}
        const verifyRes = await api.get(`/voting/verify-election/${encodeURIComponent(token.trim())}`);
        elecData = verifyRes.data;
      }

      if (elecData) {
        setElection(elecData);
        // Load candidates for preview
        try {
          const candRes = await api.get(`/voting/elections/${elecData.id}/candidates`);
          setCandidates(candRes.data || []);
        } catch {
          // Non-blocking candidate preview load
        }
      } else {
        throw new Error("Unable to resolve election.");
      }
    } catch (e) {
      const msg = readable(e);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      validateToken();
    }
  }, [token]);

  if (started && election) {
    return (
      <VotingFlow
        election={election}
        onReset={() => setStarted(false)}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4 px-3 sm:px-4">
      {/* Header Banner */}
      <div className="card p-6 sm:p-8 bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white space-y-3 shadow-xl rounded-2xl border border-slate-800">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-400">
          <ShieldCheck className="h-4 w-4" />
          <span>CIVITAS SECURE REMOTE VOTING PORTAL</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          {election ? election.name : "Authorized Digital Ballot"}
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          End-to-end encrypted remote voter verification and cryptographic ballot casting.
        </p>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="card p-8 animate-pulse space-y-4 rounded-2xl bg-white border border-slate-200">
          <div className="h-5 w-36 bg-slate-200 rounded"></div>
          <div className="h-7 w-3/4 bg-slate-200 rounded"></div>
          <div className="h-4 w-full bg-slate-100 rounded"></div>
          <div className="h-12 w-full bg-slate-200 rounded-xl"></div>
        </div>
      )}

      {/* Error / Invalid / Revoked Link State */}
      {!loading && error && (
        <div className="card p-6 sm:p-8 text-center space-y-4 border-amber-300 bg-amber-50/70 rounded-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-800 shadow-xs">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Remote Voting Link Unavailable
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-slate-700 max-w-md mx-auto leading-relaxed">
              {error}
            </p>
          </div>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={validateToken}
              className="button button-teal text-xs py-2 px-4 inline-flex items-center gap-1.5 font-bold"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry Access</span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/voter")}
              className="button button-outline text-xs py-2 px-4 font-bold bg-white"
            >
              <span>Go to General Voter Entry</span>
            </button>
          </div>
        </div>
      )}

      {/* Election Landing Card */}
      {!loading && !error && election && (
        <div className="card p-6 sm:p-8 space-y-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
          {/* Status Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <span className={`badge text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                election.state === "open" ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-slate-100 text-slate-700 border-slate-300"
              }`}>
                STATUS: {election.state?.toUpperCase() || "OPEN"}
              </span>
              <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                ● MOBILE ACCESS READY
              </span>
            </div>
            <span className="text-[11px] font-mono font-bold text-slate-500">
              ID: {election.election_id || election.id}
            </span>
          </div>

          {/* Election Details */}
          <div className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {election.name}
            </h2>
            {election.description && (
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {election.description}
              </p>
            )}

            {election.ends_at && (
              <div className="inline-flex items-center gap-1.5 text-xs text-slate-700 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                <Calendar className="h-3.5 w-3.5 text-teal-700 shrink-0" />
                <span>
                  Voting Deadline: <strong>{new Date(election.ends_at).toLocaleString()}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Candidates Summary Preview */}
          {candidates.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-teal-700" />
                  <span>Candidates on Ballot ({candidates.length})</span>
                </h4>
                <span className="text-[10px] text-slate-400 font-medium">Selectable in Step 5</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {candidates.map((c: any) => (
                  <div
                    key={c.id}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{c.name}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800">
                        {c.party}
                      </span>
                    </div>
                    {c.manifesto && (
                      <p className="text-[11px] text-slate-500 line-clamp-2 italic">
                        "{c.manifesto}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Guidelines for Mobile Voters */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Smartphone className="h-4 w-4 text-teal-700" />
              <span>Mobile Verification Instructions</span>
            </h4>
            <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
              <li>Allow browser permission to access your device camera when prompted.</li>
              <li>Keep your Voter Registration ID and Voter Password ready.</li>
              <li>Complete the biometric TouchID/Device and Face capture challenges.</li>
              <li>Do not refresh or exit until your cryptographic vote receipt is shown.</li>
            </ul>
          </div>

          {/* Security Guarantee */}
          <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-950 flex items-center gap-2">
            <Lock className="h-4 w-4 shrink-0 text-teal-700" />
            <span className="font-medium">
              Ballot Secrecy Enforced: Anonymous cryptographic voting grant protects your identity.
            </span>
          </div>

          {/* Start Verification Action Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setStarted(true)}
              className="button button-teal w-full text-sm py-3.5 flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all font-black rounded-xl"
            >
              <Vote className="h-5 w-5" />
              <span>Start Voter Verification</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
