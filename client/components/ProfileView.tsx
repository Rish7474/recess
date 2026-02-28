"use client";

import { useState, useMemo } from "react";
import CalendarGrid from "./CalendarGrid";

export interface HistoryEntry {
  date: string | null;
  dropTitle: string;
  dropLore: string;
  engine: string;
  score: number;
  percentile: number;
  badge: string;
}

export interface ProfileData {
  user: {
    displayName: string;
    avatarUrl: string | null;
    createdAt: string;
  };
  history: HistoryEntry[];
}

const ENGINE_LABELS: Record<string, string> = {
  agario: "Battle Royale",
  falling_sky: "Survival",
  gold_rush: "Collection",
};

const BADGE_CONFIG: { key: string; label: string; emoji: string }[] = [
  { key: "gold", label: "Gold", emoji: "\u{1F947}" },
  { key: "silver", label: "Silver", emoji: "\u{1F948}" },
  { key: "bronze", label: "Bronze", emoji: "\u{1F949}" },
  { key: "participant", label: "Played", emoji: "\u{1F3AE}" },
];

export default function ProfileView({ data }: { data: ProfileData }) {
  const { user, history } = data;
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const stats = useMemo(() => {
    if (history.length === 0) {
      return { gamesPlayed: 0, avgPercentile: 0, bestScore: 0 };
    }
    const total = history.length;
    const avgPercentile = Math.round(
      history.reduce((sum, h) => sum + (h.percentile || 0), 0) / total
    );
    const bestScore = Math.max(...history.map((h) => h.score));
    return { gamesPlayed: total, avgPercentile, bestScore };
  }, [history]);

  const badgeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const h of history) {
      if (h.badge) counts[h.badge] = (counts[h.badge] || 0) + 1;
    }
    return counts;
  }, [history]);

  const selectedEntry = useMemo(() => {
    if (!selectedDate) return null;
    return history.find((h) => h.date === selectedDate) || null;
  }, [selectedDate, history]);

  const memberSince = new Date(user.createdAt).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="w-full max-w-2xl flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.displayName}
            className="w-16 h-16 rounded-full"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-surface border border-border flex items-center justify-center text-2xl font-bold text-muted">
            {user.displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {user.displayName}
          </h1>
          <p className="text-sm text-muted">Playing since {memberSince}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-surface border border-border p-4 text-center">
          <p className="text-2xl font-bold text-foreground">
            {stats.gamesPlayed}
          </p>
          <p className="text-xs text-muted mt-1">Games Played</p>
        </div>
        <div className="rounded-xl bg-surface border border-border p-4 text-center">
          <p className="text-2xl font-bold text-accent">
            {stats.avgPercentile}%
          </p>
          <p className="text-xs text-muted mt-1">Avg Percentile</p>
        </div>
        <div className="rounded-xl bg-surface border border-border p-4 text-center">
          <p className="text-2xl font-bold text-foreground">
            {stats.bestScore.toLocaleString()}
          </p>
          <p className="text-xs text-muted mt-1">Best Score</p>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        {BADGE_CONFIG.map((b) => {
          const count = badgeCounts[b.key] || 0;
          return (
            <div
              key={b.key}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-border text-sm"
            >
              <span>{b.emoji}</span>
              <span className="text-muted">{b.label}</span>
              <span className="font-semibold text-foreground">{count}</span>
            </div>
          );
        })}
      </div>

      {/* Calendar */}
      <div>
        <p className="text-xs uppercase tracking-wider text-muted mb-3">
          Activity — Last 90 Days
        </p>
        <CalendarGrid
          history={history}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      </div>

      {/* Selected Day Detail */}
      {selectedEntry && (
        <div className="rounded-xl bg-surface border border-border p-5 animate-in fade-in duration-200">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-muted">
                {new Date(selectedEntry.date + "T12:00:00").toLocaleDateString(
                  "en-US",
                  { weekday: "long", month: "long", day: "numeric" }
                )}
              </p>
              <h3 className="text-lg font-semibold text-foreground">
                {selectedEntry.dropTitle}
              </h3>
              {selectedEntry.dropLore && (
                <p className="text-sm text-muted mt-0.5">
                  {selectedEntry.dropLore}
                </p>
              )}
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-background text-muted">
              {ENGINE_LABELS[selectedEntry.engine] || selectedEntry.engine}
            </span>
          </div>
          <div className="flex gap-4">
            <div>
              <p className="text-xl font-bold text-foreground">
                {selectedEntry.score.toLocaleString()}
              </p>
              <p className="text-xs text-muted">Score</p>
            </div>
            <div>
              <p className="text-xl font-bold text-accent">
                {selectedEntry.percentile}%
              </p>
              <p className="text-xs text-muted">Percentile</p>
            </div>
            {selectedEntry.badge && selectedEntry.badge !== "participant" && (
              <div>
                <p className="text-xl">
                  {selectedEntry.badge === "gold"
                    ? "\u{1F947}"
                    : selectedEntry.badge === "silver"
                      ? "\u{1F948}"
                      : "\u{1F949}"}
                </p>
                <p className="text-xs text-muted capitalize">
                  {selectedEntry.badge}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {history.length === 0 && (
        <div className="rounded-xl bg-surface border border-border p-8 text-center">
          <p className="text-muted">
            No games played yet. Join a Recess at 6 PM EST!
          </p>
        </div>
      )}
    </div>
  );
}
