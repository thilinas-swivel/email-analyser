"use client";

import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { loginRequest, graphScopes } from "@/lib/msal-config";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAllRecentEmails, getSentEmails, getUserProfile } from "@/lib/graph-service";
import { analyzeEmails, enrichWithLLMResults } from "@/lib/email-analyzer";
import { DashboardStats, UserProfile, Email } from "@/lib/types";
import { loadSettings, loadSettingsAsync } from "@/lib/prompt-settings";
import { useTeamsContext } from "@/components/providers/MsalProvider";
import { getTeamsSsoToken } from "@/lib/teams-context";
import DashboardHeader from "./DashboardHeader";
import DateRangePicker, { DateRange, getCurrentWeekRange, getRangeFromStartDate } from "./DateRangePicker";
import StatsOverview from "./StatsOverview";
import UnreadSection from "./UnreadSection";
import UnrepliedSection from "./UnrepliedSection";
import BuyingSignalsSection from "./BuyingSignalsSection";
import ClientTrackerTable from "./ClientTrackerTable";
import InternalEmailsTracker from "./InternalEmailsTracker";
import TrendChart from "./TrendChart";
import TopSendersTable from "./TopSendersTable";
import ExecutiveSummary from "./ExecutiveSummary";
import { LogIn, RefreshCw } from "lucide-react";
import Image from "next/image";

const DASHBOARD_SNAPSHOT_VERSION = 2;
const SNAPSHOT_EMAILS_PER_CATEGORY = 12;
const SNAPSHOT_THREADS_LIMIT = 60;
const SNAPSHOT_THREAD_EMAILS_LIMIT = 3;
const SNAPSHOT_BUYING_SIGNALS_LIMIT = 40;

interface DashboardSnapshot {
  version: number;
  stats: DashboardStats;
  profile: UserProfile | null;
  lastRefresh: string;
  trackInternalEmails: boolean;
}

function stripProfileForSnapshot(profile: UserProfile | null): UserProfile | null {
  if (!profile) return null;
  return {
    ...profile,
    photo: undefined,
  };
}

function getSnapshotKey(userKey: string, range: DateRange): string {
  const start = range.start.toISOString().slice(0, 10);
  const end = range.end.toISOString().slice(0, 10);
  return `mailsense-dashboard-snapshot:${userKey}:${start}:${end}`;
}

function loadDashboardSnapshot(
  userKey: string,
  range: DateRange
): DashboardSnapshot | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(getSnapshotKey(userKey, range));
    if (!stored) return null;
    const snapshot = JSON.parse(stored) as DashboardSnapshot;
    if (snapshot.version !== DASHBOARD_SNAPSHOT_VERSION) return null;
    return snapshot;
  } catch {
    return null;
  }
}

function saveDashboardSnapshot(
  userKey: string,
  range: DateRange,
  snapshot: DashboardSnapshot
): void {
  if (typeof window === "undefined") return;

  const key = getSnapshotKey(userKey, range);
  const payload = JSON.stringify(snapshot);

  try {
    localStorage.setItem(key, payload);
  } catch (error) {
    // Best-effort eviction of older dashboard snapshots before retrying once.
    try {
      const snapshotKeys: string[] = [];
      for (let index = 0; index < localStorage.length; index++) {
        const existingKey = localStorage.key(index);
        if (existingKey?.startsWith("mailsense-dashboard-snapshot:")) {
          snapshotKeys.push(existingKey);
        }
      }

      snapshotKeys
        .filter((existingKey) => existingKey !== key)
        .forEach((existingKey) => localStorage.removeItem(existingKey));

      localStorage.setItem(key, payload);
    } catch {
      console.warn("Dashboard snapshot storage skipped because browser storage quota was exceeded.", error);
    }
  }
}

function stripEmailForSnapshot(email: Email): Email {
  return {
    id: email.id,
    subject: email.subject,
    from: email.from,
    toRecipients: email.toRecipients,
    ccRecipients: email.ccRecipients,
    receivedDateTime: email.receivedDateTime,
    bodyPreview: email.bodyPreview,
    isRead: email.isRead,
    importance: email.importance,
    categories: email.categories,
    hasAttachments: email.hasAttachments,
    conversationId: email.conversationId,
    flag: email.flag,
  };
}

