"use client";

import { BuyingSignalEmail } from "@/lib/types";
import { TrendingUp, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { format } from "date-fns";
import { useState, useMemo } from "react";

const PAGE_SIZE = 10;

interface Props {
  emails: BuyingSignalEmail[];
}

export default function BuyingSignalsSection({ emails }: Props) {
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter emails based on search query
  const filteredEmails = useMemo(() => {
    if (!searchQuery.trim()) return emails;
    const query = searchQuery.toLowerCase();
    return emails.filter((email) =>
      email.subject.toLowerCase().includes(query) ||
      email.from.emailAddress.name.toLowerCase().includes(query) ||
      email.from.emailAddress.address.toLowerCase().includes(query) ||
      email.senderCompany.toLowerCase().includes(query) ||
      email.buyingIntent?.toLowerCase().includes(query) ||
      email.buyingStage?.toLowerCase().includes(query) ||
      email.bodyPreview?.toLowerCase().includes(query) ||
      email.signals.some((s) => s.toLowerCase().includes(query))
    );
  }, [emails, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredEmails.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageEmails = filteredEmails.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE
  );
  
  const getScoreBadge = (score: number) => {
    if (score >= 5)
      return {
        label: "Hot",
        color: "text-emerald-300",
        bg: "bg-emerald-500/15",
        border: "border-emerald-500/30",
      };
    if (score >= 3)
      return {
        label: "Warm",
        color: "text-amber-300",
        bg: "bg-amber-500/15",
        border: "border-amber-500/30",
      };
    return {
      label: "Prospect",
      color: "text-blue-300",
      bg: "bg-blue-500/15",
      border: "border-blue-500/30",
    };
  };

  const getStageStyle = (stage?: string) => {
    switch (stage) {
      case "purchase":
        return "text-emerald-300 bg-emerald-500/15 border border-emerald-500/30";
      case "decision":
        return "text-amber-300 bg-amber-500/15 border border-amber-500/30";
      case "consideration":
        return "text-blue-300 bg-blue-500/15 border border-blue-500/30";
      case "awareness":
        return "text-slate-300 bg-slate-500/15 border border-slate-500/30";
      default:
        return "";
    }
  };

  const maxScore = Math.max(...filteredEmails.map((e) => e.signalScore), 1);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">
              Buying Signals
            </h2>
            <p className="text-sm text-slate-400">
              {filteredEmails.length === emails.length
                ? `${emails.length} emails with potential buying intent`
                : `${filteredEmails.length} of ${emails.length} emails`}
            </p>
          </div>
        </div>
        
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search sender, company, subject..."
            value={searchQuery}
            onChange={(e) => {
              setPage(0);
              setSearchQuery(e.target.value);
            }}
            className="w-full sm:w-64 pl-9 pr-9 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setPage(0);
                setSearchQuery("");
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {emails.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500">
            No buying signals detected in recent emails.
          </p>
        </div>
      ) : filteredEmails.length === 0 ? (
        <div className="text-center py-12">
          <Search className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500">
            No emails match your search &quot;{searchQuery}&quot;
          </p>
          <button
            onClick={() => {
              setPage(0);
              setSearchQuery("");
            }}
            className="mt-3 text-sm text-emerald-400 hover:text-emerald-300"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left text-xs font-medium text-slate-400 pb-3 pr-4">
                  Score
                </th>
                <th className="text-left text-xs font-medium text-slate-400 pb-3 pr-4">
                  Sender / Company
                </th>
                <th className="text-left text-xs font-medium text-slate-400 pb-3 pr-4">
                  Subject
                </th>
                <th className="text-left text-xs font-medium text-slate-400 pb-3 pr-4 min-w-[140px]">
                  Intent
                </th>
                <th className="text-left text-xs font-medium text-slate-400 pb-3 pr-4">
                  Stage
                </th>
                <th className="text-left text-xs font-medium text-slate-400 pb-3">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {pageEmails.map((email) => {
                const badge = getScoreBadge(email.signalScore);
                const intentPct = Math.min(
                  (email.signalScore / maxScore) * 100,
                  100
                );
                const barColor =
                  email.signalScore >= 5
                    ? "bg-emerald-500"
                    : email.signalScore >= 3
                      ? "bg-amber-500"
                      : "bg-blue-500";

                return (
                  <tr
                    key={email.id}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                  >
                    {/* Score badge */}
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${badge.color} ${badge.bg} ${badge.border}`}
                      >
                        {badge.label}
                        <span className="opacity-60">{email.signalScore}</span>
                      </span>
                    </td>

                    {/* Sender */}
                    <td className="py-3 pr-4">
                      <p className="text-sm text-white">
                        {email.from.emailAddress.name}
                      </p>
                      <p className="text-xs text-slate-500 capitalize">
                        {email.senderCompany}
                      </p>
                    </td>

                    {/* Subject + preview */}
                    <td className="py-3 pr-4 max-w-xs">
                      <p className="text-sm text-slate-300 truncate">
                        {email.subject}
                      </p>
                      {email.llmSummary ? (
                        <p className="text-xs text-indigo-400 truncate mt-0.5">
                          {email.llmSummary}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {email.bodyPreview?.substring(0, 80)}
                        </p>
                      )}
                      {email.actionRequired && (
                        <p className="text-xs text-amber-400 mt-1">
                          &rarr; {email.actionRequired}
                        </p>
                      )}
                    </td>

                    {/* Intent bar */}
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${barColor}`}
                            style={{ width: `${intentPct}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-300 min-w-[16px] text-right">
                          {email.signalScore}
                        </span>
                      </div>
                      {email.buyingIntent && email.buyingIntent !== "none" && (
                        <p className="text-[10px] text-indigo-400 mt-1 truncate max-w-[140px]">
                          {email.buyingIntent}
                        </p>
                      )}
                    </td>

                    {/* Stage */}
                    <td className="py-3 pr-4">
                      {email.buyingStage &&
                        email.buyingStage !== "no-signal" && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded capitalize ${getStageStyle(email.buyingStage)}`}
                          >
                            {email.buyingStage}
                          </span>
                        )}
                    </td>

                    {/* Date */}
                    <td className="py-3 whitespace-nowrap">
                      <span className="text-xs text-slate-400">
                        {format(
                          new Date(email.receivedDateTime),
                          "MMM d"
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-800">
              <p className="text-sm text-slate-500">
                Showing {currentPage * PAGE_SIZE + 1}–
                {Math.min((currentPage + 1) * PAGE_SIZE, filteredEmails.length)} of{" "}
                {filteredEmails.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                  className="flex items-center gap-1 text-sm text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:hover:bg-slate-800 disabled:hover:text-slate-400"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Prev
                </button>
                <span className="text-sm text-slate-400 min-w-[60px] text-center">
                  {currentPage + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, currentPage + 1))}
                  disabled={currentPage >= totalPages - 1}
                  className="flex items-center gap-1 text-sm text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:hover:bg-slate-800 disabled:hover:text-slate-400"
                >
                  Next
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
