"use client";

import { UserProfile } from "@/lib/types";
import { RefreshCw, LogOut, Sparkles, Settings } from "lucide-react";
import { useMsal } from "@azure/msal-react";
import { format } from "date-fns";
import Link from "next/link";

interface Props {
  profile: UserProfile | null;
  lastRefresh: Date | null;
  onRefresh: () => void;
  loading: boolean;
  aiLoading?: boolean;
  dateRangePicker?: React.ReactNode;
}

export default function DashboardHeader({
  profile,
  lastRefresh,
  onRefresh,
  loading,
  aiLoading,
  dateRangePicker,
}: Props) {
  const { instance } = useMsal();

  return (
    <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Email Intelligence Dashboard
            </h1>
            <p className="text-sm text-slate-400">
              {profile?.displayName && (
                <span>
                  {profile.displayName}
                  {profile.jobTitle && (
                    <span className="text-slate-500">
                      {" "}
                      &middot; {profile.jobTitle}
                    </span>
                  )}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {aiLoading && (
            <span className="flex items-center gap-1.5 text-xs text-indigo-400">
              <Sparkles className="w-3 h-3 animate-pulse" />
              AI analyzing...
            </span>
          )}
          {lastRefresh && (
            <span className="text-xs text-slate-500">
              Updated {format(lastRefresh, "h:mm a")}
            </span>
          )}
          {dateRangePicker}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          <Link
            href="/settings"
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm py-2 px-4 rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4" />
          </Link>
          <button
            onClick={() => instance.logoutRedirect()}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm py-2 px-4 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
