"use client";

import { BuyingSignalEmail } from "@/lib/types";
import { TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

const PAGE_SIZE = 10;

interface Props {
  emails: BuyingSignalEmail[];
}

export default function BuyingSignalsSection({ emails }: Props) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(emails.length / PAGE_SIZE));
  const pageEmails = emails.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
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

  const maxScore = Math.max(...emails.map((e) => e.signalScore), 1);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">
            Buying Signals
          </h2>
          <p className="text-sm text-slate-400">
            {emails.length} emails with potential buying intent
          </p>
        </div>
      </div>

      {emails.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500">
            No buying signals detected in recent emails.
          </p>
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
                Showing {page * PAGE_SIZE + 1}–
                {Math.min((page + 1) * PAGE_SIZE, emails.length)} of{" "}
                {emails.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="flex items-center gap-1 text-sm text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:hover:bg-slate-800 disabled:hover:text-slate-400"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Prev
                </button>
                <span className="text-sm text-slate-400 min-w-[60px] text-center">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() =>
                    setPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  disabled={page >= totalPages - 1}
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
