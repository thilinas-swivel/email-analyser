import { differenceInDays, differenceInHours, format } from "date-fns";
import {
  Email,
  EmailCategory,
  UnrepliedEmail,
  BuyingSignalEmail,
  DashboardStats,
  ClientThread,
  PromptSettings,
} from "./types";
import type { LLMBatchResult, LLMEmailAnalysis } from "./claude-service";

const CATEGORY_COLORS: Record<string, string> = {
  "Finance & Billing": "#3b82f6",
  "Client Communication": "#10b981",
  "Internal / Team": "#8b5cf6",
  "Sales & Partnerships": "#f59e0b",
  "Legal & Compliance": "#ef4444",
  "Marketing": "#ec4899",
  "Product & Development": "#06b6d4",
  "HR & Recruitment": "#84cc16",
  "Operations": "#f97316",
  "Newsletters & Updates": "#6b7280",
  "Meeting & Calendar": "#a855f7",
  "Support & Issues": "#dc2626",
  "Uncategorized": "#94a3b8",
};

const BUYING_KEYWORDS = [
  "budget",
  "pricing",
  "proposal",
  "quote",
  "contract",
  "purchase",
  "buy",
  "invest",
  "roi",
  "timeline",
  "implementation",
  "onboard",
  "demo",
  "trial",
  "pilot",
  "decision",
  "stakeholder",
  "approval",
  "procurement",
  "vendor",
  "rfp",
  "rfi",
  "scope",
  "deliverable",
  "kickoff",
  "start date",
  "go-live",
  "sign off",
  "payment terms",
  "license",
  "subscription",
  "renewal",
  "upgrade",
  "expand",
  "scale",
  "next steps",
  "ready to move",
  "interested in",
  "looking for a solution",
  "evaluate",
  "shortlist",
];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Finance & Billing": [
    "invoice", "payment", "billing", "budget", "revenue", "expense",
    "financial", "quarterly", "annual report", "tax", "audit", "forecast",
  ],
  "Client Communication": [
    "client", "customer", "account", "relationship", "feedback",
    "satisfaction", "deliverable", "project update", "status update",
  ],
  "Internal / Team": [
    "team", "internal", "standup", "sync", "1:1", "check-in",
    "all-hands", "town hall", "company update", "announcement",
  ],
  "Sales & Partnerships": [
    "deal", "opportunity", "pipeline", "prospect", "lead",
    "partnership", "collaboration", "proposal", "pitch", "close",
  ],
  "Legal & Compliance": [
    "legal", "compliance", "regulation", "contract", "agreement",
    "nda", "terms", "policy", "gdpr", "privacy",
  ],
  "Marketing": [
    "campaign", "brand", "content", "social media", "analytics",
    "seo", "advertising", "press", "webinar", "event",
  ],
  "Product & Development": [
    "feature", "release", "sprint", "bug", "roadmap", "backlog",
    "deployment", "api", "integration", "code review",
  ],
  "HR & Recruitment": [
    "hiring", "candidate", "interview", "onboarding", "benefits",
    "performance review", "compensation", "talent", "resume",
  ],
  "Operations": [
    "operations", "logistics", "supply chain", "inventory",
    "process", "workflow", "efficiency", "infrastructure",
  ],
  "Meeting & Calendar": [
    "meeting", "calendar", "schedule", "invite", "agenda",
    "reschedule", "conference", "call", "zoom", "teams meeting",
  ],
  "Newsletters & Updates": [
    "newsletter", "digest", "weekly update", "unsubscribe",
    "subscribe", "notification", "alert",
  ],
  "Support & Issues": [
    "support", "ticket", "issue", "incident", "outage",
    "escalation", "critical", "urgent fix", "downtime",
  ],
};

function categorizeEmail(email: Email): string {
  if (email.categories && email.categories.length > 0) {
    return email.categories[0];
  }

  const text = `${email.subject} ${email.bodyPreview}`.toLowerCase();

  let bestCategory = "Uncategorized";
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
}

