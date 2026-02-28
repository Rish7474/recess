"use client";

import { useEffect, useState } from "react";

function getNextDrop(): Date {
  const now = new Date();
  const eastern = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  );

  const drop = new Date(eastern);
  drop.setHours(18, 0, 0, 0);

  if (eastern >= drop) {
    drop.setDate(drop.getDate() + 1);
  }

  const offset = drop.getTime() - eastern.getTime();
  return new Date(now.getTime() + offset);
}

function formatTime(ms: number) {
  if (ms <= 0) return { hours: "00", minutes: "00", seconds: "00" };

  const totalSeconds = Math.floor(ms / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(
    2,
    "0"
  );
  const seconds = String(totalSeconds % 60).padStart(2, "0");

  return { hours, minutes, seconds };
}

export default function Countdown() {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    const update = () => {
      const target = getNextDrop();
      setTimeLeft(target.getTime() - Date.now());
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  if (timeLeft === null) {
    return (
      <div className="text-center">
        <div className="text-5xl font-mono font-bold tracking-widest text-muted">
          --:--:--
        </div>
      </div>
    );
  }

  const { hours, minutes, seconds } = formatTime(timeLeft);

  return (
    <div className="text-center">
      <div className="text-6xl sm:text-7xl font-mono font-bold tracking-widest">
        <span className="text-foreground">{hours}</span>
        <span className="text-muted mx-1">:</span>
        <span className="text-foreground">{minutes}</span>
        <span className="text-muted mx-1">:</span>
        <span className="text-foreground">{seconds}</span>
      </div>
      <p className="mt-3 text-sm text-muted uppercase tracking-wider">
        Until the next recess
      </p>
    </div>
  );
}
