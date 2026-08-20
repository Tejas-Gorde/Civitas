"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, readable } from "../../lib/api";
import { toast } from "sonner";
import { Activity, Calendar, Users, ArrowRight, RefreshCw, AlertTriangle, Vote, Info, CheckCircle2, X, Search } from "lucide-react";

export default function LiveElectionsPage() {
  const router = useRouter();
  const [elections, setElections] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [detailsModal, setDetailsModal] = useState<any | null>(null);
  const [candidatesList, setCandidatesList] = useState<any[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState<boolean>(false);

  const fetchLiveElections = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/voting/live-elections");
      setElections(res.data || []);
    } catch (e) {
      const msg = readable(e);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveElections();
  }, []);

  const filteredElections = elections.filter((e) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return e.name && e.name.toLowerCase().includes(term);
  });

  const handleOpenDetails = async (election: any) => {
    setDetailsModal(election);
    setLoadingCandidates(true);
    try {
      const res = await api.get(`/voting/elections/${election.id}/candidates`);
      setCandidatesList(res.data || []);
    } catch (e) {
      toast.error("Could not load candidate details: " + readable(e));
    } finally {
      setLoadingCandidates(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto py-4 sm:py-6 px-2 sm:px-0">
      {/* Header Banner */}
      <div className="card p-5 sm:p-8 bg-gradient-to-r from-sky-900 via-slate-900 to-teal-950 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-sky-400 bg-sky-900/60 px-3 py-1 rounded-full border border-sky-700/50">
              <Activity className="h-3.5 w-3.5 text-sky-400" />
              OPTION 3 — LIVE ELECTIONS SHOWCASE
            </div>
            <h1 className="mt-2 text-xl sm:text-3xl font-extrabold tracking-tight">
              Currently Active Elections
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-300">
              Real-time public elections open for democratic voting across authorized districts.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchLiveElections}
            className="button button-secondary text-xs text-slate-200 shrink-0 self-start sm:self-auto min-h-[40px] px-3.5"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5 inline" />
            Refresh Polls
          </button>
        </div>
      </div>

      {/* Search Elections Bar */}
      {!loading && !error && elections.length > 0 && (
        <div className="space-y-1.5">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by election name..."
              className="w-full pl-10 pr-10 py-3 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 shadow-xs transition"
              aria-label="Search by election name"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md transition"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {searchTerm && (
            <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 font-medium">
              <span>
                Showing {filteredElections.length} of {elections.length} live elections
              </span>
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="text-teal-700 hover:text-teal-900 font-bold underline cursor-pointer"
              >
                Clear search
              </button>
            </div>
          )}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-3 sm:space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="card p-5 sm:p-6 animate-pulse space-y-3">
              <div className="h-4 w-24 bg-slate-200 rounded"></div>
              <div className="h-6 w-2/3 bg-slate-200 rounded"></div>
              <div className="h-4 w-full bg-slate-100 rounded"></div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="card p-6 sm:p-8 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">Unable to Load Live Elections</h3>
            <p className="mt-1 text-xs text-slate-600">{error}</p>
          </div>
          <button type="button" onClick={fetchLiveElections} className="button button-teal text-xs py-2.5 px-4 min-h-[44px]">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5 inline" />
            Retry Connection
          </button>
        </div>
      )}

      {/* Empty State (No Active Elections at all) */}
      {!loading && !error && elections.length === 0 && (
        <div className="card p-8 sm:p-12 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Vote className="h-6 w-6" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900">No Active Elections Currently Open</h3>
          <p className="max-w-md mx-auto text-xs text-slate-600">
            There are currently no active public elections scheduled for voting. Check back during official election windows.
          </p>
          <button type="button" onClick={fetchLiveElections} className="button button-secondary text-xs py-2.5 px-4 min-h-[44px]">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5 inline" />
            Check Again
          </button>
        </div>
      )}

      {/* Search No Matches State */}
      {!loading && !error && elections.length > 0 && filteredElections.length === 0 && (
        <div className="card p-8 sm:p-10 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Search className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No live elections found.</h3>
          <p className="max-w-md mx-auto text-xs text-slate-500">
            No active elections matched &ldquo;{searchTerm}&rdquo;. Try searching with a different keyword or clear the search filter.
          </p>
          <button
            type="button"
            onClick={() => setSearchTerm("")}
            className="button button-secondary text-xs py-2 px-4"
          >
            Clear Search Filter
          </button>
        </div>
      )}

      {/* Elections List */}
      {!loading && !error && filteredElections.length > 0 && (
        <div className="space-y-3 sm:space-y-4">
          {filteredElections.map((e) => (
            <div
              key={e.id}
              className="card p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 border-l-4 border-l-teal-600"
            >
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge badge-open font-extrabold text-[10px]">
                    STATUS: LIVE / OPEN
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                    <Users className="h-3 w-3 text-slate-600" />
                    {e.candidate_count || 0} Candidates Registered
                  </span>
                </div>

                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">{e.name}</h2>
                <p className="text-[11px] sm:text-xs font-mono font-bold text-teal-800 break-all">
                  Election ID: {e.election_id || e.id}
                </p>

                {e.description && (
                  <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                    {e.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-[11px] sm:text-xs text-slate-500 pt-1 font-medium">
                  {e.starts_at && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                      Starts: {new Date(e.starts_at).toLocaleString()}
                    </span>
                  )}
                  {e.ends_at && (
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                      <Calendar className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                      Closes: {new Date(e.ends_at).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                <button
                  type="button"
                  onClick={() => handleOpenDetails(e)}
                  className="button button-secondary text-xs min-h-[44px] justify-center"
                >
                  <Info className="mr-1.5 h-3.5 w-3.5 inline" />
                  View Details
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/voter?election_id=${e.id}`)}
                  className="button button-teal text-xs min-h-[44px] justify-center font-bold"
                >
                  Vote Now
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5 inline" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Details Roster Modal */}
      {detailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3.5 sm:p-4">
          <div className="card max-w-xl w-full p-5 sm:p-6 space-y-4 sm:space-y-5 animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-extrabold text-teal-700 uppercase tracking-wider">
                  Election Details & Candidate Roster
                </span>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">{detailsModal.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailsModal(null)}
                className="text-slate-400 hover:text-slate-700 p-2 min-h-[40px] min-w-[40px] flex items-center justify-center"
                aria-label="Close roster modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 pr-0.5">
              <p className="text-xs text-slate-600 leading-relaxed">
                {detailsModal.description || "No additional description provided."}
              </p>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-xs text-slate-600">
                <p><strong>Election ID:</strong> <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-800 break-all">{detailsModal.id}</code></p>
                <p><strong>Start Time:</strong> {new Date(detailsModal.starts_at).toLocaleString()}</p>
                <p><strong>End Time:</strong> {new Date(detailsModal.ends_at).toLocaleString()}</p>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Registered Candidates ({candidatesList.length})
                </h4>

                {loadingCandidates && (
                  <div className="p-4 text-center text-xs text-slate-500">
                    <RefreshCw className="h-4 w-4 animate-spin inline mr-2" />
                    Loading candidates...
                  </div>
                )}

                {!loadingCandidates && candidatesList.length === 0 && (
                  <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-lg">
                    No candidates registered yet.
                  </p>
                )}

                {!loadingCandidates && candidatesList.length > 0 && (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {candidatesList.map((c) => (
                      <div key={c.id} className="p-3 bg-white border border-slate-200 rounded-lg flex items-start justify-between">
                        <div>
                          <h5 className="text-xs font-bold text-slate-900">{c.name}</h5>
                          <span className="inline-block text-[10px] font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 mt-0.5">
                            {c.party}
                          </span>
                          {c.manifesto && (
                            <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">
                              {c.manifesto}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <span className="text-[11px] text-slate-500 font-medium">
                Voting requires Voter Name & Voter ID verification.
              </span>
              <button
                type="button"
                onClick={() => {
                  const targetId = detailsModal.id;
                  setDetailsModal(null);
                  router.push(`/voter?election_id=${targetId}`);
                }}
                className="button button-teal text-xs min-h-[44px] justify-center font-bold w-full sm:w-auto"
              >
                Proceed to Vote
                <ArrowRight className="ml-1.5 h-3.5 w-3.5 inline" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
