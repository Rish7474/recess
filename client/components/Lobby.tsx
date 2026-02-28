"use client";

import { useEffect, useState } from "react";
import Countdown from "./Countdown";
import GameCanvas from "./GameCanvas";
import NameEntry from "./NameEntry";
import GameOverScreen from "./GameOverScreen";
import { useSocket } from "@/hooks/useSocket";

interface Drop {
  id: string;
  date: string;
  engine: string;
  title: string;
  lore: string;
  theme: Record<string, string>;
  status: string;
}

interface LeaderboardEntry {
  score: number;
  percentile: number;
  badge: string;
  displayName: string;
  avatarUrl: string | null;
}

const ENGINE_LABELS: Record<string, string> = {
  agario: "Battle Royale",
  falling_sky: "Survival",
  gold_rush: "Collection",
};

const BADGE_MEDALS: Record<string, string> = {
  gold: "\u{1F947}",
  silver: "\u{1F948}",
  bronze: "\u{1F949}",
};

export default function Lobby() {
  const { playerCount, connected, gameState, gamePayload } = useSocket();
  const [drop, setDrop] = useState<Drop | null>(null);
  const [dropLoading, setDropLoading] = useState(true);
  const [dropError, setDropError] = useState(false);
  const [yesterdayScores, setYesterdayScores] = useState<LeaderboardEntry[]>([]);
  const [yesterdayDrop, setYesterdayDrop] = useState<{ title: string; engine: string } | null>(null);
  const [leaderboardError, setLeaderboardError] = useState(false);

  const serverUrl =
    process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:4000";

  const fetchDrop = () => {
    setDropLoading(true);
    setDropError(false);
    fetch(`${serverUrl}/api/drop/today`)
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data) => setDrop(data.drop))
      .catch(() => { setDrop(null); setDropError(true); })
      .finally(() => setDropLoading(false));
  };

  const fetchLeaderboard = () => {
    setLeaderboardError(false);
    fetch(`${serverUrl}/api/leaderboard/yesterday`)
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data) => {
        setYesterdayDrop(data.drop || null);
        setYesterdayScores(data.scores || []);
      })
      .catch(() => {
        setYesterdayDrop(null);
        setYesterdayScores([]);
        setLeaderboardError(true);
      });
  };

  useEffect(() => {
    fetchDrop();
    fetchLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverUrl]);

  if (gameState === "name_entry" && gamePayload) {
    return <NameEntry />;
  }

  if (gameState === "playing") {
    return <GameCanvas />;
  }

  if (gameState === "results") {
    return <GameOverScreen />;
  }

  return (
    <div className="flex flex-col items-center gap-12">
      {!connected && (
        <div className="w-full max-w-md text-center text-xs text-muted bg-surface border border-border rounded-lg px-4 py-2 animate-pulse">
          Reconnecting to server...
        </div>
      )}
      <Countdown />

      <div className="flex items-center gap-2 text-sm text-muted">
        <span className="relative inline-flex h-2 w-2">
          {connected && (
            <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
          )}
          <span
            className={`relative inline-flex w-2 h-2 rounded-full ${
              connected ? "bg-green-500" : "bg-border"
            }`}
          />
        </span>
        {playerCount} player{playerCount !== 1 ? "s" : ""} online
      </div>

      <div
        className="w-full max-w-md rounded-xl border bg-surface p-6 text-center transition-shadow duration-500"
        style={{
          borderColor: drop?.theme?.accent || undefined,
          boxShadow: drop ? `0 0 20px ${drop.theme?.accent || "#ff3366"}15` : undefined,
        }}
      >
        <p className="text-xs uppercase tracking-wider text-muted mb-3">
          Tonight&apos;s Recess
        </p>
        {dropLoading ? (
          <p className="text-sm text-muted">Loading...</p>
        ) : dropError ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-muted">Could not load tonight&apos;s drop.</p>
            <button onClick={fetchDrop} className="text-xs text-accent hover:underline cursor-pointer">Retry</button>
          </div>
        ) : drop ? (
          <>
            <h2 className="text-xl font-semibold text-foreground mb-1">
              {drop.title}
            </h2>
            <p className="text-sm text-muted mb-3">{drop.lore}</p>
            <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-background text-muted">
              {ENGINE_LABELS[drop.engine] || drop.engine}
            </span>
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Being forged...
            </h2>
            <p className="text-sm text-muted">
              Check back after 3 PM EST to see what&apos;s in store tonight.
            </p>
          </>
        )}
      </div>

      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6">
        <p className="text-xs uppercase tracking-wider text-muted mb-4">
          {yesterdayDrop
            ? `Yesterday — ${yesterdayDrop.title}`
            : "Yesterday\u2019s Leaderboard"}
        </p>
        {leaderboardError ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <p className="text-sm text-muted">Could not load leaderboard.</p>
            <button onClick={fetchLeaderboard} className="text-xs text-accent hover:underline cursor-pointer">Retry</button>
          </div>
        ) : yesterdayScores.length > 0 ? (
          <div className="flex flex-col gap-2">
            {yesterdayScores.slice(0, 5).map((entry, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-background"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-muted w-6">
                    {BADGE_MEDALS[entry.badge] || `#${i + 1}`}
                  </span>
                  {entry.avatarUrl ? (
                    <img
                      src={entry.avatarUrl}
                      alt=""
                      className="w-6 h-6 rounded-full"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-border" />
                  )}
                  <span className="text-sm text-foreground">
                    {entry.displayName}
                  </span>
                </div>
                <span className="text-sm font-mono text-accent">
                  {Number(entry.score).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted text-center py-4">
            No games yet — check back tomorrow!
          </p>
        )}
      </div>
    </div>
  );
}
