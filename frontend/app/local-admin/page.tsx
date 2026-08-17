"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, readable, setAccessToken, restoreAccessToken } from "../../lib/api";
import { toast } from "sonner";
import {
  Shield,
  ShieldAlert,
  Key,
  Lock,
  ArrowRight,
  Info,
  RefreshCw,
  ArrowLeft,
  Plus,
  CheckCircle2,
} from "lucide-react";

export default function LocalAdminLoginPage() {
  const router = useRouter();

  const [tempAdminId, setTempAdminId] = useState<string>("");
  const [tempPassword, setTempPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const role = localStorage.getItem("userRole");
      const token = restoreAccessToken();
      if (role === "temp_admin" && token) {
        router.replace("/local-admin/dashboard");
      }
    }
  }, [router]);

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

  return (
    <div className="max-w-2xl mx-auto py-4 sm:py-8 space-y-4 sm:space-y-6 px-2 sm:px-4">
      {/* Header Banner */}
      <div className="card p-5 sm:p-8 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-teal-400 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700">
              <Shield className="h-3.5 w-3.5 text-teal-400" />
              LOCAL ADMIN ENTRY PORTAL
            </div>
            <h1 className="mt-2 text-xl sm:text-3xl font-extrabold tracking-tight">
              Local Admin Login
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-300">
              Sign in with your assigned Local Admin credentials to manage your election.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="button button-secondary text-xs text-slate-300 hover:text-white shrink-0 self-start sm:self-auto min-h-[40px] px-3.5"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1 inline" />
            Back to Home
          </button>
        </div>
      </div>

      {/* Main Login Card */}
      <div className="card p-5 sm:p-8 space-y-5 sm:space-y-6 bg-white border border-slate-200 shadow-sm rounded-2xl">
        <div className="border-b border-slate-100 pb-3 sm:pb-4">
          <span className="text-[10px] font-extrabold text-teal-700 uppercase tracking-widest block mb-1">
            Assigned Election Management
          </span>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            Sign In to Local Admin Panel
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Enter the Local Admin ID and Password configured for your specific election.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 sm:p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5">
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
            <div className="relative">
              <input
                type="text"
                required
                value={tempAdminId}
                onChange={(e) => setTempAdminId(e.target.value)}
                placeholder="e.g. electionA_admin"
                className="input font-mono font-bold pl-9"
              />
              <Key className="h-4 w-4 text-slate-400 absolute left-3 top-3.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Local Admin Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                placeholder="Enter password"
                className="input pl-9"
              />
              <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-3.5" />
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-teal-600 inline shrink-0" />
              Permitted Scope Notice:
            </p>
            <p>
              Local Admins are authorized strictly over elections assigned to them. Unrelated system settings and other elections remain inaccessible.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !tempAdminId.trim() || !tempPassword.trim()}
            className="button button-teal w-full min-h-[48px] py-3.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span>Authenticate Local Admin</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Option to Create New Election */}
      <div className="card p-5 sm:p-6 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <h3 className="text-sm font-bold text-slate-900 flex items-center justify-center sm:justify-start gap-2">
            <Plus className="h-4 w-4 text-teal-600" />
            Need to Create a New Election?
          </h3>
          <p className="text-xs text-slate-600">
            Set up an election and generate new Local Admin credentials to manage it.
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push("/admin/create")}
          className="button button-secondary text-xs font-bold py-2.5 px-4 shrink-0 text-slate-800 hover:bg-white w-full sm:w-auto min-h-[44px]"
        >
          Create New Election →
        </button>
      </div>
    </div>
  );
}
