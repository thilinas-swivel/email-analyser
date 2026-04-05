"use client";

import { EmailCategory, ScopeBreakdown } from "@/lib/types";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Mail } from "lucide-react";
import { useState } from "react";
import CategoryEmailsModal from "./CategoryEmailsModal";

interface Props {
  categories: EmailCategory[];
  distribution: { name: string; value: number }[];
  scopedCategories?: ScopeBreakdown<EmailCategory[]>;
  showSplit?: boolean;
}

function CategoryList({
  categories,
  onSelect,
}: {
  categories: EmailCategory[];
  onSelect: (category: EmailCategory) => void;
}) {
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto pr-2 scrollbar-thin">
      {categories.length === 0 ? (
        <p className="text-sm text-slate-500">No emails in this scope.</p>
      ) : (
        categories.map((cat) => (
          <button
            key={cat.name}
            onClick={() => onSelect(cat)}
            className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-800 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: cat.color }}
              />
              <span className="text-sm text-slate-300">{cat.name}</span>
            </div>
            <span className="text-sm font-semibold text-white">{cat.count}</span>
          </button>
        ))
      )}
    </div>
  );
}

export default function UnreadSection({ categories, distribution, scopedCategories, showSplit }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<EmailCategory | null>(null);

  const total = categories.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
          <Mail className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Unread by Category</h2>
          <p className="text-sm text-slate-400">{total} unread emails</p>
        </div>
      </div>

      {showSplit && scopedCategories ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {([
            { label: "Internal", tone: "text-violet-300", categories: scopedCategories.internal },
            { label: "External", tone: "text-cyan-300", categories: scopedCategories.external },
          ] as const).map((scope) => {
            const scopeTotal = scope.categories.reduce((sum, category) => sum + category.count, 0);
            return (
              <div key={scope.label} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className={`text-sm font-semibold ${scope.tone}`}>{scope.label}</h3>
                  <span className="text-xs text-slate-500">{scopeTotal} unread</span>
                </div>
                <CategoryList categories={scope.categories} onSelect={setSelectedCategory} />
              </div>
            );
          })}
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pie chart */}
        <div className="h-48 sm:h-56 md:h-64">
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

        {/* Category list - click opens modal */}
        <div className="space-y-2 max-h-64 overflow-y-auto pr-2 scrollbar-thin">
          <CategoryList categories={categories} onSelect={setSelectedCategory} />
        </div>
      </div>
      )}

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

      {/* Modal for category emails */}
      <CategoryEmailsModal
        isOpen={selectedCategory !== null}
        onClose={() => setSelectedCategory(null)}
        categoryName={selectedCategory?.name || ""}
        categoryColor={selectedCategory?.color || "#94a3b8"}
        emails={selectedCategory?.emails || []}
      />
    </div>
  );
}
