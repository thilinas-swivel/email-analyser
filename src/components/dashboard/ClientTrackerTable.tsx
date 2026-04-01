"use client";

import { ClientThread } from "@/lib/types";
import { format } from "date-fns";
import { Search, Filter } from "lucide-react";
import { useState, useMemo } from "react";

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

export default function ClientTrackerTable({ threads }: Props) {
  const [search, setSearch] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortField>("urgency");
  const [buyIntentOnly, setBuyIntentOnly] = useState(false);

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

  const maxBuyIntent = Math.max(...threads.map((t) => t.buyingIntent), 1);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
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
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
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
        <div className="overflow-x-auto">
          <table className="w-full">
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
              {filtered.slice(0, 50).map((thread) => {
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
          {filtered.length > 50 && (
            <p className="text-sm text-slate-500 mt-4 text-center">
              Showing top 50 of {filtered.length} client threads
            </p>
          )}
        </div>
      )}
    </div>
  );
}
