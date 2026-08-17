"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, readable, setAccessToken } from "../../../lib/api";
import { toast } from "sonner";
import {
  Shield,
  Plus,
  Key,
  ArrowRight,
  RefreshCw,
  X,
  ShieldAlert,
  Activity,
  ArrowLeft,
} from "lucide-react";

export default function ElectionManagementPage() {
  const router = useRouter();

  // Temp Admin Login State
  const [tempModalOpen, setTempModalOpen] = useState<boolean>(false);
  const [tempAdminId, setTempAdminId] = useState<string>("");
  const [tempPassword, setTempPassword] = useState<string>("");
  const [loggingInTemp, setLoggingInTemp] = useState<boolean>(false);
  const [tempErrorMsg, setTempErrorMsg] = useState<string | null>(null);

  // TEMP ADMIN LOGIN: Form submit
  const handleTempAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempAdminId.trim() || !tempPassword.trim()) {
      toast.error("Please enter both Local Admin ID and Password.");
      return;
    }

    setLoggingInTemp(true);
    setTempErrorMsg(null);

    try {
      const res = await api.post("/admin/temp-login", {
        temp_admin_id: tempAdminId.trim(),
        password: tempPassword.trim(),
      });

      if (res.data && res.data.access_token) {
        setAccessToken(res.data.access_token);
        localStorage.setItem("userRole", "temp_admin");
        toast.success("Temporary Administrator authenticated.");
        setTempModalOpen(false);
        router.push("/local-admin/dashboard");
      }
    } catch (err) {
      const msg = readable(err);
      setTempErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoggingInTemp(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-6">
      {/* Header Banner */}
      <div className="card p-6 sm:p-8 bg-slate-950 text-white rounded-xl shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-indigo-400 bg-indigo-950/80 px-3 py-1 rounded-full border border-indigo-800/60">
            <Shield className="h-3.5 w-3.5 text-indigo-400" />
            <span>CREATE & MANAGE ELECTION HUB</span>
          </div>
          <h1 className="mt-2.5 text-2xl sm:text-3xl font-black tracking-tight text-white">
            Election Management Hub
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            Create new secure elections or log in as Local Admin to manage voters, candidates, and live results.
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push("/")}
          className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition shrink-0 self-start md:self-auto"
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5 inline" />
          Back to Options
        </button>
      </div>

      {/* Main Administrative Action Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CARD 1: CREATE NEW ELECTION */}
        <div className="card p-6 sm:p-8 space-y-5 border-2 border-transparent hover:border-indigo-500 transition-all shadow-xs hover:shadow-md flex flex-col justify-between rounded-2xl bg-white">
          <div className="space-y-4">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs border border-indigo-100">
              <Plus className="h-6 w-6" />
            </div>

            <div>
              <span className="text-[11px] font-extrabold text-indigo-600 uppercase tracking-wider block mb-1">
                New Setup
              </span>
              <h2 className="text-xl font-extrabold text-slate-900">
                CREATE A NEW ELECTION
              </h2>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Set up election details, candidates & voters
              </p>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Launch a 6-step setup wizard to configure Election Information, candidates, voter credentials, and voting verification rules.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/admin/create")}
            className="button button-teal w-full py-3 text-xs font-extrabold flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20"
          >
            <span>Start Election Setup Wizard</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* CARD 2: LOG IN AS LOCAL ADMIN */}
        <div className="card p-6 sm:p-8 space-y-5 border-2 border-transparent hover:border-slate-800 transition-all shadow-xs hover:shadow-md flex flex-col justify-between rounded-2xl bg-white">
          <div className="space-y-4">
            <div className="h-12 w-12 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center shadow-xs border border-slate-200">
              <Key className="h-6 w-6" />
            </div>

            <div>
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                Local Admin Portal
              </span>
              <h2 className="text-xl font-extrabold text-slate-900">
                LOG IN AS LOCAL ADMIN
              </h2>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Manage an existing assigned election
              </p>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Log in with your assigned Local Admin ID and Password to manage candidates, voter lists, and view live tallies.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setTempModalOpen(true)}
            className="button button-secondary w-full py-3 text-xs font-extrabold flex items-center justify-center gap-2 shadow-xs"
          >
            <Key className="h-4 w-4" />
            <span>Local Admin Sign In</span>
          </button>
        </div>
      </div>

      {/* Public Discovery Info Box */}
      <div className="card p-5 bg-white border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">Looking for Public Live Elections?</h4>
            <p className="text-[11px] text-slate-500">
              The public discovery page for all active elections is located under Option 3.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push("/live-elections")}
          className="button button-secondary text-xs shrink-0"
        >
          View Live Elections →
        </button>
      </div>

      {/* LOCAL ADMIN LOGIN MODAL */}
      {tempModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="card max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-extrabold text-teal-700 uppercase tracking-wider">
                  Assigned Election Portal
                </span>
                <h3 className="text-lg font-bold text-slate-900">Local Admin Login</h3>
              </div>
              <button
                type="button"
                onClick={() => setTempModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {tempErrorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <p>{tempErrorMsg}</p>
              </div>
            )}

            <form onSubmit={handleTempAdminSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Local Admin ID
                </label>
                <input
                  type="text"
                  required
                  value={tempAdminId}
                  onChange={(e) => setTempAdminId(e.target.value)}
                  placeholder="e.g. electionA_admin"
                  className="input text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Local Admin Password
                </label>
                <input
                  type="password"
                  required
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  placeholder="Enter password"
                  className="input text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={loggingInTemp || !tempAdminId.trim() || !tempPassword.trim()}
                className="button button-teal w-full py-2.5 text-xs font-bold"
              >
                {loggingInTemp ? (
                  <RefreshCw className="h-4 w-4 animate-spin mx-auto" />
                ) : (
                  <>
                    Authenticate Local Admin
                    <ArrowRight className="h-4 w-4 ml-1.5 inline" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
