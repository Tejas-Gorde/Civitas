"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, readable, setAccessToken } from "../../../lib/api";
import { toast } from "sonner";
import { Shield, ShieldAlert, Key, Lock, ArrowRight, Info, CheckCircle2, RefreshCw, X, ArrowLeft } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"temp" | "big">("temp");

  // Temporary Admin Login Form State
  const [tempAdminId, setTempAdminId] = useState<string>("");
  const [tempPassword, setTempPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Big Admin Direct Login State
  const [loggingInBig, setLoggingInBig] = useState<boolean>(false);

  const handleTempAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempAdminId.trim() || !tempPassword.trim()) {
      toast.error("Please enter both Local Admin ID and Password.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await api.post("/admin/temp-login", {
        temp_admin_id: tempAdminId.trim(),
        password: tempPassword.trim(),
      });

      if (res.data && res.data.access_token) {
        setAccessToken(res.data.access_token);
        localStorage.setItem("userRole", "temp_admin");
        toast.success("Local Administrator authenticated.");
        router.push("/local-admin/dashboard");
      }
    } catch (err: any) {
      const msg = readable(err);
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleBigAdminDirectLogin = async () => {
    setLoggingInBig(true);
    try {
      const res = await api.post("/admin/big-admin-login");
      if (res.data && res.data.access_token) {
        setAccessToken(res.data.access_token);
        localStorage.setItem("userRole", "big_admin");
        toast.success("Big Admin session initialized.");
        router.push("/admin");
      }
    } catch (err) {
      toast.error(readable(err));
    } finally {
      setLoggingInBig(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      {/* Header Banner */}
      <div className="card p-6 sm:p-8 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-400 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700">
              <Shield className="h-3.5 w-3.5 text-teal-400" />
              ELECTION ADMINISTRATOR PORTAL
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight">
              Administrator Entry Portal
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-300">
              Sign in with your assigned Local Admin credentials or access master Big Admin controls.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="button button-secondary text-xs text-slate-300 hover:text-white shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1 inline" />
            Back to Options
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl bg-slate-100 p-1.5 border border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("temp")}
          className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-extrabold transition-all ${
            activeTab === "temp"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          LOCAL ADMIN LOGIN
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("big")}
          className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-extrabold transition-all ${
            activeTab === "big"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          BIG ADMIN LOGIN
        </button>
      </div>

      {/* TAB A: LOCAL ADMIN LOGIN */}
      {activeTab === "temp" && (
        <div className="card p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <span className="text-[10px] font-extrabold text-teal-700 uppercase tracking-widest">
              Assigned Election Access
            </span>
            <h2 className="text-xl font-bold text-slate-900">
              Local Admin Login
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Sign in using the Local Admin credentials created when this election was created.
            </p>
          </div>

          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5">
              <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Authentication Failed</p>
                <p className="mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleTempAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Local Admin ID <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={tempAdminId}
                onChange={(e) => setTempAdminId(e.target.value)}
                placeholder="e.g. electionA_admin"
                className="input font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Local Admin Password <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                required
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                placeholder="Enter password"
                className="input"
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-teal-600 inline" />
                Permitted Scope Notice:
              </p>
              <p>
                Local Admins have permission strictly over their assigned election. Attempts to access unrelated elections or global system settings will be denied.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !tempAdminId.trim() || !tempPassword.trim()}
              className="button button-teal w-full py-3 text-xs font-bold"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin inline mr-2" />
              ) : (
                <>
                  Authenticate Local Admin →
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* TAB B: BIG ADMIN LOGIN */}
      {activeTab === "big" && (
        <div className="card p-6 sm:p-8 text-center space-y-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-900 border border-slate-200">
            <Shield className="h-7 w-7 text-teal-600" />
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">
              Full System Control Portal
            </span>
            <h2 className="text-xl font-extrabold text-slate-900">
              Big Admin Master Control
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Master administration dashboard for global election overrides, system settings, voter management, and full audit logs.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleBigAdminDirectLogin}
              disabled={loggingInBig}
              className="button button-primary py-3 px-8 text-xs uppercase tracking-wider font-extrabold"
            >
              {loggingInBig ? (
                <RefreshCw className="h-4 w-4 animate-spin inline mr-2" />
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2 inline text-teal-400" />
                  BIG ADMIN LOGIN
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
