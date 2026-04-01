"use client";

import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { loginRequest, graphScopes } from "@/lib/msal-config";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAllRecentEmails, getSentEmails, getUserProfile } from "@/lib/graph-service";
import { analyzeEmails, enrichWithLLMResults } from "@/lib/email-analyzer";
import { DashboardStats, UserProfile, Email } from "@/lib/types";
import { loadSettings } from "@/lib/prompt-settings";
import DashboardHeader from "./DashboardHeader";
import DateRangePicker, { DateRange, getDefaultRange } from "./DateRangePicker";
import StatsOverview from "./StatsOverview";
import UnreadSection from "./UnreadSection";
import UnrepliedSection from "./UnrepliedSection";
import BuyingSignalsSection from "./BuyingSignalsSection";
import ClientTrackerTable from "./ClientTrackerTable";
import TrendChart from "./TrendChart";
import TopSendersTable from "./TopSendersTable";
import ExecutiveSummary from "./ExecutiveSummary";
import { LogIn, RefreshCw, Shield } from "lucide-react";

export default function Dashboard() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultRange);
  const dateRangeRef = useRef(dateRange);

  const getAccessToken = useCallback(async (): Promise<string> => {
    const account = accounts[0];
    if (!account) throw new Error("No account found");

    const response = await instance.acquireTokenSilent({
      ...graphScopes,
      account,
    });
    return response.accessToken;
  }, [instance, accounts]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const range = dateRangeRef.current;
      const token = await getAccessToken();
      const [userProfile, allEmails, sentEmails] = await Promise.all([
        getUserProfile(token),
        getAllRecentEmails(token, range.start, range.end),
        getSentEmails(token, range.start, range.end),
      ]);

      setProfile(userProfile);

      // Phase 1: Instant keyword-based analysis
      const promptSettings = loadSettings();
      const dashboardStats = analyzeEmails(
        allEmails,
        sentEmails,
        { start: range.start, end: range.end },
        promptSettings
      );
      setStats(dashboardStats);
      setLastRefresh(new Date());
      setLoading(false);

      // Phase 2: Enrich with Claude AI in background
      setAiLoading(true);
      try {
        const emailsForLLM = allEmails.slice(0, 200).map((e) => ({
          id: e.id,
          subject: e.subject,
          from: e.from.emailAddress.name,
          fromEmail: e.from.emailAddress.address,
          bodyPreview: e.bodyPreview,
          receivedDateTime: e.receivedDateTime,
          importance: e.importance,
          hasAttachments: e.hasAttachments,
        }));

        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emails: emailsForLLM, promptSettings }),
        });

        if (res.ok) {
          const llmResult = await res.json();
          const enrichedStats = enrichWithLLMResults(
            dashboardStats,
            allEmails,
            llmResult
          );
          setStats(enrichedStats);
        }
      } catch (aiErr) {
        console.warn("AI enrichment failed, using keyword analysis:", aiErr);
      } finally {
        setAiLoading(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch emails";
      setError(message);
      console.error("Failed to fetch email data:", err);
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated, fetchData]);

  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range);
    dateRangeRef.current = range;
    if (isAuthenticated) {
      fetchData();
    }
  };

  const handleLogin = () => {
    instance.loginRedirect(loginRequest).catch((err) => {
      console.error("Login failed:", err);
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="max-w-md w-full mx-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Shield className="w-8 h-8 text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Executive Email Intelligence
            </h1>
            <p className="text-slate-400 mb-8">
              Sign in with your Microsoft account to access your email dashboard
              and analytics.
            </p>
            <button
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              <LogIn className="w-5 h-5" />
              Sign in with Microsoft
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading && !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Analyzing your emails...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="max-w-md w-full mx-4 bg-slate-900 border border-red-800 rounded-2xl p-8 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="bg-blue-600 hover:bg-blue-500 text-white py-2 px-6 rounded-xl transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <DashboardHeader
        profile={profile}
        lastRefresh={lastRefresh}
        onRefresh={fetchData}
        loading={loading}
        aiLoading={aiLoading}
        dateRangePicker={
          <DateRangePicker
            value={dateRange}
            onChange={handleDateRangeChange}
          />
        }
      />

      <main className="max-w-[1600px] mx-auto px-6 pb-12">
        <ExecutiveSummary
          summary={stats.executiveSummary}
          isEnriched={stats.llmEnriched}
          aiLoading={aiLoading}
        />

        <StatsOverview stats={stats} />

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          <TrendChart data={stats.unreadTrend} rangeLabel={dateRange.label} />
          <TopSendersTable senders={stats.topSenders} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          <UnreadSection
            categories={stats.unreadByCategory}
            distribution={stats.importanceDistribution}
          />
          <UnrepliedSection categories={stats.unrepliedByCategory} />
        </div>

        <div className="mb-6">
          <ClientTrackerTable threads={stats.clientThreads} />
        </div>

        <BuyingSignalsSection emails={stats.buyingSignalEmails} />
      </main>
    </div>
  );
}
