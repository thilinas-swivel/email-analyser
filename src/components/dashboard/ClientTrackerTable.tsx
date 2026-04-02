"use client";

import { ClientThread } from "@/lib/types";
import { format } from "date-fns";
import { Search, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useMemo, useEffect } from "react";

interface Props {
  threads: ClientThread[];
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

type SortField = "urgency" | "lastReply" | "buyIntent";

const ITEMS_PER_PAGE = 20;

export default function ClientTrackerTable({ threads }: Props) {
  const [search, setSearch] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortField>("urgency");
  const [buyIntentOnly, setBuyIntentOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = useMemo(() => {
    let result = threads;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.clientName.toLowerCase().includes(q) ||
          t.clientEmail.toLowerCase().includes(q) ||
          t.company.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q)
      );
    }

    if (urgencyFilter !== "all") {
      result = result.filter((t) => t.urgencyLevel === urgencyFilter);
    }

    if (buyIntentOnly) {
      result = result.filter((t) => t.hasBuyIntent);
    }

    const urgOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    result = [...result].sort((a, b) => {
      if (sortBy === "urgency")
        return urgOrder[a.urgencyLevel] - urgOrder[b.urgencyLevel];
      if (sortBy === "lastReply")
        return b.daysSinceLastReply - a.daysSinceLastReply;
      return b.buyingIntent - a.buyingIntent;
    });

    return result;
  }, [threads, search, urgencyFilter, sortBy, buyIntentOnly]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, urgencyFilter, sortBy, buyIntentOnly]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedThreads = filtered.slice(startIndex, endIndex);

  const maxBuyIntent = Math.max(...threads.map((t) => t.buyingIntent), 1);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 sm:mb-5">
        <div className="w-10 h-10 bg-indigo-500/10 rounded-lg flex items-center justify-center">
          <Filter className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">
            Client Email Tracker
          </h2>
          <p className="text-sm text-slate-400">
            {threads.length} client threads &middot; {filtered.length} shown
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
        <div className="relative flex-1 min-w-[150px] sm:min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <select
          value={urgencyFilter}
          onChange={(e) => setUrgencyFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="all">All Urgency</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortField)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="urgency">Sort: Urgency</option>
          <option value="lastReply">Sort: Last Reply</option>
          <option value="buyIntent">Sort: Buy Intent</option>
        </select>

        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={buyIntentOnly}
            onChange={(e) => setBuyIntentOnly(e.target.checked)}
            className="rounded bg-slate-800 border-slate-600 text-indigo-500 focus:ring-indigo-500"
          />
          Buy Intent Only
        </label>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500">No matching client threads.</p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left text-xs font-medium text-slate-400 pb-3 pr-4">
                  Client
                </th>
                <th className="text-left text-xs font-medium text-slate-400 pb-3 pr-4">
                  Urgency
                </th>
                <th className="text-left text-xs font-medium text-slate-400 pb-3 pr-4">
                  Last Reply
                </th>
                <th className="text-left text-xs font-medium text-slate-400 pb-3 pr-4 min-w-[180px]">
                  Buy Intent
                </th>
                <th className="text-left text-xs font-medium text-slate-400 pb-3 pr-4">
                  Matched Keywords
                </th>
                <th className="text-left text-xs font-medium text-slate-400 pb-3">
                  Last Message
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedThreads.map((thread) => {
                const badge = URGENCY_BADGE[thread.urgencyLevel];
                const intentPct = Math.min(
                  (thread.buyingIntent / maxBuyIntent) * 100,
                  100
                );
                const intentColor =
                  thread.buyingIntent >= 5
                    ? "bg-emerald-500"
                    : thread.buyingIntent >= 3
                      ? "bg-amber-500"
                      : "bg-slate-600";

                return (
                  <tr
                    key={thread.clientEmail}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                  >
                    {/* Client */}
                    <td className="py-3 pr-4">
                      <p className="text-sm text-white font-medium truncate max-w-[180px]">
                        {thread.clientName}
                      </p>
                      <p className="text-xs text-slate-500 truncate max-w-[180px]">
                        {thread.subject}
                      </p>
                    </td>

                    {/* Urgency */}
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-block text-[10px] font-bold tracking-wide px-2 py-0.5 rounded border ${badge.color} ${badge.bg} ${badge.border}`}
                      >
                        {badge.label}
                      </span>
                    </td>

                    {/* Last Reply */}
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <p className="text-sm text-white">
                        {thread.daysSinceLastReply === 0
                          ? "Today"
                          : `${thread.daysSinceLastReply}d ago`}
                      </p>
                      <p className="text-xs text-slate-500">
                        {format(
                          new Date(thread.lastReplyDate),
                          "MMM d, yyyy"
                        )}
                      </p>
                    </td>

                    {/* Buy Intent */}
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${intentColor}`}
                            style={{ width: `${intentPct}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-300 min-w-[20px] text-right">
                          {thread.buyingIntent}
                        </span>
                        {thread.hasBuyIntent && (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                            BUY
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Matched Keywords */}
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {thread.matchedKeywords.length > 0 ? (
                          thread.matchedKeywords.slice(0, 4).map((kw) => (
                            <span
                              key={kw}
                              className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded"
                            >
                              {kw}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </div>
                    </td>

                    {/* Last Message */}
                    <td className="py-3">
                      <p className="text-xs text-slate-400 line-clamp-2 max-w-[250px]">
                        {thread.lastMessage || "—"}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-800">
              <p className="text-sm text-slate-400">
                Showing {startIndex + 1}-{Math.min(endIndex, filtered.length)} of {filtered.length} threads
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === pageNum
                            ? "bg-indigo-500 text-white"
                            : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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
