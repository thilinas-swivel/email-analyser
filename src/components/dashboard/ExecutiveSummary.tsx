"use client";

import { Sparkles, Loader2, RefreshCw, Database, AlertCircle, AlertTriangle, Info, Clock3 } from "lucide-react";

interface AttentionItem {
  priority: "critical" | "high" | "medium";
  title: string;
  description: string;
  emailCount: number;
  senders: string[];
}

interface Props {
  summary?: string;
  attentionItems?: AttentionItem[];
  isEnriched?: boolean;
  aiLoading: boolean;
  showingSnapshot?: boolean;
  fromCache?: boolean;
  newEmailsAnalyzed?: number;
  onReanalyze?: () => void;
}

const PRIORITY_CONFIG = {
  critical: {
    icon: AlertCircle,
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    iconColor: "text-red-400",
    badge: "bg-red-500/20 text-red-300",
    label: "CRITICAL",
    dot: "bg-red-400",
  },
  high: {
    icon: AlertTriangle,
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    iconColor: "text-amber-400",
    badge: "bg-amber-500/20 text-amber-300",
    label: "HIGH",
    dot: "bg-amber-400",
  },
  medium: {
    icon: Info,
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    iconColor: "text-blue-400",
    badge: "bg-blue-500/20 text-blue-300",
    label: "MEDIUM",
    dot: "bg-blue-400",
  },
};

// Parse a paragraph summary into bullet points
function parseSummaryToBullets(summary: string): { text: string; priority: "critical" | "high" | "medium" }[] {
  const bullets: { text: string; priority: "critical" | "high" | "medium" }[] = [];
  
  // Split by common sentence separators while keeping context
  const sentences = summary
    .split(/(?<=[.!])\s+(?=[A-Z])/)
    .map(s => s.trim())
    .filter(s => s.length > 20); // Filter out very short fragments
  
  // Keywords for priority detection
  const criticalKeywords = /critical|urgent|immediate|payment fail|breach|legal|escalat|demand|override/i;
  const highKeywords = /high-risk|important|attention|deadline|overdue|concerning|revenue|sales pipeline|buying|budget/i;
  
  for (const sentence of sentences) {
    let priority: "critical" | "high" | "medium" = "medium";
    if (criticalKeywords.test(sentence)) {
      priority = "critical";
    } else if (highKeywords.test(sentence)) {
      priority = "high";
    }
    bullets.push({ text: sentence, priority });
  }
  
  // Sort by priority (critical first, then high, then medium)
  const priorityOrder = { critical: 0, high: 1, medium: 2 };
  bullets.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  
  return bullets.slice(0, 5); // Max 5 items
}

export default function ExecutiveSummary({
  summary,
  attentionItems,
  isEnriched,
  aiLoading,
  showingSnapshot,
  fromCache,
  newEmailsAnalyzed,
  onReanalyze,
}: Props) {
  if (!aiLoading && !summary && (!attentionItems || attentionItems.length === 0)) return null;

  // Parse summary into bullets if no structured attentionItems
  const parsedBullets = (!attentionItems || attentionItems.length === 0) && summary 
    ? parseSummaryToBullets(summary) 
    : [];

  return (
    <div className="mt-6 mb-6">
      <div className="bg-linear-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 rounded-xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center">
              {aiLoading ? (
                <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 text-indigo-400" />
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-semibold text-white">
                AI Executive Briefing
              </h2>
              {isEnriched && (
                <span className="text-[10px] font-medium bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">
                  Powered by Claude
                </span>
              )}
              {showingSnapshot && (
                <span className="text-[10px] font-medium bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Clock3 className="w-3 h-3" />
                  Showing last analyzed snapshot
                </span>
              )}
              {fromCache && !aiLoading && (
                <span className="text-[10px] font-medium bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Database className="w-3 h-3" />
                  Cached
                </span>
              )}
              {newEmailsAnalyzed !== undefined && newEmailsAnalyzed > 0 && !aiLoading && (
                <span className="text-[10px] font-medium bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">
                  +{newEmailsAnalyzed} new
                </span>
              )}
            </div>
          </div>
          {!aiLoading && onReanalyze && (
            <button
              onClick={onReanalyze}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-300 transition-colors bg-slate-800/50 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700/50"
              title="Re-analyze all emails with AI"
            >
              <RefreshCw className="w-3 h-3" />
              Re-analyze
            </button>
          )}
        </div>
        
        {aiLoading ? (
          <div className="space-y-3">
            <div className="h-4 bg-slate-800 rounded animate-pulse w-3/4" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-slate-800/50 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Structured attention items (new format) */}
            {attentionItems && attentionItems.length > 0 ? (
              <div className="space-y-2">
                {attentionItems.slice(0, 5).map((item, index) => {
                  const config = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.medium;
                  const Icon = config.icon;
                  return (
                    <div
                      key={index}
                      className={`${config.bg} ${config.border} border rounded-lg p-3 flex items-start gap-3`}
                    >
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-slate-500 font-mono text-sm w-5">{index + 1}.</span>
                        <Icon className={`w-4 h-4 ${config.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[9px] font-bold ${config.badge} px-1.5 py-0.5 rounded`}>
                            {config.label}
                          </span>
                          <h4 className="text-sm font-semibold text-white">
                            {item.title}
                          </h4>
                          {item.emailCount > 0 && (
                            <span className="text-[10px] text-slate-500">
                              ({item.emailCount} email{item.emailCount !== 1 ? "s" : ""})
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-300 mt-1">
                          {item.description}
                        </p>
                        {item.senders && item.senders.length > 0 && (
                          <p className="text-xs text-slate-500 mt-1">
                            From: {item.senders.slice(0, 3).join(", ")}
                            {item.senders.length > 3 && ` +${item.senders.length - 3} more`}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : parsedBullets.length > 0 ? (
              /* Parsed bullet points from summary paragraph (fallback) */
              <div className="space-y-2">
                {parsedBullets.map((bullet, index) => {
                  const config = PRIORITY_CONFIG[bullet.priority];
                  return (
                    <div
                      key={index}
                      className={`${config.bg} ${config.border} border rounded-lg p-3 flex items-start gap-3`}
                    >
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-slate-500 font-mono text-sm w-5">{index + 1}.</span>
                        <div className={`w-2 h-2 rounded-full ${config.dot}`} />
                      </div>
                      <p className="text-sm text-slate-300 flex-1">
                        {bullet.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : summary ? (
              /* Plain summary fallback */
              <p className="text-sm text-slate-300 leading-relaxed">{summary}</p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
