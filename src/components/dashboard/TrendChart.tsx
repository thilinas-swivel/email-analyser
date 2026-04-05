"use client";

import { ScopeBreakdown, TrendPoint } from "@/lib/types";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { useMemo } from "react";

interface Props {
  data: TrendPoint[];
  scopedData?: ScopeBreakdown<TrendPoint[]>;
  rangeLabel?: string;
  showSplit?: boolean;
}

export default function TrendChart({ data, scopedData, rangeLabel, showSplit }: Props) {
  const mergedScopedData = useMemo(() => {
    if (!showSplit || !scopedData) return [];
    return data.map((point, index) => ({
      date: point.date,
      internal: scopedData.internal[index]?.count ?? 0,
      external: scopedData.external[index]?.count ?? 0,
    }));
  }, [data, scopedData, showSplit]);

  const internalTotal = scopedData?.internal.reduce((sum, point) => sum + point.count, 0) ?? 0;
  const externalTotal = scopedData?.external.reduce((sum, point) => sum + point.count, 0) ?? 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">
            Unread Email Trend
          </h2>
          <p className="text-sm text-slate-400">{rangeLabel || "Selected period"}</p>
          {showSplit && scopedData && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-violet-500/15 px-2 py-1 text-violet-300">
                Internal: {internalTotal}
              </span>
              <span className="rounded-full bg-cyan-500/15 px-2 py-1 text-cyan-300">
                External: {externalTotal}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="h-48 sm:h-56 md:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={(showSplit && mergedScopedData.length > 0 ? mergedScopedData : data) as Record<string, unknown>[]}>
            <defs>
              <linearGradient id="unreadGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="internalUnreadGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="externalUnreadGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#fff",
              }}
            />
            {showSplit && mergedScopedData.length > 0 ? (
              <>
                <Area
                  type="monotone"
                  dataKey="internal"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fill="url(#internalUnreadGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="external"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  fill="url(#externalUnreadGradient)"
                />
              </>
            ) : (
              <Area
                type="monotone"
                dataKey="count"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#unreadGradient)"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
