"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Landmark,
  Calendar,
  CheckCircle2,
  Search,
  Filter,
  MoreVertical,
  Radio,
  Clock,
  ShieldAlert,
  Globe,
  Info,
  X,
  RefreshCw,
  Building,
  Vote,
  GraduationCap,
  Users,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { api, readable, restoreAccessToken } from "../../lib/api";
import AdminSidebar, { AdminTab } from "../../components/AdminSidebar";

interface ElectionItem {
  id: string;
  election_id?: string;
  name: string;
  description?: string;
  state: "draft" | "scheduled" | "open" | "paused" | "closed" | "published";
  starts_at: string;
  ends_at: string;
  voting_flow_mode?: string;
  temp_admin_username?: string;
  temp_admin_user_id?: string;
  candidate_count?: number;
  show_voter_names_in_results?: boolean;
}

interface SystemStats {
  totalElections: number;
  liveElections: number;
  upcomingElections: number;
  completedElections: number;
}

export default function BigAdminMonitorPage() {
  const router = useRouter();

  // Navigation & View States
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Elections Data
  const [elections, setElections] = useState<ElectionItem[]>([]);
  const [electionTurnouts, setElectionTurnouts] = useState<
    Record<string, { votes: number; total: number; percent: number }>
  >({});
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [showFilterDropdown, setShowFilterDropdown] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 8;

  // Read-only Status Modal
  const [selectedElection, setSelectedElection] = useState<ElectionItem | null>(null);
  const [modalResults, setModalResults] = useState<any | null>(null);
  const [modalAuditLogs, setModalAuditLogs] = useState<any[]>([]);
  const [loadingModalData, setLoadingModalData] = useState<boolean>(false);

  // Audit Logs Tab Data
  const [systemAuditLogs, setSystemAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState<boolean>(false);

  // Tunnel Config Data
  const [tunnelConfig, setTunnelConfig] = useState<{
    public_base_url: string;
    is_online: boolean;
    is_https: boolean;
    warning_message?: string | null;
  }>({
    public_base_url: "",
    is_online: false,
    is_https: false,
  });
  const [tunnelInput, setTunnelInput] = useState<string>("");
  const [savingTunnel, setSavingTunnel] = useState<boolean>(false);

  // Strict Main Admin Session verification
  useEffect(() => {
    const checkAuthAndInit = () => {
      if (typeof window !== "undefined") {
        const role = localStorage.getItem("userRole");
        const token = restoreAccessToken();
        if (role === "temp_admin") {
          router.replace("/local-admin/dashboard");
          return false;
        }
        if (!token || role !== "big_admin") {
          router.replace("/admin/login");
          return false;
        }
      }
      return true;
    };

    if (checkAuthAndInit()) {
      fetchSystemData();
    }

    const handlePopOrFocus = () => {
      const role = typeof window !== "undefined" ? localStorage.getItem("userRole") : null;
      const token = restoreAccessToken();
      if (!token || role !== "big_admin") {
        router.replace("/admin/login");
      }
    };

    window.addEventListener("popstate", handlePopOrFocus);
    window.addEventListener("focus", handlePopOrFocus);
    return () => {
      window.removeEventListener("popstate", handlePopOrFocus);
      window.removeEventListener("focus", handlePopOrFocus);
    };
  }, [router]);

  const fetchSystemData = async () => {
    setLoading(true);
    try {
      // 1. Fetch elections
      const elecRes = await api.get("/admin/elections");
      const elecList: ElectionItem[] = elecRes.data || [];
      setElections(elecList);

      // 2. Fetch turnouts
      const turnouts: Record<string, { votes: number; total: number; percent: number }> = {};
      await Promise.all(
        elecList.map(async (el) => {
          try {
            const res = await api.get(`/admin/results/${el.id}`);
            turnouts[el.id] = {
              votes: res.data.total_votes_cast || 0,
              total: res.data.total_voters || 0,
              percent: res.data.turnout_percent || 0,
            };
          } catch {
            turnouts[el.id] = { votes: 0, total: 0, percent: 0 };
          }
        })
      );
      setElectionTurnouts(turnouts);

      // 3. Fetch tunnel status
      try {
        const tunnelRes = await api.get("/admin/config/public-url");
        setTunnelConfig(tunnelRes.data);
        setTunnelInput(tunnelRes.data.public_base_url || "");
      } catch {
        // Non-blocking
      }
    } catch (err) {
      toast.error(readable(err) || "Failed to load system data.");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSystemData();
    if (activeTab === "audit") {
      await fetchAuditLogs();
    }
    setRefreshing(false);
    toast.success("System monitor updated.");
  };

  const fetchAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const res = await api.get("/admin/analytics");
      if (res.data && res.data.audit_trail) {
        setSystemAuditLogs(res.data.audit_trail);
      }
    } catch (err) {
      toast.error("Failed to load audit logs: " + readable(err));
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (activeTab === "audit") {
      fetchAuditLogs();
    }
  }, [activeTab]);

  // Open Read-Only Status Modal
  const handleOpenStatusModal = async (elec: ElectionItem) => {
    setSelectedElection(elec);
    setLoadingModalData(true);
    setModalResults(null);
    setModalAuditLogs([]);

    try {
      const [resData, logsData] = await Promise.allSettled([
        api.get(`/admin/elections/${elec.id}/results`),
        api.get(`/admin/elections/${elec.id}/audit-logs`),
      ]);

      if (resData.status === "fulfilled") {
        setModalResults(resData.value.data);
      }
      if (logsData.status === "fulfilled") {
        setModalAuditLogs(logsData.value.data || []);
      }
    } catch (err) {
      toast.error("Failed to load election details: " + readable(err));
    } finally {
      setLoadingModalData(false);
    }
  };

  // Tunnel Config Save
  const handleSaveTunnel = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = tunnelInput.trim().replace(/\/+$/, "");
    setSavingTunnel(true);
    try {
      const res = await api.post("/admin/config/public-url", {
        public_base_url: cleanUrl,
      });
      setTunnelConfig(res.data);
      toast.success("Public network configuration updated.");
    } catch (err) {
      toast.error("Failed to update tunnel URL: " + readable(err));
    } finally {
      setSavingTunnel(false);
    }
  };

  // Stats Calculation
  const stats: SystemStats = useMemo(() => {
    const total = elections.length;
    const live = elections.filter((e) => e.state === "open").length;
    const upcoming = elections.filter((e) => e.state === "scheduled" || e.state === "draft").length;
    const completed = elections.filter((e) => e.state === "closed" || e.state === "published").length;
    return {
      totalElections: total,
      liveElections: live,
      upcomingElections: upcoming,
      completedElections: completed,
    };
  }, [elections]);

  // Filtered & Paginated Elections
  const filteredElections = useMemo(() => {
    return elections.filter((el) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        el.name.toLowerCase().includes(q) ||
        (el.election_id && el.election_id.toLowerCase().includes(q)) ||
        (el.temp_admin_username && el.temp_admin_username.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "LIVE" && el.state === "open") ||
        (statusFilter === "SCHEDULED" && el.state === "scheduled") ||
        (statusFilter === "PAUSED" && el.state === "paused") ||
        (statusFilter === "COMPLETED" && (el.state === "closed" || el.state === "published")) ||
        (statusFilter === "DRAFT" && el.state === "draft");

      return matchesSearch && matchesStatus;
    });
  }, [elections, searchQuery, statusFilter]);

  const totalPages = Math.ceil(filteredElections.length / itemsPerPage) || 1;
  const paginatedElections = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredElections.slice(start, start + itemsPerPage);
  }, [filteredElections, currentPage]);

  const getElectionIcon = (index: number, name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes("municipal") || lower.includes("city") || lower.includes("council")) {
      return <Vote className="h-5 w-5 text-slate-700 stroke-[1.8]" />;
    }
    if (lower.includes("assembly") || lower.includes("referendum") || lower.includes("parliament")) {
      return <Building className="h-5 w-5 text-slate-700 stroke-[1.8]" />;
    }
    if (lower.includes("university") || lower.includes("student") || lower.includes("board")) {
      return <GraduationCap className="h-5 w-5 text-slate-700 stroke-[1.8]" />;
    }
    return <Landmark className="h-5 w-5 text-slate-700 stroke-[1.8]" />;
  };

  const getStatusBadge = (state: string) => {
    switch (state.toLowerCase()) {
      case "open":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            Live Now
          </span>
        );
      case "scheduled":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-700 text-white">
            Upcoming
          </span>
        );
      case "paused":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
            Paused
          </span>
        );
      case "closed":
      case "published":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-700">
            Completed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
            Draft
          </span>
        );
    }
  };

  const formatDateRange = (startsAt: string, endsAt: string) => {
    try {
      const s = new Date(startsAt);
      const e = new Date(endsAt);
      const startStr = s.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const endStr = e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      return `${startStr} - ${endStr}`;
    } catch {
      return "Active Schedule";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <div className="flex flex-1 relative">
        {/* Big Admin Light Sidebar */}
        <AdminSidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          onCreateElection={() => {}}
          unreadCount={0}
        />

        {/* Main Content Area */}
        <main className="flex-1 p-6 sm:p-8 max-w-6xl mx-auto w-full space-y-6">
          {/* TAB 1: SYSTEM OVERVIEW & ELECTION DIRECTORY (Screenshot 1 Match) */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              {/* 4 Top KPI Cards matching Screenshot 1 */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Total Elections */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <span>TOTAL ELECTIONS</span>
                    <Landmark className="h-4 w-4 text-slate-400 stroke-[2]" />
                  </div>
                  <div className="text-3xl font-black text-slate-900 tracking-tight">
                    {stats.totalElections.toLocaleString()}
                  </div>
                  <div className="text-xs font-medium text-blue-600 flex items-center gap-1">
                    <span>↑ +12%</span>
                    <span className="text-slate-400 font-normal">from last year</span>
                  </div>
                </div>

                {/* Live Now */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <span>LIVE NOW</span>
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500/80 animate-ping" />
                  </div>
                  <div className="text-3xl font-black text-slate-900 tracking-tight">
                    {stats.liveElections}
                  </div>
                  <div className="text-xs text-slate-500">
                    Active across 5 regions
                  </div>
                </div>

                {/* Upcoming */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <span>UPCOMING</span>
                    <Calendar className="h-4 w-4 text-slate-400 stroke-[2]" />
                  </div>
                  <div className="text-3xl font-black text-slate-900 tracking-tight">
                    {stats.upcomingElections}
                  </div>
                  <div className="text-xs text-slate-500">
                    Scheduled next 30 days
                  </div>
                </div>

                {/* Completed */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <span>COMPLETED</span>
                    <CheckCircle2 className="h-4 w-4 text-slate-400 stroke-[2]" />
                  </div>
                  <div className="text-3xl font-black text-slate-900 tracking-tight">
                    {stats.completedElections.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-500">
                    Successfully verified
                  </div>
                </div>
              </div>

              {/* Main Election Directory Section */}
              <div className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden">
                {/* Directory Header Bar */}
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                      Election Directory
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Comprehensive overview of all system events.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Search Input */}
                    <div className="relative w-full sm:w-72">
                      <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setCurrentPage(1);
                        }}
                        placeholder="Search elections..."
                        className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
                      />
                    </div>

                    {/* Filter Button */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                        className={`py-2 px-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition ${
                          statusFilter !== "ALL"
                            ? "bg-blue-50 border-blue-200 text-blue-700"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <Filter className="h-3.5 w-3.5" />
                        <span>{statusFilter === "ALL" ? "Filter" : statusFilter}</span>
                      </button>

                      {showFilterDropdown && (
                        <div className="absolute right-0 mt-2 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-20 animate-fade-in">
                          {["ALL", "LIVE", "SCHEDULED", "PAUSED", "COMPLETED", "DRAFT"].map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => {
                                setStatusFilter(st);
                                setShowFilterDropdown(false);
                                setCurrentPage(1);
                              }}
                              className={`w-full text-left px-3.5 py-1.5 text-xs font-semibold hover:bg-slate-50 transition ${
                                statusFilter === st ? "text-blue-600 font-bold bg-blue-50/50" : "text-slate-700"
                              }`}
                            >
                              {st}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Directory Table (Desktop) & Card List (Mobile) */}
                <div className="overflow-x-auto">
                  {/* Desktop Table (md+) */}
                  <table className="hidden md:table w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50/80 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-100">
                      <tr>
                        <th className="py-3.5 px-6 font-semibold">ELECTION NAME</th>
                        <th className="py-3.5 px-6 font-semibold">REGION</th>
                        <th className="py-3.5 px-6 font-semibold">DATE</th>
                        <th className="py-3.5 px-6 font-semibold">STATUS</th>
                        <th className="py-3.5 px-6 font-semibold text-right">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loading ? (
                        <tr>
                          <td colSpan={5} className="py-14 text-center text-slate-400">
                            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
                            Loading election directory...
                          </td>
                        </tr>
                      ) : paginatedElections.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-14 text-center text-slate-400">
                            No elections found matching the query.
                          </td>
                        </tr>
                      ) : (
                        paginatedElections.map((el, idx) => (
                          <tr
                            key={el.id}
                            className="hover:bg-slate-50/70 transition cursor-pointer"
                            onClick={() => handleOpenStatusModal(el)}
                          >
                            {/* Election Name & Icon Box */}
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3.5">
                                <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                                  {getElectionIcon(idx, el.name)}
                                </div>
                                <div className="space-y-0.5">
                                  <div className="font-bold text-slate-900 text-sm">{el.name}</div>
                                  <div className="text-[11px] text-slate-400 font-mono">
                                    ID: {el.election_id || el.id.slice(0, 10).toUpperCase()}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Region / Local Admin */}
                            <td className="py-4 px-6 text-slate-700 font-medium">
                              <div>{el.temp_admin_username ? `@${el.temp_admin_username}` : "District 4, New City"}</div>
                              <div className="text-[11px] text-slate-400">Assigned Manager</div>
                            </td>

                            {/* Date */}
                            <td className="py-4 px-6 text-slate-600 whitespace-nowrap font-medium">
                              {formatDateRange(el.starts_at, el.ends_at)}
                            </td>

                            {/* Status */}
                            <td className="py-4 px-6 whitespace-nowrap">
                              {getStatusBadge(el.state)}
                            </td>

                            {/* Actions */}
                            <td className="py-4 px-6 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => handleOpenStatusModal(el)}
                                aria-label="View Election"
                                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {/* Mobile Card List (<md) */}
                  <div className="block md:hidden divide-y divide-slate-100">
                    {loading ? (
                      <div className="py-12 text-center text-slate-400">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
                        Loading election directory...
                      </div>
                    ) : paginatedElections.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 text-xs">
                        No elections found matching the query.
                      </div>
                    ) : (
                      paginatedElections.map((el, idx) => (
                        <div
                          key={el.id}
                          onClick={() => handleOpenStatusModal(el)}
                          className="p-4 space-y-3 hover:bg-slate-50/70 active:bg-slate-100 transition cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                                {getElectionIcon(idx, el.name)}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 text-sm leading-snug">{el.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  ID: {el.election_id || el.id.slice(0, 10).toUpperCase()}
                                </div>
                              </div>
                            </div>
                            <div className="shrink-0">
                              {getStatusBadge(el.state)}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-1">
                            <span className="font-medium text-slate-700">
                              {el.temp_admin_username ? `@${el.temp_admin_username}` : "District 4, New City"}
                            </span>
                            <span className="text-slate-500">
                              {formatDateRange(el.starts_at, el.ends_at)}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Directory Pagination Footer */}
                <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                  <div>
                    Showing{" "}
                    <span className="font-bold text-slate-700">
                      {filteredElections.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}
                    </span>
                    -
                    <span className="font-bold text-slate-700">
                      {Math.min(currentPage * itemsPerPage, filteredElections.length)}
                    </span>{" "}
                    of <span className="font-bold text-slate-700">{filteredElections.length}</span> results
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                      <button
                        key={pg}
                        type="button"
                        onClick={() => setCurrentPage(pg)}
                        className={`h-7 w-7 rounded-lg text-xs font-bold transition ${
                          currentPage === pg
                            ? "bg-blue-600 text-white shadow-xs"
                            : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {pg}
                      </button>
                    ))}

                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: NETWORK MONITOR (CLOUDFLARE QUICK TUNNEL) */}
          {activeTab === "tunnel" && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="space-y-1">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Radio className="h-5 w-5 text-blue-600" />
                      <span>Cloudflare Network Tunnel Status</span>
                    </h2>
                    <p className="text-xs text-slate-500">
                      Public ingress URL used by mobile voters to access election voting portals.
                    </p>
                  </div>
                  <div>
                    {tunnelConfig.is_online ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        TUNNEL ONLINE
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">
                        TUNNEL OFFLINE
                      </span>
                    )}
                  </div>
                </div>

                <form onSubmit={handleSaveTunnel} className="space-y-4 max-w-xl text-xs">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">Public Base URL (Cloudflare Tunnel)</label>
                    <input
                      type="text"
                      value={tunnelInput}
                      onChange={(e) => setTunnelInput(e.target.value)}
                      placeholder="https://random-words.trycloudflare.com"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white text-sm"
                    />
                    <p className="text-[11px] text-slate-400">
                      Local Admins generate mobile voting links derived from this public tunnel domain.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={savingTunnel}
                    className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-xs"
                  >
                    {savingTunnel ? "Saving..." : "Save Public Base URL"}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 3: SECURITY & AUDIT LOGS */}
          {activeTab === "audit" && (
            <div className="space-y-6">
              <div className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <ShieldAlert className="h-5 w-5 text-blue-600" />
                      <span>System Security & Audit Trail</span>
                    </h2>
                    <p className="text-xs text-slate-500">
                      Immutable cryptographic audit trail for election management actions.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={fetchAuditLogs}
                    disabled={loadingAudit}
                    className="py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition flex items-center gap-1.5"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingAudit ? "animate-spin" : ""}`} />
                    <span>Refresh</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-100">
                      <tr>
                        <th className="py-3 px-6">Timestamp</th>
                        <th className="py-3 px-6">Action</th>
                        <th className="py-3 px-6">Entity</th>
                        <th className="py-3 px-6">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {loadingAudit ? (
                        <tr>
                          <td colSpan={4} className="py-10 text-center text-slate-400 font-sans">
                            <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-blue-600" />
                            Loading system audit records...
                          </td>
                        </tr>
                      ) : systemAuditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-10 text-center text-slate-400 font-sans">
                            No system audit logs found.
                          </td>
                        </tr>
                      ) : (
                        systemAuditLogs.map((log, idx) => (
                          <tr key={log.id || idx} className="hover:bg-slate-50">
                            <td className="py-3 px-6 text-slate-500 whitespace-nowrap">
                              {log.created_at ? new Date(log.created_at).toLocaleString() : "N/A"}
                            </td>
                            <td className="py-3 px-6 font-bold text-blue-700 whitespace-nowrap">
                              {log.action}
                            </td>
                            <td className="py-3 px-6 text-slate-700 whitespace-nowrap">
                              {log.entity_type} ({log.entity_id ? log.entity_id.slice(0, 8) : "—"})
                            </td>
                            <td className="py-3 px-6 text-slate-500 max-w-md truncate font-sans">
                              {log.metadata_json || log.metadata ? JSON.stringify(log.metadata_json || log.metadata) : "—"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SYSTEM INFO */}
          {activeTab === "settings" && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Info className="h-5 w-5 text-blue-600" />
                  <span>CIVITAS Sovereign System Integrity</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="font-bold text-slate-900">Role Model</div>
                    <div className="text-slate-600">Strict Separation of Big Admin & Local Admin</div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="font-bold text-slate-900">Cryptographic Ballot Verifiability</div>
                    <div className="text-slate-600">SHA-256 Hash Chaining & AES-256 Voter Encryption</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* READ-ONLY STATUS MODAL */}
      {selectedElection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4 bg-slate-50/50">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-lg font-bold text-slate-900">{selectedElection.name}</h3>
                  {getStatusBadge(selectedElection.state)}
                </div>
                <div className="text-xs text-blue-600 font-mono">
                  ID: {selectedElection.election_id || selectedElection.id}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedElection(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
              {/* Notice Box */}
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-100 text-blue-900 text-xs flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0" />
                <span>
                  <strong>System Monitor:</strong> Big Administrator has read-only visibility into live metrics and candidate tallies. All ballot management belongs to the Local Administrator.
                </span>
              </div>

              {/* Overview Metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-[11px] text-slate-500 font-bold uppercase">Registered Voters</div>
                  <div className="text-2xl font-black text-slate-900">
                    {modalResults?.statistics?.registered_voters ?? "—"}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-[11px] text-slate-500 font-bold uppercase">Ballots Cast</div>
                  <div className="text-2xl font-black text-blue-700">
                    {modalResults?.statistics?.votes_cast ?? "—"}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-[11px] text-slate-500 font-bold uppercase">Turnout</div>
                  <div className="text-2xl font-black text-slate-900">
                    {modalResults?.statistics?.turnout_percentage ?? "0"}%
                  </div>
                </div>
              </div>

              {/* Local Admin & Schedule Info */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="font-bold text-slate-900 text-xs border-b border-slate-200 pb-2">
                  Election Administration & Schedule
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500">Local Admin: </span>
                    <span className="text-slate-900 font-bold">@{selectedElection.temp_admin_username || "Unassigned"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Flow Mode: </span>
                    <span className="text-slate-900 font-bold uppercase">{selectedElection.voting_flow_mode || "Kiosk"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Start: </span>
                    <span className="text-slate-800">{new Date(selectedElection.starts_at).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">End: </span>
                    <span className="text-slate-800">{new Date(selectedElection.ends_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Live Candidate Standings */}
              <div className="space-y-3">
                <div className="font-bold text-slate-900 text-xs">Active Candidates</div>
                {loadingModalData ? (
                  <div className="py-6 text-center text-slate-400 text-xs">
                    <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2 text-blue-600" />
                    Loading candidates...
                  </div>
                ) : !modalResults?.candidates || modalResults.candidates.length === 0 ? (
                  <div className="py-4 text-center text-slate-400 text-xs">
                    No candidates registered yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {modalResults.candidates.map((cand: any) => (
                      <div key={cand.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-900">
                            {cand.name} <span className="text-slate-500 font-normal">({cand.party})</span>
                          </span>
                          <span className="text-blue-700 font-bold">
                            {cand.votes} votes ({cand.percentage}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-blue-600 h-full rounded-full transition-all"
                            style={{ width: `${Math.min(cand.percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedElection(null)}
                className="py-2 px-5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
