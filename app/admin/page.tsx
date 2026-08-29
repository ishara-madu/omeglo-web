"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  ShieldCheck,
  Users,
  Activity,
  Trash2,
  RefreshCw,
  Lock,
  Unlock,
  AlertTriangle,
  Search,
  CheckCircle,
  XCircle,
  ExternalLink,
  Ban,
  Clock,
  Sparkles,
  Database,
  ArrowLeft,
  ChevronRight,
  Eye,
  X,
  Check,
} from "lucide-react";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ||
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  "https://omeglo-backend.pocoma3486.workers.dev";

type Tab = "overview" | "reports" | "quarantine" | "bans" | "maintenance";

type OverviewData = {
  totalReports: number;
  activeQuarantined: number;
  totalBanned: number;
  todayReports: number;
  liveSockets: number;
  activeMatches: number;
  cleanVideoQueue: number;
  cleanTextQueue: number;
  quarantinedVideoQueue: number;
  quarantinedTextQueue: number;
};

type ReportItem = {
  id: string;
  reporter_socket_id: string;
  reported_socket_id: string;
  reported_peer_id: string;
  reported_device_id: string;
  reported_user_agent: string;
  reported_platform: string;
  reported_screen: string;
  reported_timezone: string;
  reported_language: string;
  reported_gpu: string;
  reported_metadata: string;
  reason: string;
  details: string;
  mode: string;
  ip_address: string;
  status: string;
  created_at: string;
};

type QuarantineItem = {
  id: string;
  identifier: string;
  identifier_type: string;
  report_count: number;
  quarantine_level: number;
  is_quarantined: number;
  quarantined_until: string;
  last_reported_at: string;
  created_at: string;
};

