"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { format, subMonths, subDays, startOfYear, isValid } from "date-fns";

export interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

interface Props {
  value: DateRange;
  onChange: (range: DateRange) => void;
  /** Earliest selectable date (from settings). Presets and custom ranges are clamped to this. */
  minDate?: Date;
}

function toDateInputStr(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function getDefaultRange(): DateRange {
  const now = new Date();
  return {
    start: subMonths(now, 1),
    end: now,
    label: "Last Month",
  };
}

/** Returns a \"This Week\" range (last 7 days from now). */
export function getCurrentWeekRange(): DateRange {
  const now = new Date();
  return {
    start: subDays(now, 7),
    end: now,
    label: "This Week",
  };
}

export function getRangeFromStartDate(startDate: string): DateRange {
  const now = new Date();
  const parsedStart = new Date(`${startDate}T00:00:00`);

  if (!isValid(parsedStart) || parsedStart > now) {
    return getDefaultRange();
  }

  return {
    start: parsedStart,
    end: now,
    label: `Since ${format(parsedStart, "MMM d, yyyy")}`,
  };
}

const PRESETS: { label: string; getRange: () => Omit<DateRange, "label"> }[] = [
  {
    label: "This Week",
    getRange: () => ({ start: subDays(new Date(), 7), end: new Date() }),
  },
  {
    label: "Last 7 Days",
    getRange: () => ({ start: subDays(new Date(), 7), end: new Date() }),
  },
  {
    label: "Last Month",
    getRange: () => ({ start: subMonths(new Date(), 1), end: new Date() }),
  },
  {
    label: "Last 3 Months",
    getRange: () => ({ start: subMonths(new Date(), 3), end: new Date() }),
  },
  {
    label: "Last 6 Months",
    getRange: () => ({ start: subMonths(new Date(), 6), end: new Date() }),
  },
  {
    label: "This Year",
    getRange: () => ({ start: startOfYear(new Date()), end: new Date() }),
  },
];

export default function DateRangePicker({ value, onChange, minDate }: Props) {
  const [open, setOpen] = useState(false);
  const [customStart, setCustomStart] = useState(toDateInputStr(value.start));
  const [customEnd, setCustomEnd] = useState(toDateInputStr(value.end));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    const r = preset.getRange();
    // Clamp start to minDate
    const start = minDate && r.start < minDate ? minDate : r.start;
    onChange({ start, end: r.end, label: preset.label });
    setCustomStart(toDateInputStr(start));
    setCustomEnd(toDateInputStr(r.end));
    setOpen(false);
  };

  const applyCustom = () => {
    let s = new Date(customStart);
    const e = new Date(customEnd);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return;
    // Clamp start to minDate
    if (minDate && s < minDate) s = minDate;
    onChange({
      start: s,
      end: e,
      label: `${format(s, "MMM d")} \u2013 ${format(e, "MMM d, yyyy")}`,
    });
    setOpen(false);
  };

  // Filter out presets whose start would be before minDate
  const availablePresets = minDate
    ? PRESETS.filter((p) => p.getRange().start >= minDate)
    : PRESETS;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          if (!open) {
            setCustomStart(toDateInputStr(value.start));
            setCustomEnd(toDateInputStr(value.end));
          }
          setOpen((o) => !o);
        }}
        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm py-2 px-3 rounded-lg transition-colors border border-slate-700"
      >
        <Calendar className="w-4 h-4 text-slate-400" />
        <span>
          {format(value.start, "MMM d")} – {format(value.end, "MMM d, yyyy")}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-72 max-w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-4">
          {/* Presets */}
          <div className="space-y-1 mb-4">
            {availablePresets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => applyPreset(preset)}
                className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                  value.label === preset.label
                    ? "bg-blue-600/20 text-blue-400"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom range */}
          <div className="border-t border-slate-700 pt-3">
            <p className="text-xs text-slate-500 mb-2 font-medium">
              Custom Range
            </p>
            <div className="flex gap-2 mb-3">
              <input
                type="date"
                value={customStart}
                min={minDate ? toDateInputStr(minDate) : undefined}
                onChange={(e) => setCustomStart(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={applyCustom}
              className="w-full text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white py-1.5 rounded-lg transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