function createSnapshotStats(stats: DashboardStats): DashboardStats {
  return {
    ...stats,
    unreadByCategory: stats.unreadByCategory.map((category) => ({
      ...category,
      emails: category.emails
        .slice(0, SNAPSHOT_EMAILS_PER_CATEGORY)
        .map(stripEmailForSnapshot),
    })),
    unrepliedByCategory: stats.unrepliedByCategory.map((category) => ({
      ...category,
      emails: category.emails
        .slice(0, SNAPSHOT_EMAILS_PER_CATEGORY)
        .map(stripEmailForSnapshot),
    })),
    unreadByCategoryByScope: {
      internal: stats.unreadByCategoryByScope.internal.map((category) => ({
        ...category,
        emails: category.emails
          .slice(0, SNAPSHOT_EMAILS_PER_CATEGORY)
          .map(stripEmailForSnapshot),
      })),
      external: stats.unreadByCategoryByScope.external.map((category) => ({
        ...category,
        emails: category.emails
          .slice(0, SNAPSHOT_EMAILS_PER_CATEGORY)
          .map(stripEmailForSnapshot),
      })),
    },
    unrepliedByCategoryByScope: {
      internal: stats.unrepliedByCategoryByScope.internal.map((category) => ({
        ...category,
        emails: category.emails
          .slice(0, SNAPSHOT_EMAILS_PER_CATEGORY)
          .map(stripEmailForSnapshot),
      })),
      external: stats.unrepliedByCategoryByScope.external.map((category) => ({
        ...category,
        emails: category.emails
          .slice(0, SNAPSHOT_EMAILS_PER_CATEGORY)
          .map(stripEmailForSnapshot),
      })),
    },
    buyingSignalEmails: stats.buyingSignalEmails
      .slice(0, SNAPSHOT_BUYING_SIGNALS_LIMIT)
      .map((email) => ({
        ...stripEmailForSnapshot(email),
        signalScore: email.signalScore,
        signals: email.signals,
        senderCompany: email.senderCompany,
        buyingStage: email.buyingStage,
        buyingIntent: email.buyingIntent,
        llmSummary: email.llmSummary,
        actionRequired: email.actionRequired,
      })),
    clientThreads: stats.clientThreads.slice(0, SNAPSHOT_THREADS_LIMIT).map((thread) => ({
      ...thread,
      emails: thread.emails
        .slice(0, SNAPSHOT_THREAD_EMAILS_LIMIT)
        .map((e) => ({ ...e, body: undefined })),
    })),
    internalThreads: stats.internalThreads.slice(0, SNAPSHOT_THREADS_LIMIT).map((thread) => ({
      ...thread,
      emails: thread.emails
        .slice(0, SNAPSHOT_THREAD_EMAILS_LIMIT)
        .map((e) => ({ ...e, body: undefined })),
    })),
  };
}