function computeBuyingSignals(email: Email): { score: number; signals: string[] } {
  const text = `${email.subject} ${email.bodyPreview}`.toLowerCase();
  const signals: string[] = [];
  let score = 0;

  for (const keyword of BUYING_KEYWORDS) {
    if (text.includes(keyword)) {
      signals.push(keyword);
      score += 1;
    }
  }

  // Boost score for high importance
  if (email.importance === "high") {
    score += 2;
  }

  // Boost for flagged emails
  if (email.flag?.flagStatus === "flagged") {
    score += 1;
  }

  return { score, signals };
}

function extractCompanyFromEmail(email: string): string {
  const domain = email.split("@")[1];
  if (!domain) return "Unknown";
  const freeProviders = [
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
    "aol.com", "icloud.com", "mail.com", "protonmail.com",
  ];
  if (freeProviders.includes(domain.toLowerCase())) {
    return domain;
  }
  return domain.replace(/\.(com|org|net|io|co|inc)$/i, "").replace(/\./g, " ");
}

function getUrgencyLevel(
  urgencyScore: number,
  importance: string,
  daysSince: number
): "critical" | "high" | "medium" | "low" {
  if (importance === "high" && daysSince >= 2) return "critical";
  if (urgencyScore >= 8) return "critical";
  if (urgencyScore >= 5 || importance === "high") return "high";
  if (urgencyScore >= 3 || daysSince >= 2) return "medium";
  return "low";
}

