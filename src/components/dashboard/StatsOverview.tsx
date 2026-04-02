"use client";

import { DashboardStats } from "@/lib/types";
import {
  MailX,
  Clock,
  ShieldAlert,
  Timer,
  ShoppingCart,
} from "lucide-react";

interface Props {
  stats: DashboardStats;
}

export default function StatsOverview({ stats }: Props) {
  const avgDays =
    stats.avgResponseTime > 0
      ? `${(stats.avgResponseTime / 24).toFixed(1)}d`
      : "—";

  const cards = [
    {
      label: "Total Threads",
      value: stats.totalUnreplied,
      icon: MailX,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
    },
    {
      label: "Critical Urgency",
      value: stats.criticalCount,
      icon: ShieldAlert,
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
    },
    {
      label: "Awaiting Reply >2D",
      value: stats.awaitingReplyOver2d,
      icon: Timer,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
    },
    {
      label: "Buy Intent",
      value: stats.totalBuyingSignals,
      icon: ShoppingCart,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
    {
      label: "Avg Response",
      value: avgDays,
      icon: Clock,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 mt-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`${card.bg} ${card.border} border rounded-xl p-3 sm:p-4`}
        >
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <card.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${card.color}`} />
            <span className="text-xs sm:text-sm text-slate-400">{card.label}</span>
          </div>
          <p className={`text-2xl sm:text-3xl font-bold ${card.color}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}