function extractPlainTextEmailBody(email: Email): string {
  const rawContent = email.body?.content?.trim();
  if (!rawContent) {
    return email.bodyPreview || "";
  }

  if (email.body?.contentType?.toLowerCase() === "html") {
    if (typeof window !== "undefined") {
      const doc = new DOMParser().parseFromString(rawContent, "text/html");
      return doc.body.textContent?.replace(/\s+/g, " ").trim() || email.bodyPreview || "";
    }

    return rawContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  return rawContent.replace(/\s+/g, " ").trim();
}

export default function Dashboard() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const { inTeams } = useTeamsContext();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(getCurrentWeekRange);
  const dateRangeRef = useRef(dateRange);
  const [minDate, setMinDate] = useState<Date | undefined>(undefined);
  const [teamsReady, setTeamsReady] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [newEmailsAnalyzed, setNewEmailsAnalyzed] = useState(0);
  const [trackInternalEmails, setTrackInternalEmails] = useState(true);
  const [showingSnapshot, setShowingSnapshot] = useState(false);
  const snapshotHydratedRef = useRef(false);
  const statsRef = useRef<DashboardStats | null>(null);

  // In Teams, auto-authenticate via SSO
  useEffect(() => {
    if (inTeams) {
      setTeamsReady(true);
    }
  }, [inTeams]);

  useEffect(() => {
    const settings = loadSettings();
    // Derive the earliest allowed date from settings (used to clamp the picker)
    const configuredRange = getRangeFromStartDate(settings.defaultAnalysisStartDate);
    setMinDate(configuredRange.start);
  }, []);

  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  const getAccessToken = useCallback(async (): Promise<string> => {
    if (inTeams) {
      // Teams SSO: get ID token, exchange for Graph token via OBO
      const ssoToken = await getTeamsSsoToken();
      const res = await fetch("/api/auth/teams-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ssoToken }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to exchange Teams token");
      }
      const data = await res.json();
      return data.accessToken;
    }

    // Browser flow: MSAL silent token
    const account = accounts[0];
    if (!account) {
      // No account — redirect to login
      await instance.loginRedirect(loginRequest);
      throw new Error("Redirecting to login");
    }

    try {
      const response = await instance.acquireTokenSilent({
        ...graphScopes,
        account,
      });
      return response.accessToken;
    } catch (err) {
      // Any silent token failure (expired session, timed_out, consent
      // required, network error) — redirect to Microsoft login
      console.warn("Silent token acquisition failed, redirecting to login:", err);
      await instance.acquireTokenRedirect({ ...graphScopes, account });
      throw new Error("Redirecting to login");
    }
  }, [instance, accounts, inTeams]);

  const getSnapshotUserKey = useCallback((): string | null => {
    if (inTeams) {
      return "teams-user";
    }

    const account = accounts[0];
    if (!account) return null;
    return account.username.toLowerCase();
  }, [accounts, inTeams]);

  const hydrateFromSnapshot = useCallback((rangeOverride?: DateRange) => {
    const userKey = getSnapshotUserKey();
    if (!userKey) return false;

    const range = rangeOverride ?? dateRangeRef.current;
    const snapshot = loadDashboardSnapshot(userKey, range);
    if (!snapshot) return false;

    setStats(snapshot.stats);
    setProfile(snapshot.profile);
    setLastRefresh(new Date(snapshot.lastRefresh));
    setTrackInternalEmails(snapshot.trackInternalEmails);
    setShowingSnapshot(true);
    return true;
  }, [getSnapshotUserKey]);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!statsRef.current) {
      setLoading(true);
    }
    setError(null);
    setFromCache(false);
    setNewEmailsAnalyzed(0);
    try {
      const range = dateRangeRef.current;
      const snapshotUserKey = getSnapshotUserKey();
      const token = await getAccessToken();
      const [userProfile, allEmails, sentEmails] = await Promise.all([
        getUserProfile(token),
        getAllRecentEmails(token, range.start, range.end),
        getSentEmails(token, range.start, range.end),
      ]);

      setProfile(userProfile);

      // Phase 1: Instant keyword-based analysis
      const promptSettings = await loadSettingsAsync(userProfile.mail);
      setTrackInternalEmails(promptSettings.trackInternalEmails !== false);
      // Update minDate from server-stored settings
      const configuredRange = getRangeFromStartDate(promptSettings.defaultAnalysisStartDate);
      setMinDate(configuredRange.start);
      const dashboardStats = analyzeEmails(
        allEmails,
        sentEmails,
        { start: range.start, end: range.end },
        promptSettings,
        userProfile.mail
      );
      setStats(dashboardStats);
      setLastRefresh(new Date());
      setLoading(false);
      setShowingSnapshot(false);

      if (snapshotUserKey) {
        saveDashboardSnapshot(snapshotUserKey, range, {
          version: DASHBOARD_SNAPSHOT_VERSION,
          stats: createSnapshotStats(dashboardStats),
          profile: stripProfileForSnapshot(userProfile),
          lastRefresh: new Date().toISOString(),
          trackInternalEmails: promptSettings.trackInternalEmails !== false,
        });
      }

      // Phase 2: Enrich with Claude AI in background
      setAiLoading(true);
      try {
        const userEmailLower = userProfile.mail.toLowerCase();

        // Build noise filter to exclude automated/service emails from Claude analysis
        const noiseEmailFilters = (promptSettings.noiseEmailFilters || []).map((f) => f.toLowerCase());
        const noiseNameFilters = (promptSettings.noiseNameFilters || []).map((f) => f.toLowerCase());
        const isNoiseEmail = (e: Email): boolean => {
          const addr = (e.from?.emailAddress?.address || "").toLowerCase();
          const name = (e.from?.emailAddress?.name || "").toLowerCase();
          if (noiseEmailFilters.some((f) => addr.includes(f))) return true;
          if (noiseNameFilters.some((f) => name.includes(f))) return true;
          return false;
        };

        // Filter out noise emails — they don't need Claude analysis
        const analyzableEmails = allEmails.filter((e) => !isNoiseEmail(e));

        // Collect every email ID that appears in a tracker thread so they
        // are guaranteed to be sent to Claude regardless of the overall cap.
        const trackerEmailIds = new Set<string>();
        for (const t of dashboardStats.clientThreads) {
          for (const e of t.emails) trackerEmailIds.add(e.id);
        }
        for (const t of dashboardStats.internalThreads) {
          for (const e of t.emails) trackerEmailIds.add(e.id);
        }

        // Build a prioritised list: tracker emails first, then other
        // unreplied emails, then replied emails.  Cap at 500.
        const sentConvoIds = new Set(sentEmails.map((e) => e.conversationId));
        const trackerEmails: Email[] = [];
        const otherUnreplied: Email[] = [];
        const replied: Email[] = [];
        for (const e of analyzableEmails) {
          if (trackerEmailIds.has(e.id)) {
            trackerEmails.push(e);
          } else if (!sentConvoIds.has(e.conversationId)) {
            otherUnreplied.push(e);
          } else {
            replied.push(e);
          }
        }
        const prioritizedEmails = [...trackerEmails, ...otherUnreplied, ...replied];
        const top500 = prioritizedEmails.slice(0, 500);

        // --- Phase 2a: Check cache (lightweight — IDs only) ---
        // Only check/analyze non-noise emails
        const allEmailIds = analyzableEmails.map((e) => e.id);

        console.log(`Emails: ${allEmails.length} total, ${analyzableEmails.length} after noise filter (${allEmails.length - analyzableEmails.length} noise excluded)`);

        const cacheRes = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cacheOnly: true,
            emailIds: allEmailIds,
            userEmail: userProfile.mail,
            startDate: range.start.toISOString(),
            endDate: range.end.toISOString(),
            ...(forceRefresh ? { forceRefresh: true } : {}),
          }),
        });
        if (!cacheRes.ok) throw new Error("Cache check failed");

        const cacheResult = await cacheRes.json();
        const uncachedIds = new Set<string>(cacheResult.uncachedIds || []);

        console.log(`Cache check: ${allEmailIds.length - uncachedIds.size} cached, ${uncachedIds.size} uncached`);

        // Enrich immediately with cached results
        if (cacheResult.analyses?.length > 0) {
          setFromCache(true);
          const cachedEnriched = enrichWithLLMResults(
            dashboardStats,
            allEmails,
            cacheResult,
            userProfile.mail,
            promptSettings
          );
          setStats(cachedEnriched);
          setShowingSnapshot(false);
        }

        // --- Phase 2b: Analyze only uncached emails (full bodies) ---
        const uncachedEmails = top500.filter((e) => uncachedIds.has(e.id));

        if (uncachedEmails.length > 0) {
          console.log(`Sending ${uncachedEmails.length} uncached emails for AI analysis`);

          const emailsForLLM = uncachedEmails.map((e) => {
            const senderAddress = e.from?.emailAddress?.address || "";
            const senderName = e.from?.emailAddress?.name || "Unknown Sender";
            const inTo = e.toRecipients?.some(
              (r) => r.emailAddress.address.toLowerCase() === userEmailLower
            );
            const inCc = e.ccRecipients?.some(
              (r) => r.emailAddress.address.toLowerCase() === userEmailLower
            );
            const recipientType: "to" | "cc" | "bcc" = inTo ? "to" : inCc ? "cc" : "bcc";
            const toRecipients = e.toRecipients?.map(
              (r) => r.emailAddress.name || r.emailAddress.address
            ) || [];

            return {
              id: e.id,
              subject: e.subject,
              from: senderName,
              fromEmail: senderAddress,
              bodyPreview: e.bodyPreview,
              bodyContent: extractPlainTextEmailBody(e),
              receivedDateTime: e.receivedDateTime,
              importance: e.importance,
              hasAttachments: e.hasAttachments,
              recipientType,
              toRecipients,
            };
          });

          const analyzeRes = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              emails: emailsForLLM,
              promptSettings,
              userEmail: userProfile.mail,
              userName: userProfile.displayName,
            }),
          });

          if (analyzeRes.ok) {
            const newResult = await analyzeRes.json();
            setNewEmailsAnalyzed(newResult.newEmailsAnalyzed || 0);

            // Merge cached + new analyses for final enrichment
            const mergedResult = {
              analyses: [...(cacheResult.analyses || []), ...(newResult.analyses || [])],
              executiveSummary: newResult.executiveSummary || cacheResult.executiveSummary || "",
              attentionItems: newResult.attentionItems,
            };

            const enrichedStats = enrichWithLLMResults(
              dashboardStats,
              allEmails,
              mergedResult,
              userProfile.mail,
              promptSettings
            );
            setStats(enrichedStats);
            setShowingSnapshot(false);

            if (snapshotUserKey) {
              saveDashboardSnapshot(snapshotUserKey, range, {
                version: DASHBOARD_SNAPSHOT_VERSION,
                stats: createSnapshotStats(enrichedStats),
                profile: stripProfileForSnapshot(userProfile),
                lastRefresh: new Date().toISOString(),
                trackInternalEmails: promptSettings.trackInternalEmails !== false,
              });
            }
          } else {
            const errorData = await analyzeRes.json().catch(() => ({}));
            console.error("AI analysis failed:", analyzeRes.status, errorData);
          }
        } else {
          // All cached — save snapshot with cached enrichment
          setNewEmailsAnalyzed(0);
          const currentStats = statsRef.current;
          if (snapshotUserKey && currentStats) {
            saveDashboardSnapshot(snapshotUserKey, range, {
              version: DASHBOARD_SNAPSHOT_VERSION,
              stats: createSnapshotStats(currentStats),
              profile: stripProfileForSnapshot(userProfile),
              lastRefresh: new Date().toISOString(),
              trackInternalEmails: promptSettings.trackInternalEmails !== false,
            });
          }
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
  }, [getAccessToken, getSnapshotUserKey]);

  const fetchingRef = useRef(false);
  const initialFetchDoneRef = useRef(false);

  useEffect(() => {
    if ((isAuthenticated || teamsReady) && !snapshotHydratedRef.current) {
      snapshotHydratedRef.current = hydrateFromSnapshot();
    }
  }, [isAuthenticated, teamsReady, hydrateFromSnapshot]);

  // Trigger initial fetch exactly once when authenticated
  useEffect(() => {
    if ((isAuthenticated || teamsReady) && !initialFetchDoneRef.current) {
      initialFetchDoneRef.current = true;
      fetchingRef.current = true;
      fetchData().finally(() => { fetchingRef.current = false; });
    }
  }, [isAuthenticated, teamsReady, fetchData]);

  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range);
    dateRangeRef.current = range;
    hydrateFromSnapshot(range);
    if ((isAuthenticated || teamsReady) && !fetchingRef.current) {
      fetchingRef.current = true;
      fetchData().finally(() => { fetchingRef.current = false; });
    }
  };

  const handleReanalyze = () => {
    if ((isAuthenticated || teamsReady) && !fetchingRef.current) {
      fetchingRef.current = true;
      fetchData(true).finally(() => { fetchingRef.current = false; });
    }
  };

  const handleLogin = () => {
    instance.loginRedirect(loginRequest).catch((err) => {
      console.error("Login failed:", err);
    });
  };

  if (!isAuthenticated && !inTeams) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="max-w-md w-full mx-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
            <div className="w-24 h-24 mx-auto mb-6">
              <Image
                src="/logo.png"
                alt="MailSense"
                width={96}
                height={96}
                className="rounded-2xl w-24 h-24 ring-1 ring-slate-700 shadow-xl shadow-indigo-500/20"
                priority
                unoptimized
              />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              MailSense
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
            onClick={() => fetchData()}
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
        onRefresh={() => fetchData()}
        loading={loading}
        aiLoading={aiLoading}
        dateRangePicker={
          <DateRangePicker
            value={dateRange}
            onChange={handleDateRangeChange}
            minDate={minDate}
          />
        }
      />

      <main className="max-w-400 mx-auto px-4 sm:px-6 pb-8 sm:pb-12">
        <ExecutiveSummary
          summary={stats.executiveSummary}
          attentionItems={stats.attentionItems}
          isEnriched={stats.llmEnriched}
          aiLoading={aiLoading}
          showingSnapshot={showingSnapshot}
          fromCache={fromCache}
          newEmailsAnalyzed={newEmailsAnalyzed}
          onReanalyze={handleReanalyze}
        />

        <StatsOverview stats={stats} />

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          <TrendChart
            data={stats.unreadTrend}
            scopedData={stats.unreadTrendByScope}
            rangeLabel={dateRange.label}
            showSplit={trackInternalEmails}
          />
          <TopSendersTable
            senders={stats.topSenders}
            scopedSenders={stats.topSendersByScope}
            showSplit={trackInternalEmails}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          <UnreadSection
            categories={stats.unreadByCategory}
            distribution={stats.importanceDistribution}
            scopedCategories={stats.unreadByCategoryByScope}
            showSplit={trackInternalEmails}
          />
          <UnrepliedSection
            categories={stats.unrepliedByCategory}
            scopedCategories={stats.unrepliedByCategoryByScope}
            showSplit={trackInternalEmails}
          />
        </div>

        <div className="mb-6">
          <ClientTrackerTable threads={stats.clientThreads} />
        </div>

        {trackInternalEmails && stats.internalThreads.length > 0 && (
          <div className="mb-6">
            <InternalEmailsTracker
              threads={stats.internalThreads}
              isEnriched={stats.llmEnriched}
              aiLoading={aiLoading}
            />
          </div>
        )}

        <BuyingSignalsSection emails={stats.buyingSignalEmails} />
      </main>
    </div>
  );
}
