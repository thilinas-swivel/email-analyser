"use client";

import { EmailCategory } from "@/lib/types";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Mail, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

interface Props {
  categories: EmailCategory[];
  distribution: { name: string; value: number }[];
}

export default function UnreadSection({ categories, distribution }: Props) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const total = categories.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
          <Mail className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Unread by Category</h2>
          <p className="text-sm text-slate-400">{total} unread emails</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pie chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categories}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
              >
                {categories.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  color: "#fff",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Category list */}
        <div className="space-y-2 max-h-64 overflow-y-auto pr-2 scrollbar-thin">
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

      {/* Importance distribution */}
      <div className="mt-6 pt-4 border-t border-slate-800">
        <p className="text-sm text-slate-400 mb-3">By Importance</p>
        <div className="flex gap-4">
          {distribution.map((d) => (
            <div
              key={d.name}
              className="flex items-center gap-2"
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  d.name === "High"
                    ? "bg-red-400"
                    : d.name === "Normal"
                    ? "bg-blue-400"
                    : "bg-slate-400"
                }`}
              />
              <span className="text-xs text-slate-400">
                {d.name}: {d.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
