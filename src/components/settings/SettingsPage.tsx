"use client";

import { useState } from "react";
import { PromptSettings } from "@/lib/types";
import {
  loadSettings,
  saveSettings,
  DEFAULT_SETTINGS,
} from "@/lib/prompt-settings";
import {
  ArrowLeft,
  Save,
  RotateCcw,
  Tag,
  ShoppingCart,
  AlertTriangle,
  FileText,
  X,
  Plus,
  Check,
  Filter,
} from "lucide-react";
import Link from "next/link";

interface FieldConfig {
  key: keyof Omit<PromptSettings, "customKeywords">;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const FIELDS: FieldConfig[] = [
  {
    key: "categorizationPrompt",
    label: "Email Categorization",
    description:
      "Guides how the LLM categorizes emails into groups (Finance, Client, Internal, etc.)",
    icon: Tag,
    color: "text-blue-400",
  },
  {
    key: "buyingSignalPrompt",
    label: "Buying Signal Detection",
    description:
      "Defines how the LLM scores buying intent (0-10) and detects purchase signals",
    icon: ShoppingCart,
    color: "text-emerald-400",
  },
  {
    key: "priorityPrompt",
    label: "Priority Assessment",
    description:
      "Controls how the LLM assigns urgency levels (critical/high/medium/low)",
    icon: AlertTriangle,
    color: "text-amber-400",
  },
  {
    key: "executiveSummaryPrompt",
    label: "Executive Summary",
    description:
      "Shapes the AI-generated executive briefing at the top of the dashboard",
    icon: FileText,
    color: "text-purple-400",
  },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<PromptSettings>(() => {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;
    return loadSettings();
  });
  const [saved, setSaved] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [newEmailFilter, setNewEmailFilter] = useState("");
  const [newNameFilter, setNewNameFilter] = useState("");

  const handleSave = () => {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateField = (key: keyof PromptSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const addKeyword = () => {
    const kw = newKeyword.trim().toLowerCase();
    if (kw && !settings.customKeywords.includes(kw)) {
      setSettings((prev) => ({
        ...prev,
        customKeywords: [...prev.customKeywords, kw],
      }));
      setNewKeyword("");
    }
  };

  const removeKeyword = (kw: string) => {
    setSettings((prev) => ({
      ...prev,
      customKeywords: prev.customKeywords.filter((k) => k !== kw),
    }));
  };

  const addEmailFilter = () => {
    const f = newEmailFilter.trim().toLowerCase();
    if (f && !settings.noiseEmailFilters.includes(f)) {
      setSettings((prev) => ({
        ...prev,
        noiseEmailFilters: [...prev.noiseEmailFilters, f],
      }));
      setNewEmailFilter("");
    }
  };

  const removeEmailFilter = (f: string) => {
    setSettings((prev) => ({
      ...prev,
      noiseEmailFilters: prev.noiseEmailFilters.filter((x) => x !== f),
    }));
  };

  const addNameFilter = () => {
    const f = newNameFilter.trim().toLowerCase();
    if (f && !settings.noiseNameFilters.includes(f)) {
      setSettings((prev) => ({
        ...prev,
        noiseNameFilters: [...prev.noiseNameFilters, f],
      }));
      setNewNameFilter("");
    }
  };

  const removeNameFilter = (f: string) => {
    setSettings((prev) => ({
      ...prev,
      noiseNameFilters: prev.noiseNameFilters.filter((x) => x !== f),
    }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm hidden sm:inline">Dashboard</span>
            </Link>
            <div className="w-px h-6 bg-slate-700" />
            <h1 className="text-base sm:text-lg font-semibold">AI Prompt Settings</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-white px-2 sm:px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Reset Defaults</span>
            </button>
            <button
              onClick={handleSave}
              className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
                saved
                  ? "bg-emerald-600 text-white"
                  : "bg-blue-600 hover:bg-blue-500 text-white"
              }`}
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Info banner */}
        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 text-sm text-indigo-300">
          Customize the prompts and guidelines that the AI uses to analyze your
          emails. Changes take effect on the next dashboard refresh.
        </div>

        {/* Prompt fields */}
        {FIELDS.map((field) => (
          <div
            key={field.key}
            className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6"
          >
            <div className="flex items-center gap-3 mb-3">
              <field.icon className={`w-5 h-5 ${field.color}`} />
              <div>
                <h2 className="text-base font-semibold text-white">
                  {field.label}
                </h2>
                <p className="text-xs text-slate-400">{field.description}</p>
              </div>
            </div>
            <textarea
              value={settings[field.key] as string}
              onChange={(e) => updateField(field.key, e.target.value)}
              rows={6}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y font-mono leading-relaxed"
            />
          </div>
        ))}

        {/* Custom keywords */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-3">
            <Tag className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-base font-semibold text-white">
                Custom Buying Keywords
              </h2>
              <p className="text-xs text-slate-400">
                Additional keywords for the keyword-based buying signal detector
                (supplements the built-in list)
              </p>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addKeyword()}
              placeholder="Add a keyword..."
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={addKeyword}
              className="flex items-center gap-1 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {settings.customKeywords.length === 0 ? (
              <p className="text-sm text-slate-500">
                No custom keywords added yet.
              </p>
            ) : (
              settings.customKeywords.map((kw) => (
                <span
                  key={kw}
                  className="inline-flex items-center gap-1.5 bg-slate-800 text-slate-300 text-sm px-3 py-1 rounded-lg border border-slate-700"
                >
                  {kw}
                  <button
                    onClick={() => removeKeyword(kw)}
                    className="text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Email Address Filters */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6">
          <div className="flex items-start gap-3 mb-4">
            <Filter className="w-5 h-5 text-cyan-400 mt-0.5" />
            <div>
              <h3 className="font-medium text-white">Email Address Filters</h3>
              <p className="text-sm text-slate-400 mt-1">
                Emails from addresses containing any of these patterns will be
                excluded from Top Senders and analytics. Use partial matches
                like &quot;noreply@&quot; or &quot;microsoft.com&quot;.
              </p>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newEmailFilter}
              onChange={(e) => setNewEmailFilter(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addEmailFilter()}
              placeholder="e.g. noreply@ or slack.com"
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            <button
              onClick={addEmailFilter}
              className="flex items-center gap-1 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {settings.noiseEmailFilters.length === 0 ? (
              <p className="text-sm text-slate-500">
                No email address filters. All senders will appear.
              </p>
            ) : (
              settings.noiseEmailFilters.map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1.5 bg-cyan-950/40 text-cyan-300 text-sm px-3 py-1 rounded-lg border border-cyan-800/50"
                >
                  {f}
                  <button
                    onClick={() => removeEmailFilter(f)}
                    className="text-cyan-600 hover:text-red-400 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Sender Name Filters */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6">
          <div className="flex items-start gap-3 mb-4">
            <Filter className="w-5 h-5 text-amber-400 mt-0.5" />
            <div>
              <h3 className="font-medium text-white">Sender Name Filters</h3>
              <p className="text-sm text-slate-400 mt-1">
                Emails from senders whose name contains any of these patterns
                will be excluded. Useful for filtering system notifications like
                &quot;in Teams&quot; or &quot;Power BI&quot;.
              </p>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newNameFilter}
              onChange={(e) => setNewNameFilter(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addNameFilter()}
              placeholder="e.g. in teams or power bi"
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <button
              onClick={addNameFilter}
              className="flex items-center gap-1 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {settings.noiseNameFilters.length === 0 ? (
              <p className="text-sm text-slate-500">
                No sender name filters. All senders will appear.
              </p>
            ) : (
              settings.noiseNameFilters.map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1.5 bg-amber-950/40 text-amber-300 text-sm px-3 py-1 rounded-lg border border-amber-800/50"
                >
                  {f}
                  <button
                    onClick={() => removeNameFilter(f)}
                    className="text-amber-600 hover:text-red-400 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
