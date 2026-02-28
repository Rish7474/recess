"use client";

import { useMemo } from "react";
import type { HistoryEntry } from "./ProfileView";

interface CalendarGridProps {
  history: HistoryEntry[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}

interface DayData {
  percentile: number;
  badge: string;
  score: number;
}

const DAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function CalendarGrid({
  history,
  selectedDate,
  onSelectDate,
}: CalendarGridProps) {
  const { days, dayMap, weeks } = useMemo(() => {
    const map = new Map<string, DayData>();
    for (const h of history) {
      if (h.date) {
        map.set(h.date, {
          percentile: h.percentile,
          badge: h.badge,
          score: h.score,
        });
      }
    }

    const today = new Date();
    today.setHours(12, 0, 0, 0);

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 89);

    const dayOfWeek = startDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startDate.setDate(startDate.getDate() + mondayOffset);

    const allDays: { date: string; inRange: boolean }[] = [];
    const cursor = new Date(startDate);

    const rangeStart = new Date(today);
    rangeStart.setDate(rangeStart.getDate() - 89);
    const rangeStartStr = toDateStr(rangeStart);
    const todayStr = toDateStr(today);

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + (6 - ((today.getDay() + 6) % 7)));

    while (cursor <= endDate) {
      const ds = toDateStr(cursor);
      allDays.push({
        date: ds,
        inRange: ds >= rangeStartStr && ds <= todayStr,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    const weekCount = Math.ceil(allDays.length / 7);

    return { days: allDays, dayMap: map, weeks: weekCount };
  }, [history]);

  function getAccentOpacity(percentile: number): number {
    return 0.2 + (percentile / 100) * 0.8;
  }

  function getBadgeIcon(badge: string): string | null {
    if (badge === "gold") return "\u{1F947}";
    if (badge === "silver") return "\u{1F948}";
    if (badge === "bronze") return "\u{1F949}";
    return null;
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {/* Day labels */}
      <div className="flex flex-col gap-[3px] text-[10px] text-muted pt-0">
        {DAY_LABELS.map((label, i) => (
          <div
            key={i}
            className="h-[14px] flex items-center justify-end pr-1"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div
        className="grid gap-[3px]"
        style={{
          gridTemplateRows: "repeat(7, 14px)",
          gridTemplateColumns: `repeat(${weeks}, 14px)`,
          gridAutoFlow: "column",
        }}
      >
        {days.map((day) => {
          const data = dayMap.get(day.date);
          const isSelected = selectedDate === day.date;
          const icon = data ? getBadgeIcon(data.badge) : null;

          if (!day.inRange) {
            return <div key={day.date} className="w-[14px] h-[14px]" />;
          }

          return (
            <button
              key={day.date}
              onClick={() =>
                data
                  ? onSelectDate(isSelected ? null : day.date)
                  : undefined
              }
              className={`
                w-[14px] h-[14px] rounded-[3px] relative transition-all
                ${!data ? "bg-surface border border-border" : "cursor-pointer"}
                ${isSelected ? "ring-1 ring-foreground ring-offset-1 ring-offset-background" : ""}
              `}
              style={
                data
                  ? {
                      backgroundColor: `color-mix(in srgb, var(--color-accent) ${Math.round(getAccentOpacity(data.percentile) * 100)}%, transparent)`,
                    }
                  : undefined
              }
              title={
                data
                  ? `${day.date}: Score ${data.score.toLocaleString()}, ${data.percentile}th percentile`
                  : day.date
              }
            >
              {icon && (
                <span className="absolute inset-0 flex items-center justify-center text-[8px] leading-none">
                  {icon}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
