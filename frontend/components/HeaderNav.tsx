"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Landmark, User, Loader2, LogOut, Menu, X, Vote, Activity, Shield } from "lucide-react";
import { api, readable, setAccessToken, clearAccessToken, restoreAccessToken } from "../lib/api";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import ThemeToggle from "./ThemeToggle";

export default function HeaderNav() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const [loadingBigAdmin, setLoadingBigAdmin] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutTarget, setLogoutTarget] = useState<"big_admin" | "local_admin">("big_admin");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Sync user role from localStorage, cookies/tokens, and pathname
  useEffect(() => {
    const syncRole = () => {
      if (typeof window !== "undefined") {
        const token = restoreAccessToken();
        const role = localStorage.getItem("userRole");
        if (!token) {
          setUserRole(null);
        } else {
          setUserRole(role);
        }
      }
    };
    syncRole();
    window.addEventListener("storage", syncRole);
    window.addEventListener("focus", syncRole);
    return () => {
      window.removeEventListener("storage", syncRole);
      window.removeEventListener("focus", syncRole);
    };
  }, [pathname]);

  const isLocalAdmin =
    userRole === "temp_admin" ||
    pathname.startsWith("/local-admin/dashboard") ||
    pathname.startsWith("/admin/temp");

  const isBigAdmin =
    userRole === "big_admin" ||
    (pathname.startsWith("/admin") &&
      !pathname.startsWith("/admin/login") &&
      !pathname.startsWith("/admin/temp"));

  const handleBigAdminDirectLogin = async () => {
    if (loadingBigAdmin) return;
    setLoadingBigAdmin(true);
    try {
      const res = await api.post("/admin/big-admin-login");
      if (res.data && res.data.access_token) {
        setAccessToken(res.data.access_token);
        localStorage.setItem("userRole", "big_admin");
        setUserRole("big_admin");
        toast.success("System Admin session verified.");
        router.push("/admin");
      }
    } catch (err) {
      toast.error(readable(err));
    } finally {
      setLoadingBigAdmin(false);
    }
  };

  const handleOpenLogout = (target: "big_admin" | "local_admin") => {
    setLogoutTarget(target);
    setShowLogoutModal(true);
  };

  const handleConfirmLogout = () => {
    clearAccessToken();
    setUserRole(null);
    setShowLogoutModal(false);

    if (logoutTarget === "big_admin") {
      toast.success("Logged out of Main Admin.");
      router.replace("/admin/login");
    } else {
      toast.success("Logged out of Local Admin.");
      router.replace("/local-admin");
    }
  };

  return (
    <header className="border-b border-slate-200 dark:border-[#141a22] bg-white/95 dark:bg-[#05070a]/95 backdrop-blur-md sticky top-0 z-40 transition-colors duration-200">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand Identity */}
        <Link href="/" className="flex items-center gap-2.5 group transition-opacity hover:opacity-95">
          <div className="text-teal-600 dark:text-teal-400 flex items-center justify-center">
            <Landmark className="h-6 w-6 stroke-[2.2]" />
          </div>
          <span className="text-lg font-black tracking-tight text-slate-900 dark:text-[#f5f7fa] font-sans">
            CIVITAS
          </span>
        </Link>

        {/* Global Navigation Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600 dark:text-[#a7b0bd]">
          <Link
            href="/voter"
            className={`transition-colors hover:text-teal-600 dark:hover:text-teal-400 ${
              pathname.startsWith("/voter") ? "text-teal-600 dark:text-teal-400 font-bold" : "text-slate-600 dark:text-[#a7b0bd]"
            }`}
          >
            Voter Portal
          </Link>

          <Link
            href="/live-elections"
            className={`transition-colors hover:text-teal-600 dark:hover:text-teal-400 ${
              pathname.startsWith("/live-elections") ? "text-teal-600 dark:text-teal-400 font-bold" : "text-slate-600 dark:text-[#a7b0bd]"
            }`}
          >
            Live Elections
          </Link>

          <Link
            href="/local-admin"
            className={`transition-colors hover:text-teal-600 dark:hover:text-teal-400 ${
              pathname.startsWith("/local-admin") ? "text-teal-600 dark:text-teal-400 font-bold" : "text-slate-600 dark:text-[#a7b0bd]"
            }`}
          >
            Manage
          </Link>
        </nav>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Top-Right Theme Toggle */}
          <ThemeToggle />

          {isBigAdmin ? (
            <>
              {/* Big / Main Admin Status Pill */}
              <div className="flex items-center gap-2 rounded-full bg-slate-100 dark:bg-[#0d1117] border border-slate-200 dark:border-[#1a222c] px-2.5 sm:px-3.5 py-1.5 text-[11px] font-bold text-slate-700 dark:text-[#a7b0bd] shadow-xs">
                <span className="h-2 w-2 rounded-full bg-teal-500 shrink-0" />
                <span className="hidden sm:inline">System Admin</span>
                <span className="sm:hidden">Admin</span>
              </div>

              {/* Main Admin Log Out Button */}
              <button
                type="button"
                onClick={() => handleOpenLogout("big_admin")}
                aria-label="Log Out of Main Admin"
                className="flex items-center gap-1.5 rounded-full bg-slate-100/90 dark:bg-[#0d1117] hover:bg-red-50 dark:hover:bg-[#1a0a0c] hover:text-red-700 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-[#3d1418] border border-slate-200/80 dark:border-[#1a222c] px-2.5 sm:px-3.5 py-1.5 text-[11px] font-bold text-slate-700 dark:text-[#a7b0bd] transition shadow-xs cursor-pointer min-h-[36px]"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Log Out</span>
              </button>
            </>
          ) : isLocalAdmin ? (
            <>
              {/* Local Admin Status Pill */}
              <div className="flex items-center gap-2 rounded-full bg-slate-100 dark:bg-[#0d1117] border border-slate-200 dark:border-[#1a222c] px-2.5 sm:px-3.5 py-1.5 text-[11px] font-bold text-slate-700 dark:text-[#a7b0bd] shadow-xs">
                <span className="h-2 w-2 rounded-full bg-teal-500 shrink-0" />
                <span className="hidden sm:inline">Local Admin</span>
                <span className="sm:hidden">Admin</span>
              </div>

              {/* Local Admin Log Out Button */}
              <button
                type="button"
                onClick={() => handleOpenLogout("local_admin")}
                aria-label="Log Out of Local Admin"
                className="flex items-center gap-1.5 rounded-full bg-slate-100/90 dark:bg-[#0d1117] hover:bg-red-50 dark:hover:bg-[#1a0a0c] hover:text-red-700 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-[#3d1418] border border-slate-200/80 dark:border-[#1a222c] px-2.5 sm:px-3.5 py-1.5 text-[11px] font-bold text-slate-700 dark:text-[#a7b0bd] transition shadow-xs cursor-pointer min-h-[36px]"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Log Out</span>
              </button>
            </>
          ) : (
            /* System Admin button: visible on desktop/tablet (sm:), hidden on public mobile header */
            <button
              type="button"
              onClick={handleBigAdminDirectLogin}
              disabled={loadingBigAdmin}
              aria-label="Access Big Admin Portal"
              className="hidden sm:flex items-center gap-2 rounded-full bg-slate-100/90 dark:bg-[#0d1117] hover:bg-slate-200/90 dark:hover:bg-[#11161d] border border-slate-200/80 dark:border-[#1a222c] px-3.5 py-1.5 text-[11px] font-bold text-slate-700 dark:text-[#a7b0bd] transition shadow-xs disabled:opacity-60 cursor-pointer"
            >
              <span className="h-2 w-2 rounded-full bg-teal-500 shrink-0" />
              <span>{loadingBigAdmin ? "Connecting..." : "System Admin"}</span>
            </button>
          )}

          {/* User Profile Icon */}
          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-teal-600 dark:bg-teal-600 flex items-center justify-center text-white shadow-xs shrink-0">
            <User className="h-4 w-4" />
          </div>

          {/* Mobile Hamburger Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            className="md:hidden flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-xl text-slate-700 dark:text-[#f5f7fa] hover:bg-slate-100 dark:hover:bg-[#0d1117] border border-slate-200 dark:border-[#1a222c] transition"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown Sheet */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-100 dark:border-[#141a22] bg-white/95 dark:bg-[#05070a]/95 backdrop-blur-md px-4 py-3 space-y-2 shadow-lg animate-in slide-in-from-top-2 duration-150">
          <Link
            href="/voter"
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              pathname.startsWith("/voter")
                ? "bg-teal-50 dark:bg-[#082421] text-teal-700 dark:text-[#2dd4bf] border border-teal-200 dark:border-[#0e3834]"
                : "text-slate-700 dark:text-[#a7b0bd] hover:bg-slate-50 dark:hover:bg-[#0d1117]"
            }`}
          >
            <Vote className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <span>Voter Portal</span>
          </Link>

          <Link
            href="/live-elections"
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              pathname.startsWith("/live-elections")
                ? "bg-sky-50 dark:bg-[#0a2034] text-sky-700 dark:text-[#38bdf8] border border-sky-200 dark:border-[#0e2c47]"
                : "text-slate-700 dark:text-[#a7b0bd] hover:bg-slate-50 dark:hover:bg-[#0d1117]"
            }`}
          >
            <Activity className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            <span>Live Elections</span>
          </Link>

          <Link
            href="/local-admin"
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              pathname.startsWith("/local-admin")
                ? "bg-slate-100 dark:bg-[#0d1117] text-slate-900 dark:text-[#f5f7fa] border border-slate-200 dark:border-[#1a222c]"
                : "text-slate-700 dark:text-[#a7b0bd] hover:bg-slate-50 dark:hover:bg-[#0d1117]"
            }`}
          >
            <Shield className="h-4 w-4 text-slate-700 dark:text-slate-400" />
            <span>Manage Elections</span>
          </Link>

          <div className="pt-2 border-t border-slate-100 dark:border-[#141a22]">
            <ThemeToggle variant="dropdown" />
          </div>
        </div>
      )}

      {/* Log Out Confirmation Dialog Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/85 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-[#0a0d11] border border-slate-200 dark:border-[#1a222c] rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <LogOut className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                {logoutTarget === "big_admin"
                  ? "Log out of Main Admin?"
                  : "Log out of Local Admin?"}
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {logoutTarget === "big_admin"
                ? "Your current administrator session will be ended."
                : "Your current admin session will be ended."}
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="py-2.5 px-5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-xs min-h-[44px]"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

