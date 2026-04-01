"use client";

import { EmailCategory } from "@/lib/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { MailX, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

interface Props {
  categories: EmailCategory[];
}

export default function UnrepliedSection({ categories }: Props) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const total = categories.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
          <MailX className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">
            Unreplied by Category
          </h2>
          <p className="text-sm text-slate-400">
            {total} emails awaiting response
          </p>
        </div>
      </div>

      {/* Bar chart */}
      <div className="h-56 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={categories.slice(0, 8)}
            layout="vertical"
            margin={{ left: 10, right: 20 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={130}
              tick={{ fill: "#94a3b8", fontSize: 12 }}
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
            <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={20}>
              {categories.slice(0, 8).map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Expandable list */}
      <div className="space-y-1 max-h-48 overflow-y-auto pr-2">
        {categories.map((cat) => (
          <div key={cat.name}>
            <button
              onClick={() =>
                setExpandedCategory(
                  expandedCategory === cat.name ? null : cat.name
                )
              }
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="text-sm text-slate-300">{cat.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">
                  {cat.count}
                </span>
                {expandedCategory === cat.name ? (
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </div>
            </button>
            {expandedCategory === cat.name && (
              <div className="ml-6 mt-1 space-y-1">
                {cat.emails.slice(0, 5).map((email) => (
                  <div
                    key={email.id}
                    className="p-2 bg-slate-800/50 rounded-lg"
                  >
                    <p className="text-xs text-white truncate">
                      {email.subject}
                    </p>
                    <p className="text-xs text-slate-500">
                      {email.from.emailAddress.name} &middot;{" "}
                      {format(
                        new Date(email.receivedDateTime),
                        "MMM d, h:mm a"
                      )}
                    </p>
                  </div>
                ))}
                {cat.emails.length > 5 && (
                  <p className="text-xs text-slate-500 pl-2">
                    +{cat.emails.length - 5} more
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
