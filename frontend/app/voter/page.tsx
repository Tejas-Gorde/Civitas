"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import VotingFlow from "../../components/VotingFlow";
import { api, readable } from "../../lib/api";
import { toast } from "sonner";
import { UserCheck, ShieldCheck, Key, ArrowRight, RefreshCw, AlertCircle, Vote, CheckCircle2, Lock, ArrowLeft } from "lucide-react";

function VoterPortalContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [electionId, setElectionId] = useState<string>(searchParams.get("election_id") || "");
  const [election, setElection] = useState<any | null>(null);
  const [voterNameInput, setVoterNameInput] = useState<string>("");
  const [voterIdInput, setVoterIdInput] = useState<string>("");

  // Authenticated Session State
  const [authSessionId, setAuthSessionId] = useState<string>("");
  const [voterInternalId, setVoterInternalId] = useState<string>("");
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string>("");

  const [step, setStep] = useState<"election_input" | "voter_auth" | "voting">("election_input");
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleValidateElection = async (targetId?: string) => {
    const idToTest = targetId || electionId.trim();
    if (!idToTest) {
      toast.error("Please enter an Election ID.");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.get(`/voting/verify-election/${encodeURIComponent(idToTest)}`);
      const matched = res.data;

      setElection(matched);
      setElectionId(matched.election_id || matched.id);
      setStep("voter_auth");
      toast.success(`Election "${matched.name}" verified.`);
    } catch (err: any) {
      const msg = readable(err);
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const queryId = searchParams.get("election_id");
    if (queryId) {
      setElectionId(queryId);
      handleValidateElection(queryId);
    }
  }, [searchParams]);

  const handleVoterAuthenticate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voterNameInput.trim()) {
      toast.error("Please enter your Full Name.");
      return;
    }
    if (!voterIdInput.trim()) {
      toast.error("Please enter your Voter ID.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await api.post("/voting/verify-voter", {
        election_id: election.id,
        voter_id: voterIdInput.trim(),
        voter_name: voterNameInput.trim(),
      });

      if (res.data && res.data.eligible) {
        toast.success("Voter identity verified successfully.");
        setAuthSessionId(res.data.session_id || "");
        setVoterInternalId(res.data.voter_internal_id || "");
        setSessionExpiresAt(res.data.expires_at || "");
        setStep("voting");
      }
    } catch (err: any) {
      const msg = readable(err);
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (step === "voting" && election) {
    return (
      <VotingFlow
        election={election}
        initialSession={authSessionId}
        initialVoterId={voterIdInput.trim()}
        initialVoterName={voterNameInput.trim()}
        initialVoterInternalId={voterInternalId}
        initialExpiresAt={sessionExpiresAt}
        onReset={() => {
          setStep("election_input");
          setElection(null);
          setElectionId("");
          setVoterNameInput("");
          setVoterIdInput("");
          setAuthSessionId("");
          setVoterInternalId("");
          setSessionExpiresAt("");
        }}
      />
    );
  }

  const isQuickEntry =
    election?.voter_registration_mode === "quick_entry" ||
    election?.voter_registration_mode === "anyone_can_vote" ||
    election?.voter_registration_mode === "open" ||
    election?.voter_registration_mode === "public";

  return (
    <div className="max-w-3xl mx-auto py-4 sm:py-6 space-y-4 sm:space-y-6 px-2 sm:px-0">
      {/* Top Banner */}
      <div className="card p-5 sm:p-8 bg-gradient-to-r from-slate-900 to-teal-950 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-teal-400 bg-teal-900/60 px-3 py-1 rounded-full border border-teal-700/50">
              <UserCheck className="h-3.5 w-3.5" />
              OPTION 1 — VOTER PORTAL
            </div>
            <h1 className="mt-2 text-xl sm:text-3xl font-extrabold tracking-tight">
              Official Voter Entry & Ballot
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-300">
              Enter your Election ID to securely access your official ballot.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="button button-secondary text-xs text-slate-300 hover:text-white shrink-0 self-start sm:self-auto min-h-[40px] px-3.5"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1 inline" />
            Back to Options
          </button>
        </div>
      </div>

      {/* STEP 1: ELECTION SELECTION */}
      {step === "election_input" && (
        <div className="card p-5 sm:p-8 space-y-5 sm:space-y-6">
          <div className="border-b border-slate-100 pb-3 sm:pb-4">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 text-teal-800 text-xs font-black shrink-0">
                1
              </span>
              Enter Election ID
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Please enter the unique ID of the election you wish to participate in.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 sm:p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Authentication Failure</p>
                <p className="mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Election ID
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-2">
                <input
                  type="text"
                  value={electionId}
                  onChange={(e) => setElectionId(e.target.value)}
                  placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                  className="input flex-1 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => handleValidateElection()}
                  disabled={loading || !electionId.trim()}
                  className="button button-teal text-xs shrink-0 py-3 sm:py-2.5 px-5 font-bold"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin inline mr-1.5" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      Verify Election
                      <ArrowRight className="h-3.5 w-3.5 ml-1.5 inline" />
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="pt-3 sm:pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
              <span>Don't have your Election ID?</span>
              <button
                type="button"
                onClick={() => router.push("/live-elections")}
                className="text-teal-700 font-bold hover:underline inline-flex items-center gap-1 self-start sm:self-auto py-1"
              >
                Browse Live Elections <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: VOTER AUTHENTICATION */}
      {step === "voter_auth" && election && (
        <div className="card p-5 sm:p-8 space-y-5 sm:space-y-6">
          <div className="border-b border-slate-100 pb-3 sm:pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold text-teal-700 uppercase tracking-widest">
                  Selected Election
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isQuickEntry ? "bg-amber-100 text-amber-800" : "bg-teal-100 text-teal-800"
                }`}>
                  {isQuickEntry ? "Anyone Can Vote Mode" : "Pre-Registered Mode"}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5">{election.name}</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setStep("election_input");
                setElection(null);
              }}
              className="button button-secondary text-xs self-start sm:self-auto"
            >
              Change Election
            </button>
          </div>

          <div className="border-b border-slate-100 pb-3 sm:pb-4">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 text-teal-800 text-xs font-black shrink-0">
                2
              </span>
              Voter Identification
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              {isQuickEntry
                ? "Enter your Full Name and Voter ID / PRN to access your ballot."
                : "Enter your registered Full Name and Voter ID to access your ballot."}
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 sm:p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Authentication Failure</p>
                <p className="mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleVoterAuthenticate} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                {isQuickEntry ? "Full Name" : "Voter Full Name"} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={voterNameInput}
                onChange={(e) => setVoterNameInput(e.target.value)}
                placeholder="Enter your full name (e.g. Jane Doe)"
                className="input"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                {isQuickEntry ? "Voter ID / PRN" : "Voter ID"} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={voterIdInput}
                onChange={(e) => setVoterIdInput(e.target.value)}
                placeholder={isQuickEntry ? "Enter your unique Voter ID or PRN (e.g. ABC123 or 1234567890)" : "Enter your registered voter ID (e.g. VOTER-1001)"}
                className="input font-mono uppercase"
              />
              {isQuickEntry && (
                <p className="text-[11px] text-amber-700 mt-1">
                  Anyone Can Vote Mode: Pre-registration is not required. Any Voter ID uniquely tracks participation to prevent duplicate voting.
                </p>
              )}
            </div>

            <div className="pt-3 sm:pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <Lock className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                <span>Protected against duplicate voting</span>
              </div>

              <button
                type="submit"
                disabled={loading || !voterNameInput.trim() || !voterIdInput.trim()}
                className="button button-teal font-bold text-xs py-3 sm:py-2.5 px-6 disabled:opacity-60 w-full sm:w-auto"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin inline mr-1.5" />
                    Verifying Identity...
                  </>
                ) : (
                  <>
                    Continue to Ballot
                    <ArrowRight className="h-4 w-4 ml-1.5 inline" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function VoterPortalPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading Voter Portal...</div>}>
      <VoterPortalContent />
    </Suspense>
  );
}
