"use client";

import { useRef, useEffect, type KeyboardEvent } from "react";
import { useSocket } from "@/hooks/useSocket";

export default function NameEntry() {
  const { playerName, setPlayerName, confirmName, gamePayload } = useSocket();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      confirmName();
    }
  };

  const accent = gamePayload?.theme?.accent || "#ff3366";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-4 animate-in fade-in zoom-in-95 duration-300">
        <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-2xl">
          <div
            className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center"
            style={{ backgroundColor: accent + "22", border: `2px solid ${accent}` }}
          >
            <span className="text-2xl">🎮</span>
          </div>

          <h2 className="text-xl font-bold text-foreground mb-1">
            Recess is starting!
          </h2>
          <p className="text-sm text-muted mb-6">
            Enter your name to join the game
          </p>

          <input
            ref={inputRef}
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Your name"
            maxLength={16}
            className="w-full px-4 py-3 text-center text-lg font-medium rounded-xl bg-background border border-border text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
          />

          <button
            onClick={confirmName}
            className="w-full mt-4 py-3 px-6 text-base font-semibold rounded-xl text-white transition-all hover:brightness-110 active:scale-[0.98] cursor-pointer"
            style={{ backgroundColor: accent }}
          >
            Play
          </button>

          <p className="text-xs text-muted/60 mt-3">
            Leave blank to play as &quot;Anon&quot;
          </p>
        </div>
      </div>
    </div>
  );
}
