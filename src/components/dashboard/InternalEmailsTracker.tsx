"use client";

import { InternalThread } from "@/lib/types";
import { format } from "date-fns";
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  MessageCircle,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { Fragment, useMemo, useState } from "react";

interface Props {
  threads: InternalThread[];
  isEnriched?: boolean;
  aiLoading?: boolean;
}

const URGENCY_BADGE: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  critical: {
    label: "CRITICAL",
    color: "text-red-300",
    bg: "bg-red-500/20",
    border: "border-red-500/40",
  },
  high: {
    label: "HIGH",
    color: "text-orange-300",
    bg: "bg-orange-500/20",
    border: "border-orange-500/40",
  },
  medium: {
    label: "MEDIUM",
    color: "text-amber-300",
    bg: "bg-amber-500/20",
    border: "border-amber-500/40",
  },
  low: {
    label: "LOW",
    color: "text-slate-400",
    bg: "bg-slate-500/20",
    border: "border-slate-500/40",
  },
};

type SortField = "urgency" | "received" | "replyNeeded";
type ReplyFilter = "all" | "needs-reply" | "no-reply-needed";

const DEFAULT_PAGE_SIZE = 15;
const PAGE_SIZE_OPTIONS = [15, 30, 50, 100];

export default function InternalEmailsTracker({
  threads,
  isEnriched,
  aiLoading,
}: Props) {
  const [search, setSearch] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortField>("replyNeeded");
  const [replyFilter, setReplyFilter] = useState<ReplyFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [expandedThread, setExpandedThread] = useState<string | null>(null);

  const resetView = () => {
    setCurrentPage(1);
    setExpandedThread(null);
  };

  const filtered = useMemo(() => {
    let result = threads;

    if (search) {
      const query = search.toLowerCase();
      result = result.filter(
        (thread) =>
          thread.senderName.toLowerCase().includes(query) ||
          thread.senderEmail.toLowerCase().includes(query) ||
          thread.subject.toLowerCase().includes(query)
      );
    }

    if (urgencyFilter !== "all") {
      result = result.filter((thread) => thread.urgencyLevel === urgencyFilter);
    }

    if (replyFilter === "needs-reply") {
      result = result.filter((thread) => thread.replyNeeded);
    } else if (replyFilter === "no-reply-needed") {
      result = result.filter((thread) => !thread.replyNeeded);
    }

    const urgencyOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    return [...result].sort((left, right) => {
      if (sortBy === "replyNeeded") {
        if (left.replyNeeded !== right.replyNeeded) {
          return left.replyNeeded ? -1 : 1;
        }

        return urgencyOrder[left.urgencyLevel] - urgencyOrder[right.urgencyLevel];
      }

      if (sortBy === "urgency") {
        return urgencyOrder[left.urgencyLevel] - urgencyOrder[right.urgencyLevel];
      }

      return right.daysSinceReceived - left.daysSinceReceived;
    });
  }, [threads, search, urgencyFilter, sortBy, replyFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedThreads = filtered.slice(startIndex, endIndex);
  const needsReplyCount = threads.filter((thread) => thread.replyNeeded).length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-4 sm:mb-5">
        <div className="w-10 h-10 bg-violet-500/10 rounded-lg flex items-center justify-center">
          <Users className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Internal Email Tracker</h2>
          <p className="text-sm text-slate-400">
            {threads.length} internal threads &middot; <span className="text-amber-400">{needsReplyCount} need reply</span>
            {aiLoading && <span className="text-slate-500"> &middot; AI reviewing full email bodies</span>}
            {!aiLoading && isEnriched && <span className="text-emerald-400"> &middot; AI enriched</span>}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
        <div className="relative flex-1 min-w-37.5 sm:min-w-50">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search team members..."
            value={search}
            onChange={(event) => {
              resetView();
              setSearch(event.target.value);
            }}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
        </div>

        <select
          value={replyFilter}
          onChange={(event) => {
            resetView();
            setReplyFilter(event.target.value as ReplyFilter);
          }}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
        >
          <option value="all">All Emails</option>
          <option value="needs-reply">Needs Reply</option>
          <option value="no-reply-needed">No Reply Needed</option>
        </select>

        <select
          value={urgencyFilter}
          onChange={(event) => {
            resetView();
            setUrgencyFilter(event.target.value);
          }}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
        >
          <option value="all">All Urgency</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select
          value={sortBy}
          onChange={(event) => {
            resetView();
            setSortBy(event.target.value as SortField);
          }}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
        >
          <option value="replyNeeded">Sort: Reply Needed</option>
          <option value="urgency">Sort: Urgency</option>
          <option value="received">Sort: Received</option>
        </select>

        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span>Rows</span>
          <select
            value={pageSize}
            onChange={(event) => {
              resetView();
              setPageSize(Number(event.target.value));
            }}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500">No matching internal threads.</p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <table className="w-full min-w-225">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left text-xs font-medium text-slate-400 pb-3 pr-4">Reply Status</th>
                <th className="text-left text-xs font-medium text-slate-400 pb-3 pr-4">From</th>
                <th className="text-left text-xs font-medium text-slate-400 pb-3 pr-4">Urgency</th>
                <th className="text-left text-xs font-medium text-slate-400 pb-3 pr-4">Received</th>
                <th className="text-left text-xs font-medium text-slate-400 pb-3">Preview</th>
              </tr>
            </thead>
            <tbody>
              {paginatedThreads.map((thread) => {
                const badge = URGENCY_BADGE[thread.urgencyLevel];
                const threadKey = thread.senderEmail + thread.receivedDate;
                const hasAiDetails = Boolean(
                  thread.aiSummary || thread.aiDraftReply || thread.aiActionRequired
                );
                const isExpanded = expandedThread === threadKey;

                return (
                  <Fragment key={threadKey}>
                    <tr className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 pr-4 align-top">
                        {thread.replyNeeded ? (
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                              <MessageCircle className="w-4 h-4 text-amber-400" />
                            </div>
                            <span className="text-[11px] font-bold tracking-wide text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-1 rounded">
                              REPLY NEEDED
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-slate-700/50 flex items-center justify-center">
                              <CheckCircle2 className="w-4 h-4 text-slate-500" />
                            </div>
                            <span className="text-[11px] font-medium text-slate-500">FYI Only</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-4 align-top">
                        <p className="text-sm text-white font-medium truncate max-w-45">{thread.senderName}</p>
                        <p className="text-xs text-slate-500 truncate max-w-45">{thread.subject}</p>
                      </td>
                      <td className="py-3 pr-4 align-top">
                        <span
                          className={`inline-block text-[10px] font-bold tracking-wide px-2 py-0.5 rounded border ${badge.color} ${badge.bg} ${badge.border}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap align-top">
                        <p className="text-sm text-white">
                          {thread.daysSinceReceived === 0 ? "Today" : `${thread.daysSinceReceived}d ago`}
                        </p>
                        <p className="text-xs text-slate-500">
                          {format(new Date(thread.receivedDate), "MMM d, yyyy")}
                        </p>
                      </td>
                      <td className="py-3 align-top">
                        <div className="space-y-2">
                          <p className="text-xs text-slate-400 line-clamp-2 max-w-105">
                            {thread.lastMessage || "—"}
                          </p>
                          {thread.aiSummary && (
                            <div className="flex items-start gap-2 max-w-105 rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-3 py-2">
                              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-300" />
                              <p className="text-xs text-indigo-100 line-clamp-2">{thread.aiSummary}</p>
                            </div>
                          )}
                          {hasAiDetails && (
                            <button
                              onClick={() =>
                                setExpandedThread((current) =>
                                  current === threadKey ? null : threadKey
                                )
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                              AI details
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && hasAiDetails && (
                      <tr className="border-b border-slate-800/50 bg-slate-950/40">
                        <td colSpan={5} className="px-4 py-4 sm:px-6">
                          <div className="grid gap-4 lg:grid-cols-2">
                            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-300">
                                AI Summary
                              </p>
                              <p className="text-sm leading-6 text-slate-200">
                                {thread.aiSummary || "AI summary was not available for this thread."}
                              </p>
                              {thread.aiActionRequired && (
                                <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-300">
                                    Recommended Action
                                  </p>
                                  <p className="mt-1 text-sm text-amber-100">{thread.aiActionRequired}</p>
                                </div>
                              )}
                            </div>
                            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                                Draft Reply
                              </p>
                              <p className="text-sm leading-6 text-slate-200 whitespace-pre-wrap">
                                {thread.aiDraftReply || "No reply draft was generated because AI judged this thread as FYI only."}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-800">
              <p className="text-sm text-slate-400">
                Showing {startIndex + 1}-{Math.min(endIndex, filtered.length)} of {filtered.length} threads
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setExpandedThread(null);
                    setCurrentPage((page) => Math.max(1, page - 1));
                  }}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => {
                    let pageNum: number;

                    if (totalPages <= 5) {
                      pageNum = index + 1;
                    } else if (currentPage <= 3) {
                      pageNum = index + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + index;
                    } else {
                      pageNum = currentPage - 2 + index;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => {
                          setExpandedThread(null);
                          setCurrentPage(pageNum);
                        }}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === pageNum
                            ? "bg-violet-500 text-white"
                            : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => {
                    setExpandedThread(null);
                    setCurrentPage((page) => Math.min(totalPages, page + 1));
                  }}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
