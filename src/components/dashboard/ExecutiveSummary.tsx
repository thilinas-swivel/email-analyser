"use client";

import { Sparkles, Loader2 } from "lucide-react";

interface Props {
  summary?: string;
  isEnriched?: boolean;
  aiLoading: boolean;
}

export default function ExecutiveSummary({
  summary,
  isEnriched,
  aiLoading,
}: Props) {
  if (!aiLoading && !summary) return null;

  return (
    <div className="mt-6 mb-6">
      <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center">
            {aiLoading ? (
              <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 text-indigo-400" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-white">
              AI Executive Briefing
            </h2>
            {isEnriched && (
              <span className="text-[10px] font-medium bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">
                Powered by Claude
              </span>
            )}
          </div>
        </div>
        {aiLoading ? (
          <div className="flex items-center gap-2">
            <div className="h-4 bg-slate-800 rounded animate-pulse w-3/4" />
          </div>
        ) : (
          <p className="text-sm text-slate-300 leading-relaxed">{summary}</p>
        )}
      </div>
    </div>
  );
}