export function analyzeEmails(
  allEmails: Email[],
  sentEmails: Email[],
  dateRange?: { start: Date; end: Date },
  settings?: PromptSettings
): DashboardStats {
  const now = new Date();
  const rangeStart = dateRange?.start ?? new Date(now.getFullYear(), 0, 1);
  const rangeEnd = dateRange?.end ?? now;

  // --- Unread analysis ---
  const unreadEmails = allEmails.filter((e) => !e.isRead);
  const categoryMap = new Map<string, Email[]>();

  for (const email of unreadEmails) {
    const cat = categorizeEmail(email);
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    categoryMap.get(cat)!.push(email);
  }

  const unreadByCategory: EmailCategory[] = Array.from(categoryMap.entries())
    .map(([name, emails]) => ({
      name,
      count: emails.length,
      color: CATEGORY_COLORS[name] || "#94a3b8",
      emails,
    }))
    .sort((a, b) => b.count - a.count);

  // --- Unreplied analysis ---
  const sentConversationIds = new Set(sentEmails.map((e) => e.conversationId));
  const incomingEmails = allEmails.filter(
    (e) => !sentConversationIds.has(e.conversationId)
  );

  const unrepliedCategoryMap = new Map<string, Email[]>();
  const unrepliedEmails: UnrepliedEmail[] = incomingEmails.map((email) => {
    const daysSince = differenceInDays(now, new Date(email.receivedDateTime));
    const cat = categorizeEmail(email);
    if (!unrepliedCategoryMap.has(cat)) unrepliedCategoryMap.set(cat, []);
    unrepliedCategoryMap.get(cat)!.push(email);

    let urgencyScore = daysSince;
    if (email.importance === "high") urgencyScore += 5;
    if (email.flag?.flagStatus === "flagged") urgencyScore += 3;

    const urgencyLevel = getUrgencyLevel(urgencyScore, email.importance, daysSince);
    const replyStatus = daysSince === 0
      ? "Awaiting your reply"
      : `Awaiting your reply`;

    return {
      ...email,
      daysSinceReceived: daysSince,
      urgencyScore,
      urgencyLevel,
      replyStatus,
    };
  });

  // --- Build client threads (grouped by sender) ---
  const threadMap = new Map<string, UnrepliedEmail[]>();
  for (const email of unrepliedEmails) {
    const addr = email.from.emailAddress.address;
    if (!threadMap.has(addr)) threadMap.set(addr, []);
    threadMap.get(addr)!.push(email);
  }

  const clientThreads: ClientThread[] = Array.from(threadMap.entries())
    .map(([addr, emails]) => {
      const latest = emails[0]; // already sorted by receivedDateTime desc
      const daysSince = differenceInDays(now, new Date(latest.receivedDateTime));
      const { score: buyIntent, signals } = computeBuyingSignals(latest);
      const company = extractCompanyFromEmail(addr);
      const highestUrgency = emails.reduce<"critical" | "high" | "medium" | "low">(
        (best, e) => {
          const order = { critical: 0, high: 1, medium: 2, low: 3 };
          return order[e.urgencyLevel] < order[best] ? e.urgencyLevel : best;
        },
        "low"
      );

      return {
        clientName: latest.from.emailAddress.name,
        clientEmail: addr,
        company,
        subject: latest.subject,
        urgencyLevel: highestUrgency,
        daysSinceLastReply: daysSince,
        lastReplyDate: latest.receivedDateTime,
        replyStatus: daysSince === 0 ? "Awaiting your reply" : "Awaiting your reply",
        buyingIntent: buyIntent,
        hasBuyIntent: buyIntent >= 2,
        matchedKeywords: signals,
        lastMessage: latest.bodyPreview || "",
        emails,
      };
    })
    .sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.urgencyLevel] - order[b.urgencyLevel];
    });

  const unrepliedByCategory: EmailCategory[] = Array.from(
    unrepliedCategoryMap.entries()
  )
    .map(([name, emails]) => ({
      name,
      count: emails.length,
      color: CATEGORY_COLORS[name] || "#94a3b8",
      emails,
    }))
    .sort((a, b) => b.count - a.count);

  // --- Buying signals ---
  const buyingSignalEmails: BuyingSignalEmail[] = allEmails
    .map((email) => {
      const { score, signals } = computeBuyingSignals(email);
      const senderCompany = extractCompanyFromEmail(
        email.from.emailAddress.address
      );
      return { ...email, signalScore: score, signals, senderCompany };
    })
    .filter((e) => e.signalScore >= 2)
    .sort((a, b) => b.signalScore - a.signalScore);

  // --- Unread trend (adapts to date range) ---
  const unreadTrend: { date: string; count: number }[] = [];
  const rangeDays = Math.ceil(
    (rangeEnd.getTime() - rangeStart.getTime()) / (24 * 60 * 60 * 1000)
  );

  if (rangeDays <= 45) {
    // Daily buckets for short ranges
    for (let i = 0; i <= rangeDays; i++) {
      const day = new Date(rangeStart);
      day.setDate(day.getDate() + i);
      const dayStr = format(day, "MMM dd");
      const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const count = unreadEmails.filter((e) => {
        const d = new Date(e.receivedDateTime);
        return d >= dayStart && d < dayEnd;
      }).length;
      unreadTrend.push({ date: dayStr, count });
    }
  } else {
    // Weekly buckets for longer ranges
    const totalWeeks = Math.ceil(rangeDays / 7);
    for (let w = 0; w < totalWeeks; w++) {
      const weekStart = new Date(rangeStart);
      weekStart.setDate(weekStart.getDate() + w * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const label = format(weekStart, "MMM dd");
      const count = unreadEmails.filter((e) => {
        const d = new Date(e.receivedDateTime);
        return d >= weekStart && d < weekEnd;
      }).length;
      unreadTrend.push({ date: label, count });
    }
  }

  // --- Top senders (filter out automated/system senders) ---
  const emailFilters = settings?.noiseEmailFilters ?? [
    "noreply@", "no-reply@", "donotreply@",
    "notifications@", "notification@", "mailer-daemon@", "postmaster@",
    "microsoft.com", "teams.microsoft",
    "slack.com", "slackbot",
    "powerbi", "sharepoint",
  ];
  const nameFilters = settings?.noiseNameFilters ?? [
    "in teams", "via teams", "power bi", "slack", "microsoft ",
  ];
  const senderMap = new Map<string, { name: string; email: string; count: number }>();
  for (const email of allEmails) {
    const addr = email.from.emailAddress.address.toLowerCase();
    const name = email.from.emailAddress.name;
    const isNoise =
      emailFilters.some((f) => addr.includes(f.toLowerCase())) ||
      nameFilters.some((f) => name.toLowerCase().includes(f.toLowerCase()));
    if (isNoise) continue;
    if (!senderMap.has(addr)) {
      senderMap.set(addr, { name, email: addr, count: 0 });
    }
    senderMap.get(addr)!.count++;
  }
  const topSenders = Array.from(senderMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // --- Importance distribution ---
  const importanceCounts = { high: 0, normal: 0, low: 0 };
  for (const email of unreadEmails) {
    const imp = (email.importance || "normal").toLowerCase() as keyof typeof importanceCounts;
    if (imp in importanceCounts) importanceCounts[imp]++;
  }
  const importanceDistribution = [
    { name: "High", value: importanceCounts.high },
    { name: "Normal", value: importanceCounts.normal },
    { name: "Low", value: importanceCounts.low },
  ];

  // --- Avg response time ---
  const repliedConversations = allEmails.filter((e) =>
    sentConversationIds.has(e.conversationId)
  );
  let totalHours = 0;
  let repliedCount = 0;
  for (const email of repliedConversations) {
    const sent = sentEmails.find(
      (s) => s.conversationId === email.conversationId
    );
    if (sent) {
      // sentDateTime for sent items, fallback to receivedDateTime
      const sentTime = (sent as Email & { sentDateTime?: string }).sentDateTime
        || sent.receivedDateTime;
      if (!sentTime) continue;
      const hours = differenceInHours(
        new Date(sentTime),
        new Date(email.receivedDateTime)
      );
      if (hours >= 0) {
        totalHours += hours;
        repliedCount++;
      }
    }
  }
  const avgResponseTime = repliedCount > 0 ? totalHours / repliedCount : 0;

  const urgentCount = unrepliedEmails.filter(
    (e) => e.importance === "high" || e.urgencyScore >= 5
  ).length;

  const criticalCount = unrepliedEmails.filter(
    (e) => e.urgencyLevel === "critical"
  ).length;

  const awaitingReplyOver2d = unrepliedEmails.filter(
    (e) => e.daysSinceReceived > 2
  ).length;

  return {
    totalUnread: unreadEmails.length,
    totalUnreplied: unrepliedEmails.length,
    totalBuyingSignals: buyingSignalEmails.length,
    urgentCount,
    criticalCount,
    awaitingReplyOver2d,
    avgResponseTime: Math.round(avgResponseTime),
    unreadByCategory,
    unrepliedByCategory,
    buyingSignalEmails,
    clientThreads,
    unreadTrend,
    topSenders,
    importanceDistribution,
    llmEnriched: false,
  };
}

/**
 * Enrich existing dashboard stats with Claude LLM analysis results.
 * Re-categorizes emails using LLM categories, upgrades buying signals with
 * intent stages, and adds executive summary.
 */
export function enrichWithLLMResults(
  stats: DashboardStats,
  allEmails: Email[],
  llmResult: LLMBatchResult
): DashboardStats {
  const analysisMap = new Map<string, LLMEmailAnalysis>();
  for (const a of llmResult.analyses) {
    analysisMap.set(a.id, a);
  }

  // --- Re-categorize unread emails using LLM categories ---
  const unreadEmails = allEmails.filter((e) => !e.isRead);
  const llmCategoryMap = new Map<string, Email[]>();

  for (const email of unreadEmails) {
    const llm = analysisMap.get(email.id);
    const cat = llm?.category || categorizeEmail(email);
    if (!llmCategoryMap.has(cat)) llmCategoryMap.set(cat, []);
    llmCategoryMap.get(cat)!.push(email);
  }

  const unreadByCategory: EmailCategory[] = Array.from(llmCategoryMap.entries())
    .map(([name, emails]) => ({
      name,
      count: emails.length,
      color: CATEGORY_COLORS[name] || "#94a3b8",
      emails,
    }))
    .sort((a, b) => b.count - a.count);

  // --- Re-categorize unreplied using LLM ---
  const unrepliedCategoryMap = new Map<string, Email[]>();
  for (const cat of stats.unrepliedByCategory) {
    for (const email of cat.emails) {
      const llm = analysisMap.get(email.id);
      const newCat = llm?.category || cat.name;
      if (!unrepliedCategoryMap.has(newCat)) unrepliedCategoryMap.set(newCat, []);
      unrepliedCategoryMap.get(newCat)!.push(email);
    }
  }

  const unrepliedByCategory: EmailCategory[] = Array.from(
    unrepliedCategoryMap.entries()
  )
    .map(([name, emails]) => ({
      name,
      count: emails.length,
      color: CATEGORY_COLORS[name] || "#94a3b8",
      emails,
    }))
    .sort((a, b) => b.count - a.count);

  // --- Upgrade buying signals with LLM scores ---
  const buyingSignalEmails: BuyingSignalEmail[] = allEmails
    .map((email) => {
      const llm = analysisMap.get(email.id);
      const { score: keywordScore, signals } = computeBuyingSignals(email);
      const senderCompany = extractCompanyFromEmail(
        email.from.emailAddress.address
      );

      const llmScore = llm?.buyingSignal?.score || 0;
      // Combine: LLM score (0-10) weighted more heavily + keyword score
      const combinedScore = llmScore > 0
        ? Math.round(llmScore * 0.7 + Math.min(keywordScore, 10) * 0.3)
        : keywordScore;

      return {
        ...email,
        signalScore: combinedScore,
        signals: llm?.buyingSignal?.intent && llm.buyingSignal.intent !== "none"
          ? [llm.buyingSignal.intent, ...signals]
          : signals,
        senderCompany,
        buyingStage: llm?.buyingSignal?.stage,
        buyingIntent: llm?.buyingSignal?.intent,
        llmSummary: llm?.summary,
        actionRequired: llm?.actionRequired,
      };
    })
    .filter((e) => e.signalScore >= 2)
    .sort((a, b) => b.signalScore - a.signalScore);

  // --- Recalculate urgent count using LLM priorities ---
  let urgentCount = 0;
  for (const email of allEmails) {
    const llm = analysisMap.get(email.id);
    if (llm?.priority === "critical" || llm?.priority === "high") {
      urgentCount++;
    }
  }
  // Fall back to original if LLM found none
  if (urgentCount === 0) urgentCount = stats.urgentCount;

  // --- Update client threads with LLM data ---
  const updatedClientThreads = stats.clientThreads.map((thread) => {
    const latestEmail = thread.emails[0];
    const llm = latestEmail ? analysisMap.get(latestEmail.id) : undefined;
    if (!llm) return thread;

    // Override urgency with LLM priority if available
    const llmUrgency = llm.priority || thread.urgencyLevel;
    // Override buying intent with LLM score
    const llmBuyScore = llm.buyingSignal?.score ?? thread.buyingIntent;
    const llmKeywords =
      llm.buyingSignal?.intent && llm.buyingSignal.intent !== "none"
        ? [llm.buyingSignal.intent, ...thread.matchedKeywords]
        : thread.matchedKeywords;

    return {
      ...thread,
      urgencyLevel: llmUrgency,
      buyingIntent: llmBuyScore,
      hasBuyIntent: llmBuyScore >= 2,
      matchedKeywords: [...new Set(llmKeywords)],
    };
  });

  const criticalCount = updatedClientThreads.filter(
    (t) => t.urgencyLevel === "critical"
  ).length || stats.criticalCount;

  return {
    ...stats,
    unreadByCategory,
    unrepliedByCategory,
    buyingSignalEmails,
    clientThreads: updatedClientThreads,
    totalBuyingSignals: buyingSignalEmails.length,
    urgentCount,
    criticalCount,
    executiveSummary: llmResult.executiveSummary,
    llmEnriched: true,
  };
}