type BanItem = {
  id: string;
  identifier: string;
  identifier_type: string;
  reason: string;
  banned_at: string;
  expires_at: string | null;
};

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState<string>("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>("");
  const [authError, setAuthError] = useState<string>("");

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [quarantineList, setQuarantineList] = useState<QuarantineItem[]>([]);
  const [bansList, setBansList] = useState<BanItem[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Selected Report Detail Modal
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);

  // Manual Ban Modal
  const [showBanModal, setShowBanModal] = useState<boolean>(false);
  const [banIdentifier, setBanIdentifier] = useState<string>("");
  const [banType, setBanType] = useState<string>("device_id");
  const [banReason, setBanReason] = useState<string>("Severe Community Safety Violation");
  const [banDuration, setBanDuration] = useState<string>("");

  // Toast Helper
  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Check saved session on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("omeglo_admin_token");
      if (saved) {
        setAdminKey(saved);
        setIsAuthenticated(true);
      }
    } catch {}
  }, []);

  // Fetch API Helper
  const apiFetch = useCallback(
    async (endpoint: string, options: RequestInit = {}) => {
      const token = adminKey || sessionStorage.getItem("omeglo_admin_token") || "omeglo123";
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Admin-Key": token,
        ...(options.headers || {}),
      };

      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        ...options,
        headers,
      });

      if (res.status === 401) {
        setIsAuthenticated(false);
        sessionStorage.removeItem("omeglo_admin_token");
        throw new Error("Invalid or expired Admin Passcode");
      }

      return res.json();
    },
    [adminKey]
  );

  // Load active tab data
  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      if (activeTab === "overview") {
        const data = await apiFetch("/api/admin/overview");
        if (data.success) setOverview(data.overview);
      } else if (activeTab === "reports") {
        const data = await apiFetch("/api/admin/reports");
        if (data.success) setReports(data.reports);
      } else if (activeTab === "quarantine") {
        const data = await apiFetch("/api/admin/quarantine");
        if (data.success) setQuarantineList(data.quarantinedUsers);
      } else if (activeTab === "bans") {
        const data = await apiFetch("/api/admin/bans");
        if (data.success) setBansList(data.bans);
      }
    } catch (err: any) {
      showToast(err.message || "Failed to load data", "error");
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, apiFetch, isAuthenticated]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Login PIN submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) return;
    setAuthError("");
    setIsLoading(true);

    try {
      const token = pinInput.trim();
      const res = await fetch(`${BACKEND_URL}/api/admin/overview`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Admin-Key": token,
        },
      });

      if (res.status === 401) {
        setAuthError("Incorrect Admin Passcode. Please try again.");
        setIsLoading(false);
        return;
      }

      const data = await res.json();
      if (data.success) {
        setAdminKey(token);
        setIsAuthenticated(true);
        sessionStorage.setItem("omeglo_admin_token", token);
        setOverview(data.overview);
        showToast("Authenticated successfully. Welcome Admin!");
      }
    } catch (err) {
      setAuthError("Could not reach backend. Check connection or URL.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAdminKey("");
    sessionStorage.removeItem("omeglo_admin_token");
    setPinInput("");
  };

  // Actions
  const handleReleaseUser = async (params: {
    identifier?: string;
    reportId?: string;
    deviceId?: string;
    ip?: string;
  }) => {
    const targetLabel = params.identifier || params.deviceId || params.ip || params.reportId;
    if (!confirm(`Release ${targetLabel} back to Clean Matchmaking Pool?`)) return;

    try {
      const data = await apiFetch("/api/admin/unban", {
        method: "POST",
        body: JSON.stringify(params),
      });
      if (data.success) {
        showToast(data.message || "User released to Clean Pool.");
        // Optimistically update local reports & quarantine
        if (params.reportId) {
          setReports((prev) =>
            prev.map((r) => (r.id === params.reportId ? { ...r, status: "resolved" } : r))
          );
        }
        loadData();
        setSelectedReport(null);
      }
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleDismissReport = async (reportId: string, identifier?: string) => {
    try {
      const data = await apiFetch("/api/admin/dismiss-report", {
        method: "POST",
        body: JSON.stringify({ reportId, releaseUser: true, identifier }),
      });
      if (data.success) {
        showToast("Report dismissed successfully.");
        setReports((prev) =>
          prev.map((r) => (r.id === reportId ? { ...r, status: "dismissed" } : r))
        );
        loadData();
        setSelectedReport(null);
      }
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm("Permanently delete this report from database?")) return;
    try {
      const data = await apiFetch("/api/admin/delete-report", {
        method: "POST",
        body: JSON.stringify({ reportId }),
      });
      if (data.success) {
        showToast("Report permanently deleted.");
        setReports((prev) => prev.filter((r) => r.id !== reportId));
        loadData();
        setSelectedReport(null);
      }
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleAddBan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banIdentifier.trim()) return;
    try {
      const data = await apiFetch("/api/admin/ban", {
        method: "POST",
        body: JSON.stringify({
          identifier: banIdentifier.trim(),
          identifierType: banType,
          reason: banReason.trim(),
          durationHours: banDuration ? Number(banDuration) : null,
        }),
      });
      if (data.success) {
        showToast(data.message || "User hard banned successfully.");
        setShowBanModal(false);
        setBanIdentifier("");
        loadData();
      }
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleTriggerCleanup = async (days: number = 90) => {
    if (!confirm(`Run cleanup for records older than ${days} days?`)) return;
    setIsLoading(true);
    try {
      const data = await apiFetch("/api/admin/cleanup", {
        method: "POST",
        body: JSON.stringify({ days }),
      });
      if (data.success) {
        showToast(data.message);
        loadData();
      }
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered reports
  const filteredReports = reports.filter((r) => {
    const matchesReason = reasonFilter === "all" || r.reason === reasonFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && (r.status === "quarantined" || !r.status)) ||
      (statusFilter === "dismissed" && r.status === "dismissed") ||
      (statusFilter === "resolved" && r.status === "resolved");

    const matchesSearch =
      !searchQuery ||
      r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.ip_address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.reported_device_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.details?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesReason && matchesStatus && matchesSearch;
  });

  // =========================================================================
  // 1. PIN Authentication Gate UI (If not authenticated)
  // =========================================================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-white/[0.02] rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-sm bg-zinc-900/90 border border-zinc-800 backdrop-blur-xl rounded-3xl p-7 shadow-2xl relative z-10 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-white mb-4 shadow-inner">
            <Lock className="w-6 h-6 stroke-[2]" />
          </div>

          <h1 className="text-xl font-bold tracking-tight text-white mb-1">
            Omeglo Moderation Portal
          </h1>
          <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
            Enter master passcode to manage reports, toxic shadow pool, and bans.
          </p>

          <form onSubmit={handleLogin} className="w-full space-y-3">
            <div>
              <input
                type="password"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Enter Admin Passcode..."
                autoFocus
                className="w-full h-11 px-4 rounded-xl bg-zinc-950 border border-zinc-700/80 text-white text-sm text-center tracking-widest placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-all font-mono"
              />
            </div>

            {authError && (
              <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2 justify-center">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !pinInput.trim()}
              className="w-full h-11 rounded-xl bg-white hover:bg-zinc-200 active:scale-[0.98] text-zinc-950 text-xs font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
              <span>Unlock Dashboard</span>
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-zinc-800/80 w-full flex items-center justify-between text-[11px] text-zinc-500">
            <Link href="/" className="hover:text-zinc-300 transition-colors flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Back to Omeglo
            </Link>
            <span className="font-mono">v1.0 D1 Edge</span>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. Main Admin Dashboard Portal UI
  // =========================================================================
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* FLOATING TOAST NOTIFICATION */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-full border shadow-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-3 ${
            toastMessage.type === "error"
              ? "bg-red-950 text-red-200 border-red-500/40"
              : "bg-zinc-900 text-emerald-300 border-emerald-500/40"
          }`}
        >
          {toastMessage.type === "error" ? (
            <XCircle className="w-4 h-4 text-red-400" />
          ) : (
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* TOP HEADER */}
      <header className="h-16 border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-zinc-950 font-black text-sm shadow-xs">
              Ω
            </div>
            <span className="font-extrabold tracking-tight text-white text-base">Omeglo</span>
          </Link>
          <span className="px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
            Admin Console
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Cloudflare D1 Live</span>
          </div>

          <button
            onClick={loadData}
            title="Refresh Data"
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleLogout}
            className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-red-400 text-xs font-medium transition-colors cursor-pointer"
          >
            Logout
          </button>
        </div>
      </header>

      {/* SUB HEADER NAVIGATION TABS */}
      <div className="border-b border-zinc-800/80 bg-zinc-950 px-4 sm:px-8">
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-2.5 scrollbar-none">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "overview"
                ? "bg-white text-zinc-950 shadow-xs"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Live Overview</span>
          </button>

          <button
            onClick={() => setActiveTab("reports")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 relative ${
              activeTab === "reports"
                ? "bg-white text-zinc-950 shadow-xs"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Reports Feed</span>
            {overview && overview.todayReports > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500 absolute top-1 right-1" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("quarantine")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "quarantine"
                ? "bg-white text-zinc-950 shadow-xs"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Toxic Quarantine Pool</span>
          </button>

          <button
            onClick={() => setActiveTab("bans")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "bans"
                ? "bg-white text-zinc-950 shadow-xs"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            <Ban className="w-3.5 h-3.5" />
            <span>Permanent Bans</span>
          </button>

          <button
            onClick={() => setActiveTab("maintenance")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "maintenance"
                ? "bg-white text-zinc-950 shadow-xs"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Database Tools</span>
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
        {/* =========================================================================
            TAB 1: LIVE OVERVIEW
            ========================================================================= */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Top Stat Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between text-zinc-400 mb-2">
                  <span className="text-xs font-medium uppercase tracking-wider">Total Reports</span>
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                  {overview?.totalReports ?? 0}
                </div>
                <div className="text-[11px] text-zinc-500 mt-1">Recorded in Cloudflare D1</div>
              </div>

              <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between text-zinc-400 mb-2">
                  <span className="text-xs font-medium uppercase tracking-wider">In Quarantine</span>
                  <Clock className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-purple-300 font-mono">
                  {overview?.activeQuarantined ?? 0}
                </div>
                <div className="text-[11px] text-zinc-500 mt-1">Toxic shadow pool users</div>
              </div>

              <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between text-zinc-400 mb-2">
                  <span className="text-xs font-medium uppercase tracking-wider">Hard Banned</span>
                  <Ban className="w-4 h-4 text-red-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-red-400 font-mono">
                  {overview?.totalBanned ?? 0}
                </div>
                <div className="text-[11px] text-zinc-500 mt-1">IP & Device UUID blocks</div>
              </div>

              <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between text-zinc-400 mb-2">
                  <span className="text-xs font-medium uppercase tracking-wider">Today&apos;s Reports</span>
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-300 font-mono">
                  {overview?.todayReports ?? 0}
                </div>
                <div className="text-[11px] text-zinc-500 mt-1">Last 24 hours</div>
              </div>
            </div>

            {/* Live Matchmaking Cluster Status */}
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span>Live Edge Matchmaking Queues</span>
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-zinc-950/80 border border-zinc-800/60 rounded-xl p-3.5">
                  <span className="text-[11px] text-zinc-500 block mb-1">Live Sockets</span>
                  <span className="text-xl font-bold text-white font-mono">{overview?.liveSockets ?? 0}</span>
                </div>
                <div className="bg-zinc-950/80 border border-zinc-800/60 rounded-xl p-3.5">
                  <span className="text-[11px] text-zinc-500 block mb-1">Active Calls</span>
                  <span className="text-xl font-bold text-emerald-400 font-mono">{overview?.activeMatches ?? 0}</span>
                </div>
                <div className="bg-zinc-950/80 border border-zinc-800/60 rounded-xl p-3.5">
                  <span className="text-[11px] text-zinc-500 block mb-1">Clean Video Queue</span>
                  <span className="text-xl font-bold text-zinc-300 font-mono">{overview?.cleanVideoQueue ?? 0}</span>
                </div>
                <div className="bg-zinc-950/80 border border-zinc-800/60 rounded-xl p-3.5">
                  <span className="text-[11px] text-zinc-500 block mb-1">Quarantined Video Queue</span>
                  <span className="text-xl font-bold text-purple-400 font-mono">{overview?.quarantinedVideoQueue ?? 0}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: REPORTS FEED
            ========================================================================= */}
        {activeTab === "reports" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Search & Filter Bar */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-3 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-3">
              <div className="relative w-full lg:w-72">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search IP, Device, Details..."
                  className="w-full h-9 pl-9 pr-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                {/* Status Filter */}
                <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl p-0.5 text-xs">
                  {[
                    { id: "all", label: "All Status" },
                    { id: "active", label: "Quarantined" },
                    { id: "dismissed", label: "Dismissed" },
                    { id: "resolved", label: "Resolved" },
                  ].map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setStatusFilter(s.id)}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer text-[11px] ${
                        statusFilter === s.id
                          ? "bg-zinc-800 text-white font-bold"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* Reason Filter */}
                <div className="flex items-center gap-1 overflow-x-auto">
                  {["all", "nudity", "harassment", "spam", "underage"].map((r) => (
                    <button
                      key={r}
                      onClick={() => setReasonFilter(r)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium capitalize transition-colors cursor-pointer whitespace-nowrap ${
                        reasonFilter === r
                          ? "bg-zinc-800 text-white border border-zinc-700 font-bold"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Reports Table */}
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950/80 border-b border-zinc-800/80 text-zinc-400 font-medium uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Reason</th>
                      <th className="p-3.5">Reported Identifier</th>
                      <th className="p-3.5">Details</th>
                      <th className="p-3.5">Timestamp</th>
                      <th className="p-3.5 text-right">Moderation Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
                    {filteredReports.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-zinc-500">
                          No reports found matching your filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredReports.map((report) => {
                        const isDismissed = report.status === "dismissed";
                        const isResolved = report.status === "resolved";
                        const isQuarantined = !isDismissed && !isResolved;

                        return (
                          <tr key={report.id} className="hover:bg-zinc-800/30 transition-colors">
                            {/* Status Badge */}
                            <td className="p-3.5 whitespace-nowrap">
                              {isDismissed ? (
                                <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-semibold border border-zinc-700">
                                  Dismissed
                                </span>
                              ) : isResolved ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 text-[10px] font-semibold border border-emerald-800/60 flex items-center gap-1 w-fit">
                                  <Check className="w-2.5 h-2.5" /> Resolved
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 text-[10px] font-semibold border border-purple-800/60 flex items-center gap-1 w-fit">
                                  <Clock className="w-2.5 h-2.5" /> Quarantined
                                </span>
                              )}
                            </td>

                            {/* Reason */}
                            <td className="p-3.5 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wider ${
                                  report.reason === "nudity"
                                    ? "bg-red-950/80 text-red-300 border border-red-800/50"
                                    : report.reason === "harassment"
                                    ? "bg-amber-950/80 text-amber-300 border border-amber-800/50"
                                    : "bg-zinc-800 text-zinc-300"
                                }`}
                              >
                                {report.reason}
                              </span>
                            </td>

                            {/* Identifier */}
                            <td className="p-3.5 font-mono text-zinc-300 text-[11px]">
                              <div>IP: {report.ip_address || "unknown"}</div>
                              <div className="text-zinc-500 text-[10px]">
                                Dev: {report.reported_device_id ? `${report.reported_device_id.slice(0, 14)}...` : "unknown"}
                              </div>
                            </td>

                            {/* Details */}
                            <td className="p-3.5 text-zinc-400 max-w-xs truncate">
                              {report.details || "No custom note"}
                            </td>

                            {/* Timestamp */}
                            <td className="p-3.5 text-zinc-500 text-[11px] whitespace-nowrap">
                              {new Date(report.created_at).toLocaleString()}
                            </td>

                            {/* Action Buttons */}
                            <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                              {/* Release / Unban Button */}
                              <button
                                onClick={() =>
                                  handleReleaseUser({
                                    reportId: report.id,
                                    deviceId: report.reported_device_id,
                                    ip: report.ip_address,
                                  })
                                }
                                title="Release user from quarantine & resolve report"
                                className="px-2.5 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 text-[11px] font-semibold border border-emerald-800/40 transition-colors cursor-pointer"
                              >
                                Release
                              </button>

                              {/* Dismiss Button */}
                              {!isDismissed && (
                                <button
                                  onClick={() =>
                                    handleDismissReport(
                                      report.id,
                                      report.reported_device_id || report.ip_address
                                    )
                                  }
                                  title="Dismiss false report"
                                  className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium border border-zinc-700 transition-colors cursor-pointer"
                                >
                                  Dismiss
                                </button>
                              )}

                              {/* Inspect Button */}
                              <button
                                onClick={() => setSelectedReport(report)}
                                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[11px] font-medium border border-zinc-800 transition-colors cursor-pointer"
                              >
                                Inspect
                              </button>

                              {/* Delete Button */}
                              <button
                                onClick={() => handleDeleteReport(report.id)}
                                title="Delete report permanently"
                                className="p-1 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/40 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: TOXIC QUARANTINE POOL
            ========================================================================= */}
        {activeTab === "quarantine" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">Quarantined Users Pool</h2>
                <p className="text-xs text-zinc-400">
                  These users are restricted to matching only with other toxic users until their duration expires.
                </p>
              </div>
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950/80 border-b border-zinc-800/80 text-zinc-400 font-medium uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5">Identifier</th>
                    <th className="p-3.5">Type</th>
                    <th className="p-3.5">Report Count</th>
                    <th className="p-3.5">Quarantined Until</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
                  {quarantineList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-zinc-500">
                        No active users currently quarantined in the toxic pool.
                      </td>
                    </tr>
                  ) : (
                    quarantineList.map((item) => (
                      <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="p-3.5 font-mono text-zinc-200 font-medium">{item.identifier}</td>
                        <td className="p-3.5 uppercase text-[10px] text-zinc-400">{item.identifier_type}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800/60 font-mono text-[10px]">
                            {item.report_count}x violations
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-amber-400 text-[11px]">
                          {new Date(item.quarantined_until).toLocaleString()}
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => handleReleaseUser({ identifier: item.identifier })}
                            className="px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 text-xs font-semibold border border-emerald-800/60 transition-colors cursor-pointer"
                          >
                            Release to Clean Pool
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: PERMANENT HARD BANS
            ========================================================================= */}
        {activeTab === "bans" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">Permanent Hard Bans</h2>
                <p className="text-xs text-zinc-400">
                  Blocked identifiers are immediately rejected during matchmaking queue admission.
                </p>
              </div>
              <button
                onClick={() => setShowBanModal(true)}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-md"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Add Hard Ban</span>
              </button>
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950/80 border-b border-zinc-800/80 text-zinc-400 font-medium uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5">Identifier</th>
                    <th className="p-3.5">Type</th>
                    <th className="p-3.5">Reason</th>
                    <th className="p-3.5">Banned At</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
                  {bansList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-zinc-500">
                        No permanent hard bans recorded.
                      </td>
                    </tr>
                  ) : (
                    bansList.map((ban) => (
                      <tr key={ban.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="p-3.5 font-mono text-red-300 font-medium">{ban.identifier}</td>
                        <td className="p-3.5 uppercase text-[10px] text-zinc-400">{ban.identifier_type}</td>
                        <td className="p-3.5 text-zinc-300">{ban.reason}</td>
                        <td className="p-3.5 text-zinc-500 text-[11px]">
                          {new Date(ban.banned_at).toLocaleString()}
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => handleReleaseUser({ identifier: ban.identifier })}
                            className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Remove Ban
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 5: DATABASE MAINTENANCE TOOLS
            ========================================================================= */}
        {activeTab === "maintenance" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 space-y-6">
              <div>
                <h2 className="text-base font-bold text-white mb-1">Cloudflare D1 Maintenance</h2>
                <p className="text-xs text-zinc-400">
                  Run manual cleanup cycles to purge 3-month-old guest records and maintain database speed.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Manual 90-Day Auto Cleanup</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Deletes reports older than 90 days and clears non-active reputation records.
                  </p>
                </div>
                <button
                  onClick={() => handleTriggerCleanup(90)}
                  disabled={isLoading}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-xs disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Execute Cleanup (90 Days)</span>
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Aggressive 30-Day Purge</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Free up D1 storage by purging records older than 30 days.
                  </p>
                </div>
                <button
                  onClick={() => handleTriggerCleanup(30)}
                  disabled={isLoading}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-xs disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Execute Purge (30 Days)</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* =========================================================================
          REPORT INSPECT MODAL
          ========================================================================= */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 relative">
            <button
              onClick={() => setSelectedReport(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <span className="px-2.5 py-1 rounded-md bg-red-950 text-red-300 border border-red-800/60 font-bold uppercase text-[10px]">
                {selectedReport.reason} Report
              </span>
              <h2 className="text-base font-bold text-white mt-2">
                Report ID: <span className="font-mono text-zinc-300">{selectedReport.id}</span>
              </h2>
            </div>

            <div className="bg-zinc-950 rounded-2xl p-4 border border-zinc-800/80 space-y-2.5 text-xs text-zinc-300">
              <div className="flex justify-between pb-1.5 border-b border-zinc-800/60">
                <span className="text-zinc-500">Status:</span>
                <span className="font-mono text-white uppercase">{selectedReport.status || "quarantined"}</span>
              </div>
              <div className="flex justify-between pb-1.5 border-b border-zinc-800/60">
                <span className="text-zinc-500">IP Address:</span>
                <span className="font-mono text-white">{selectedReport.ip_address}</span>
              </div>
              <div className="flex justify-between pb-1.5 border-b border-zinc-800/60">
                <span className="text-zinc-500">Device UUID:</span>
                <span className="font-mono text-white">{selectedReport.reported_device_id}</span>
              </div>
              <div className="flex justify-between pb-1.5 border-b border-zinc-800/60">
                <span className="text-zinc-500">Platform & Screen:</span>
                <span className="font-mono text-white">
                  {selectedReport.reported_platform} ({selectedReport.reported_screen})
                </span>
              </div>
              <div className="flex justify-between pb-1.5 border-b border-zinc-800/60">
                <span className="text-zinc-500">GPU Renderer:</span>
                <span className="font-mono text-white truncate max-w-xs">{selectedReport.reported_gpu}</span>
              </div>
              <div className="flex justify-between pb-1.5 border-b border-zinc-800/60">
                <span className="text-zinc-500">Timezone / Language:</span>
                <span className="font-mono text-white">
                  {selectedReport.reported_timezone} ({selectedReport.reported_language})
                </span>
              </div>
              <div className="pt-1">
                <span className="text-zinc-500 block mb-1">Details / Note:</span>
                <p className="text-zinc-200 bg-zinc-900/90 p-2.5 rounded-xl border border-zinc-800">
                  {selectedReport.details || "No custom note provided."}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2.5 pt-2">
              <button
                onClick={() => handleDeleteReport(selectedReport.id)}
                className="px-3.5 py-2 rounded-xl bg-red-950/60 hover:bg-red-900/80 text-red-300 text-xs font-semibold border border-red-800/40 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    handleDismissReport(
                      selectedReport.id,
                      selectedReport.reported_device_id || selectedReport.ip_address
                    )
                  }
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Dismiss Report
                </button>
                <button
                  onClick={() =>
                    handleReleaseUser({
                      reportId: selectedReport.id,
                      deviceId: selectedReport.reported_device_id,
                      ip: selectedReport.ip_address,
                    })
                  }
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Release to Clean Pool
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          ADD MANUAL HARD BAN MODAL
          ========================================================================= */}
      {showBanModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 relative">
            <button
              onClick={() => setShowBanModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Ban className="w-4 h-4 text-red-500" />
              <span>Add Hard Ban</span>
            </h2>

            <form onSubmit={handleAddBan} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                  Identifier (IP Address or Device UUID):
                </label>
                <input
                  type="text"
                  value={banIdentifier}
                  onChange={(e) => setBanIdentifier(e.target.value)}
                  placeholder="e.g. 123.45.67.89 or device_uuid..."
                  required
                  className="w-full h-10 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-zinc-400 block mb-1">Identifier Type:</label>
                <select
                  value={banType}
                  onChange={(e) => setBanType(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-zinc-600"
                >
                  <option value="device_id">Device UUID (Hardware)</option>
                  <option value="ip">IP Address</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-zinc-400 block mb-1">Ban Reason:</label>
                <input
                  type="text"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Reason for ban..."
                  required
                  className="w-full h-10 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                  Duration in Hours (Leave empty for Permanent):
                </label>
                <input
                  type="number"
                  value={banDuration}
                  onChange={(e) => setBanDuration(e.target.value)}
                  placeholder="e.g. 24, 72 (Empty = Permanent)"
                  className="w-full h-10 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBanModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Apply Ban
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
