"use client";

import { ScopeBreakdown, SenderStat } from "@/lib/types";
import { Users } from "lucide-react";

interface Props {
  senders: SenderStat[];
  scopedSenders?: ScopeBreakdown<SenderStat[]>;
  showSplit?: boolean;
}

function SenderList({ senders }: { senders: SenderStat[] }) {
  const maxCount = senders.length > 0 ? senders[0].count : 1;

  if (senders.length === 0) {
    return <p className="text-sm text-slate-500">No senders in this scope.</p>;
  }

  return (
    <div className="space-y-3">
      {senders.map((sender, index) => (
        <div key={sender.email} className="flex items-center gap-3">
          <span className="text-xs text-slate-500 w-5 text-right">
            {index + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm text-white truncate">{sender.name}</p>
              <span className="text-xs text-slate-400 ml-2">
                {sender.count}
              </span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 rounded-full transition-all"
                style={{
                  width: `${(sender.count / maxCount) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TopSendersTable({ senders, scopedSenders, showSplit }: Props) {

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <div className="w-10 h-10 bg-cyan-500/10 rounded-lg flex items-center justify-center">
          <Users className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Top Senders</h2>
          <p className="text-sm text-slate-400">
            {showSplit ? "Separated by internal and external" : "Most active contacts"}
          </p>
        </div>
      </div>

      {showSplit && scopedSenders ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-violet-300">Internal</h3>
              <span className="text-xs text-slate-500">{scopedSenders.internal.length} senders</span>
            </div>
            <SenderList senders={scopedSenders.internal} />
          </div>
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-cyan-300">External</h3>
              <span className="text-xs text-slate-500">{scopedSenders.external.length} senders</span>
            </div>
            <SenderList senders={scopedSenders.external} />
          </div>
        </div>
      ) : (
        <SenderList senders={senders} />
      )}
    </div>
  );
}
