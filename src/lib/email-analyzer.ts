import { differenceInDays, differenceInHours, format } from "date-fns";
import {
  Email,
  EmailCategory,
  UnrepliedEmail,
  BuyingSignalEmail,
  DashboardStats,
  ClientThread,
  InternalThread,
  PromptSettings,
  TrendPoint,
  SenderStat,
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

function extractDomain(emailAddress: string): string {
  const parts = emailAddress.toLowerCase().split("@");
  return parts.length > 1 ? parts[1] : "";
}

function getSenderAddress(email: Email): string {
  return email.from?.emailAddress?.address ?? "";
}

function getSenderName(email: Email): string {
  return email.from?.emailAddress?.name ?? "Unknown Sender";
}

function isInternalEmail(email: Email, userDomain: string | undefined): boolean {
  if (!userDomain) return false;
  const senderDomain = extractDomain(getSenderAddress(email));
  return senderDomain === userDomain;
}

function categorizeEmail(email: Email, userDomain?: string): string {
  // Check if internal email first (same domain as user)
  if (userDomain && isInternalEmail(email, userDomain)) {
    return "Internal / Team";
  }

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

function categoryMapToArray(categoryMap: Map<string, Email[]>): EmailCategory[] {
  return Array.from(categoryMap.entries())
    .map(([name, emails]) => ({
      name,
      count: emails.length,
      color: CATEGORY_COLORS[name] || "#94a3b8",
      emails,
    }))
    .sort((a, b) => b.count - a.count);
}

export function analyzeEmails(
  allEmails: Email[],
  sentEmails: Email[],
  dateRange?: { start: Date; end: Date },
  settings?: PromptSettings,
  userEmail?: string
): DashboardStats {
  const now = new Date();
  const rangeStart = dateRange?.start ?? new Date(now.getFullYear(), 0, 1);
  const rangeEnd = dateRange?.end ?? now;
  
  // Extract user's domain for internal email detection
  const userDomain = userEmail ? extractDomain(userEmail) : undefined;

  // --- Unread analysis ---
  const unreadEmails = allEmails.filter((e) => !e.isRead);
  const categoryMap = new Map<string, Email[]>();
  const internalUnreadCategoryMap = new Map<string, Email[]>();
  const externalUnreadCategoryMap = new Map<string, Email[]>();

  for (const email of unreadEmails) {
    const cat = categorizeEmail(email, userDomain);
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    categoryMap.get(cat)!.push(email);

    const scopeMap = isInternalEmail(email, userDomain)
      ? internalUnreadCategoryMap
      : externalUnreadCategoryMap;
    if (!scopeMap.has(cat)) scopeMap.set(cat, []);
    scopeMap.get(cat)!.push(email);
  }

  const unreadByCategory: EmailCategory[] = categoryMapToArray(categoryMap);
  const unreadByCategoryByScope = {
    internal: categoryMapToArray(internalUnreadCategoryMap),
    external: categoryMapToArray(externalUnreadCategoryMap),
  };

  // --- Unreplied analysis ---
  const sentConversationIds = new Set(sentEmails.map((e) => e.conversationId));
  const incomingEmails = allEmails.filter(
    (e) => !sentConversationIds.has(e.conversationId)
  );

  const unrepliedCategoryMap = new Map<string, Email[]>();
  const internalUnrepliedCategoryMap = new Map<string, Email[]>();
  const externalUnrepliedCategoryMap = new Map<string, Email[]>();
  const unrepliedEmails: UnrepliedEmail[] = incomingEmails.map((email) => {
    const daysSince = differenceInDays(now, new Date(email.receivedDateTime));
    const cat = categorizeEmail(email, userDomain);
    if (!unrepliedCategoryMap.has(cat)) unrepliedCategoryMap.set(cat, []);
    unrepliedCategoryMap.get(cat)!.push(email);

    const scopeMap = isInternalEmail(email, userDomain)
      ? internalUnrepliedCategoryMap
      : externalUnrepliedCategoryMap;
    if (!scopeMap.has(cat)) scopeMap.set(cat, []);
    scopeMap.get(cat)!.push(email);

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
  // Filter: only EXTERNAL client emails (not internal, not automated/noise)
  const emailFilters = settings?.noiseEmailFilters ?? [
    "noreply@", "no-reply@", "donotreply@",
    "notifications@", "notification@", "mailer-daemon@", "postmaster@",
    "microsoft.com", "teams.microsoft",
    "slack.com", "slackbot",
    "powerbi", "sharepoint",
    "github.com", "azure.com", "aws.amazon.com",
    "supabase.com", "vercel.com", "netlify.com",
    "jira", "atlassian", "trello",
    "mailchimp", "sendgrid", "hubspot",
    "zendesk", "freshdesk", "intercom",
    "calendly", "zoom.us", "webex",
  ];
  const nameFilters = settings?.noiseNameFilters ?? [
    "in teams", "via teams", "power bi", "slack", "microsoft ",
    "automated", "system", "do not reply", "no reply",
    "security alert", "notification", "digest",
  ];

  const isNoiseOrInternalEmail = (email: UnrepliedEmail): boolean => {
    const addr = getSenderAddress(email).toLowerCase();
    const name = getSenderName(email).toLowerCase();
    
    // Check if internal (same domain as user)
    if (userDomain && extractDomain(addr) === userDomain) {
      return true;
    }
    
    // Check if noise/automated
    const isNoise =
      emailFilters.some((f) => addr.includes(f.toLowerCase())) ||
      nameFilters.some((f) => name.includes(f.toLowerCase()));
    
    return isNoise;
  };

  const threadMap = new Map<string, UnrepliedEmail[]>();
  for (const email of unrepliedEmails) {
    // Skip internal and noise emails for client tracker
    if (isNoiseOrInternalEmail(email)) continue;
    
    const addr = getSenderAddress(email);
    if (!addr) continue;
    if (!threadMap.has(addr)) threadMap.set(addr, []);
    threadMap.get(addr)!.push(email);
  }

  const clientThreads: ClientThread[] = Array.from(threadMap.entries())
    .map(([addr, emails]) => {
      const latest = emails[0]; // already sorted by receivedDateTime desc
      const daysSince = differenceInDays(now, new Date(latest.receivedDateTime));
      const company = extractCompanyFromEmail(addr);
      const highestUrgency = emails.reduce<"critical" | "high" | "medium" | "low">(
        (best, e) => {
          const order = { critical: 0, high: 1, medium: 2, low: 3 };
          return order[e.urgencyLevel] < order[best] ? e.urgencyLevel : best;
        },
        "low"
      );

      return {
        clientName: getSenderName(latest),
        clientEmail: addr,
        company,
        subject: latest.subject,
        urgencyLevel: highestUrgency,
        daysSinceLastReply: daysSince,
        lastReplyDate: latest.receivedDateTime,
        replyStatus: daysSince === 0 ? "Awaiting your reply" : "Awaiting your reply",
        replyNeeded: true,
        buyingIntent: 0,
        hasBuyIntent: false,
        matchedKeywords: [],
        lastMessage: latest.bodyPreview || "",
        emails,
      };
    })
    .sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.urgencyLevel] - order[b.urgencyLevel];
    });

  // --- Build internal threads (same domain as user, filter out noise) ---
  const isNoiseEmail = (email: UnrepliedEmail): boolean => {
    const addr = getSenderAddress(email).toLowerCase();
    const name = getSenderName(email).toLowerCase();
    return (
      emailFilters.some((f) => addr.includes(f.toLowerCase())) ||
      nameFilters.some((f) => name.includes(f.toLowerCase()))
    );
  };

  // Conservative keyword detection - only for initial display before AI analysis
  // These are strong indicators that definitely need reply
  const strongReplyIndicators = [
    "please confirm", "please respond", "please reply",
    "awaiting your", "need your approval", "requires your",
    "your decision", "your sign-off", "action needed",
  ];

  // Patterns that indicate NO reply needed (informational)
  const noReplyPatterns = [
    "ooo", "out of office", "out-of-office",
    "sick leave", "vacation", "annual leave", "pto",
    "fyi", "for your information", "no action required",
    "no response needed", "no reply needed",
    "weekly update", "weekly report", "status report", "status update",
    "newsletter", "announcement", "broadcast",
    "meeting invite", "calendar", "declined:", "accepted:",
  ];

  const detectReplyNeeded = (email: UnrepliedEmail): boolean => {
    const text = `${email.subject} ${email.bodyPreview}`.toLowerCase();
    
    // First check if it's clearly informational - NO reply needed
    if (noReplyPatterns.some((p) => text.includes(p))) {
      return false;
    }
    
    // Only flag for reply if strong indicators present
    // Flagged emails typically need attention
    if (email.flag?.flagStatus === "flagged") return true;
    // Check for strong reply indicators
    return strongReplyIndicators.some((kw) => text.includes(kw.toLowerCase()));
  };

  // Build internal threads only if tracking is enabled (default: true)
  let internalThreads: InternalThread[] = [];
  
  if (settings?.trackInternalEmails !== false) {
    const internalThreadMap = new Map<string, UnrepliedEmail[]>();
    for (const email of unrepliedEmails) {
      const addr = getSenderAddress(email).toLowerCase();
      // Only include internal emails (same domain) and exclude noise
      if (!userDomain || extractDomain(addr) !== userDomain) continue;
      if (isNoiseEmail(email)) continue;
      if (!addr) continue;
      
      if (!internalThreadMap.has(addr)) internalThreadMap.set(addr, []);
      internalThreadMap.get(addr)!.push(email);
    }

    internalThreads = Array.from(internalThreadMap.entries())
      .map(([addr, emails]) => {
        const latest = emails[0];
        const daysSince = differenceInDays(now, new Date(latest.receivedDateTime));
        const highestUrgency = emails.reduce<"critical" | "high" | "medium" | "low">(
          (best, e) => {
            const order = { critical: 0, high: 1, medium: 2, low: 3 };
            return order[e.urgencyLevel] < order[best] ? e.urgencyLevel : best;
          },
          "low"
        );
        // Check if any email in thread needs reply
      const needsReply = emails.some(detectReplyNeeded);

      return {
        senderName: getSenderName(latest),
        senderEmail: addr,
        department: "", // Could be enriched later
        subject: latest.subject,
        urgencyLevel: highestUrgency,
        daysSinceReceived: daysSince,
        receivedDate: latest.receivedDateTime,
        replyNeeded: needsReply,
        hasReplied: false, // These are unreplied by definition
        lastMessage: latest.bodyPreview || "",
        emails,
      };
    })
    .sort((a, b) => {
      // Sort by reply needed first, then urgency
      if (a.replyNeeded !== b.replyNeeded) return a.replyNeeded ? -1 : 1;
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.urgencyLevel] - order[b.urgencyLevel];
    });
  }

  const unrepliedByCategory: EmailCategory[] = categoryMapToArray(unrepliedCategoryMap);
  const unrepliedByCategoryByScope = {
    internal: categoryMapToArray(internalUnrepliedCategoryMap),
    external: categoryMapToArray(externalUnrepliedCategoryMap),
  };

  // --- Buying signals are LLM-only. Keep empty until enrichment completes. ---
  const buyingSignalEmails: BuyingSignalEmail[] = [];

  // --- Unread trend (adapts to date range) ---
  const unreadTrend: TrendPoint[] = [];
  const unreadTrendByScope = {
    internal: [] as TrendPoint[],
    external: [] as TrendPoint[],
  };
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
      const internalCount = unreadEmails.filter((e) => {
        const d = new Date(e.receivedDateTime);
        return d >= dayStart && d < dayEnd && isInternalEmail(e, userDomain);
      }).length;
      const externalCount = count - internalCount;
      unreadTrend.push({ date: dayStr, count });
      unreadTrendByScope.internal.push({ date: dayStr, count: internalCount });
      unreadTrendByScope.external.push({ date: dayStr, count: externalCount });
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
      const internalCount = unreadEmails.filter((e) => {
        const d = new Date(e.receivedDateTime);
        return d >= weekStart && d < weekEnd && isInternalEmail(e, userDomain);
      }).length;
      const externalCount = count - internalCount;
      unreadTrend.push({ date: label, count });
      unreadTrendByScope.internal.push({ date: label, count: internalCount });
      unreadTrendByScope.external.push({ date: label, count: externalCount });
    }
  }

  // --- Top senders (filter out automated/system senders and internal) ---
  const senderMap = new Map<string, SenderStat>();
  const internalSenderMap = new Map<string, SenderStat>();
  const externalSenderMap = new Map<string, SenderStat>();
  for (const email of allEmails) {
    const addr = getSenderAddress(email).toLowerCase();
    const name = getSenderName(email);
    if (!addr) continue;

    const isNoise =
      emailFilters.some((f) => addr.includes(f.toLowerCase())) ||
      nameFilters.some((f) => name.toLowerCase().includes(f.toLowerCase()));
    if (isNoise) continue;

    const internal = userDomain ? extractDomain(addr) === userDomain : false;
    const scopedMap = internal ? internalSenderMap : externalSenderMap;
    if (!scopedMap.has(addr)) {
      scopedMap.set(addr, { name, email: addr, count: 0 });
    }
    scopedMap.get(addr)!.count++;

    if (!internal) {
      if (!senderMap.has(addr)) {
        senderMap.set(addr, { name, email: addr, count: 0 });
      }
      senderMap.get(addr)!.count++;
    }
  }
  const topSenders = Array.from(senderMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const topSendersByScope = {
    internal: Array.from(internalSenderMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    external: Array.from(externalSenderMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
  };

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
    unreadByCategoryByScope,
    unrepliedByCategory,
    unrepliedByCategoryByScope,
    buyingSignalEmails,
    clientThreads,
    internalThreads,
    unreadTrend,
    unreadTrendByScope,
    topSenders,
    topSendersByScope,
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
  llmResult: LLMBatchResult,
  userEmail?: string
): DashboardStats {
  const analysisMap = new Map<string, LLMEmailAnalysis>();
  for (const a of llmResult.analyses) {
    analysisMap.set(a.id, a);
  }
  
  // Extract user's domain for internal email detection
  const userDomain = userEmail ? extractDomain(userEmail) : undefined;

  // --- Re-categorize unread emails using LLM categories ---
  const unreadEmails = allEmails.filter((e) => !e.isRead);
  const llmCategoryMap = new Map<string, Email[]>();

  for (const email of unreadEmails) {
    // Check for internal emails first (same domain)
    if (userDomain && isInternalEmail(email, userDomain)) {
      if (!llmCategoryMap.has("Internal / Team")) llmCategoryMap.set("Internal / Team", []);
      llmCategoryMap.get("Internal / Team")!.push(email);
    } else {
      const llm = analysisMap.get(email.id);
      const cat = llm?.category || categorizeEmail(email, userDomain);
      if (!llmCategoryMap.has(cat)) llmCategoryMap.set(cat, []);
      llmCategoryMap.get(cat)!.push(email);
    }
  }

  const unreadByCategory: EmailCategory[] = categoryMapToArray(llmCategoryMap);
  const llmInternalUnreadCategoryMap = new Map<string, Email[]>();
  const llmExternalUnreadCategoryMap = new Map<string, Email[]>();
  for (const email of unreadEmails) {
    const internal = userDomain ? isInternalEmail(email, userDomain) : false;
    const llm = analysisMap.get(email.id);
    const cat = internal ? "Internal / Team" : llm?.category || categorizeEmail(email, userDomain);
    const target = internal ? llmInternalUnreadCategoryMap : llmExternalUnreadCategoryMap;
    if (!target.has(cat)) target.set(cat, []);
    target.get(cat)!.push(email);
  }
  const unreadByCategoryByScope = {
    internal: categoryMapToArray(llmInternalUnreadCategoryMap),
    external: categoryMapToArray(llmExternalUnreadCategoryMap),
  };

  // --- Re-categorize unreplied using LLM ---
  const unrepliedCategoryMap = new Map<string, Email[]>();
  for (const cat of stats.unrepliedByCategory) {
    for (const email of cat.emails) {
      // Check for internal emails first (same domain)
      if (userDomain && isInternalEmail(email, userDomain)) {
        if (!unrepliedCategoryMap.has("Internal / Team")) unrepliedCategoryMap.set("Internal / Team", []);
        unrepliedCategoryMap.get("Internal / Team")!.push(email);
      } else {
        const llm = analysisMap.get(email.id);
        const newCat = llm?.category || cat.name;
        if (!unrepliedCategoryMap.has(newCat)) unrepliedCategoryMap.set(newCat, []);
        unrepliedCategoryMap.get(newCat)!.push(email);
      }
    }
  }

  const unrepliedByCategory: EmailCategory[] = categoryMapToArray(unrepliedCategoryMap);
  const llmInternalUnrepliedCategoryMap = new Map<string, Email[]>();
  const llmExternalUnrepliedCategoryMap = new Map<string, Email[]>();
  for (const category of unrepliedByCategory) {
    for (const email of category.emails) {
      const internal = userDomain ? isInternalEmail(email, userDomain) : false;
      const target = internal ? llmInternalUnrepliedCategoryMap : llmExternalUnrepliedCategoryMap;
      if (!target.has(category.name)) target.set(category.name, []);
      target.get(category.name)!.push(email);
    }
  }
  const unrepliedByCategoryByScope = {
    internal: categoryMapToArray(llmInternalUnrepliedCategoryMap),
    external: categoryMapToArray(llmExternalUnrepliedCategoryMap),
  };

  // --- Buying signals (LLM-only) ---
  const buyingSignalEmails: BuyingSignalEmail[] = allEmails
    .map((email) => {
      const llm = analysisMap.get(email.id);
      const senderCompany = extractCompanyFromEmail(
        getSenderAddress(email)
      );

      const llmScore = llm?.buyingSignal?.score ?? 0;
      return {
        ...email,
        signalScore: llmScore,
        signals:
          llm?.buyingSignal?.intent && llm.buyingSignal.intent !== "none"
            ? [llm.buyingSignal.intent]
            : [],
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
    let selectedAnalysis: LLMEmailAnalysis | undefined;
    let llmUrgency = thread.urgencyLevel;
    let llmBuyScore = thread.buyingIntent;
    let llmKeywords = thread.matchedKeywords;
    let aiReplyNeeded: boolean | undefined = undefined;

    for (const email of thread.emails) {
      const llm = analysisMap.get(email.id);
      if (!llm) continue;

      if (!selectedAnalysis || (llm.replyNeeded && !selectedAnalysis.replyNeeded)) {
        selectedAnalysis = llm;
      }

      if (typeof llm.replyNeeded === "boolean") {
        if (llm.replyNeeded === true) {
          aiReplyNeeded = true;
        } else if (aiReplyNeeded === undefined) {
          aiReplyNeeded = false;
        }
      }

      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      if (order[llm.priority] < order[llmUrgency]) {
        llmUrgency = llm.priority;
      }

      const currentBuyScore = llm.buyingSignal?.score ?? 0;
      if (currentBuyScore >= llmBuyScore) {
        llmBuyScore = currentBuyScore;
        llmKeywords =
          llm.buyingSignal?.intent && llm.buyingSignal.intent !== "none"
            ? [llm.buyingSignal.intent]
            : llmKeywords;
      }
    }

    if (!selectedAnalysis) return thread;

    return {
      ...thread,
      urgencyLevel: llmUrgency,
      buyingIntent: llmBuyScore,
      hasBuyIntent: llmBuyScore >= 2,
      matchedKeywords: llmKeywords,
      replyNeeded: aiReplyNeeded !== undefined ? aiReplyNeeded : thread.replyNeeded,
      aiSummary: selectedAnalysis.summary,
      aiDraftReply:
        selectedAnalysis.replyNeeded === true
          ? selectedAnalysis.draftReply ?? null
          : null,
      aiActionRequired: selectedAnalysis.actionRequired ?? null,
    };
  });

  const criticalCount = updatedClientThreads.filter(
    (t) => t.urgencyLevel === "critical"
  ).length || stats.criticalCount;

  // --- Update internal threads with LLM data ---
  const updatedInternalThreads = stats.internalThreads.map((thread) => {
    // Check all emails in thread for AI analysis
    let aiReplyNeeded: boolean | undefined = undefined;
    let llmUrgency = thread.urgencyLevel;
    let selectedAnalysis: LLMEmailAnalysis | undefined;
    
    for (const email of thread.emails) {
      const llm = analysisMap.get(email.id);
      if (llm) {
        if (!selectedAnalysis || (llm.replyNeeded && !selectedAnalysis.replyNeeded)) {
          selectedAnalysis = llm;
        }
        // Use AI's replyNeeded field directly - this is the source of truth
        // Handle cached data that might not have replyNeeded field yet
        if (typeof llm.replyNeeded === "boolean") {
          if (llm.replyNeeded === true) {
            aiReplyNeeded = true;
          } else if (aiReplyNeeded === undefined) {
            aiReplyNeeded = false;
          }
        } else {
          // Fallback for old cached data: infer from actionRequired
          const hasAction = llm.actionRequired !== null && llm.actionRequired !== "";
          if (hasAction && aiReplyNeeded !== true) {
            // Old cache: treat actionRequired as potential reply needed, but not definitive
            // Keep undefined to allow keyword detection as fallback
          }
        }
        // Use highest priority from AI
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        if (order[llm.priority] < order[llmUrgency]) {
          llmUrgency = llm.priority;
        }
      }
    }

    return {
      ...thread,
      urgencyLevel: llmUrgency,
      // Use AI's analysis if available, otherwise keep initial keyword-based detection
      replyNeeded: aiReplyNeeded !== undefined ? aiReplyNeeded : thread.replyNeeded,
      aiSummary: selectedAnalysis?.summary,
      aiDraftReply:
        selectedAnalysis?.replyNeeded === true
          ? selectedAnalysis.draftReply ?? null
          : null,
      aiActionRequired: selectedAnalysis?.actionRequired ?? null,
    };
  });

  return {
    ...stats,
    unreadByCategory,
    unreadByCategoryByScope,
    unrepliedByCategory,
    unrepliedByCategoryByScope,
    buyingSignalEmails,
    clientThreads: updatedClientThreads,
    internalThreads: updatedInternalThreads,
    totalBuyingSignals: buyingSignalEmails.length,
    urgentCount,
    criticalCount,
    unreadTrendByScope: stats.unreadTrendByScope,
    topSendersByScope: stats.topSendersByScope,
    executiveSummary: llmResult.executiveSummary,
    attentionItems: llmResult.attentionItems,
    llmEnriched: true,
  };
}
