"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import {
  render,
  createCamera,
  updateCamera,
  clearInterpolation,
  drawMobileButtons,
  hitTestMobileButton,
  type AgarioClientState,
  type Camera,
  type Theme,
} from "@/engines/agario";

const SEND_RATE_MS = 67; // ~15Hz input send rate

export default function GameCanvas() {
  const { socket, gamePayload, latestState, playerName } = useSocket();
  const [waiting, setWaiting] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<AgarioClientState | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const rafRef = useRef<number>(0);
  const lastSendRef = useRef<number>(0);
  const mouseWorldRef = useRef<{ x: number; y: number }>({ x: 2500, y: 2500 });
  const isMobileRef = useRef(false);
  const splitPressedRef = useRef(false);
  const ejectPressedRef = useRef(false);
  const socketIdRef = useRef<string>("");
  const playerNamesRef = useRef<Map<string, string>>(new Map());

  const theme: Theme = {
    background: gamePayload?.theme?.background || "#111118",
    accent: gamePayload?.theme?.accent || "#ff3366",
    grid: gamePayload?.theme?.grid || "#1a1a24",
  };
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    if (socket?.id) {
      socketIdRef.current = socket.id;
    }
  }, [socket?.id]);

  useEffect(() => {
    if (latestState) {
      if (waiting) setWaiting(false);
      const state = latestState as unknown as AgarioClientState;
      stateRef.current = state;

      // Build player names from leaderboard data
      if (state.leaderboard) {
        for (const entry of state.leaderboard) {
          if (entry.name) {
            playerNamesRef.current.set(entry.id, entry.name);
          }
        }
      }
      // Always set own name
      if (socketIdRef.current && playerName) {
        playerNamesRef.current.set(socketIdRef.current, playerName);
      }
    }
  }, [latestState, playerName]);

  const screenToWorld = useCallback(
    (screenX: number, screenY: number): { x: number; y: number } => {
      const camera = cameraRef.current;
      if (!camera) return { x: 2500, y: 2500 };
      const w = window.innerWidth;
      const h = window.innerHeight;
      const worldX = (screenX - w / 2) / camera.zoom + camera.x;
      const worldY = (screenY - h / 2) / camera.zoom + camera.y;
      return { x: worldX, y: worldY };
    },
    []
  );

  const sendMove = useCallback(
    (screenX: number, screenY: number) => {
      const world = screenToWorld(screenX, screenY);
      mouseWorldRef.current = world;

      const now = performance.now();
      if (now - lastSendRef.current < SEND_RATE_MS) return;
      lastSendRef.current = now;

      if (socket) {
        socket.emit("player_input", {
          type: "move",
          x: world.x,
          y: world.y,
        });
      }
    },
    [socket, screenToWorld]
  );

  const handleSplit = useCallback(() => {
    if (socket) {
      socket.emit("player_input", { type: "split" });
    }
  }, [socket]);

  const handleEject = useCallback(() => {
    if (socket) {
      socket.emit("player_input", { type: "eject" });
    }
  }, [socket]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    isMobileRef.current = "ontouchstart" in window;
    clearInterpolation();

    const worldSize =
      (gamePayload?.params?.world_size as number) || 5000;
    cameraRef.current = createCamera(worldSize);

    const setCanvasSize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    };
    setCanvasSize();
    window.addEventListener("resize", setCanvasSize);

    // Mouse handlers (desktop)
    const onMouseMove = (e: MouseEvent) => {
      sendMove(e.clientX, e.clientY);
    };

    // Touch handlers (mobile)
    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;

      const btn = hitTestMobileButton(
        touch.clientX,
        touch.clientY,
        window.innerWidth,
        window.innerHeight
      );
      if (btn === "split") {
        e.preventDefault();
        splitPressedRef.current = true;
        handleSplit();
        setTimeout(() => (splitPressedRef.current = false), 150);
        return;
      }
      if (btn === "eject") {
        e.preventDefault();
        ejectPressedRef.current = true;
        handleEject();
        setTimeout(() => (ejectPressedRef.current = false), 150);
        return;
      }

      e.preventDefault();
      sendMove(touch.clientX, touch.clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (touch) sendMove(touch.clientX, touch.clientY);
    };

    // Keyboard handlers
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        handleSplit();
      } else if (e.code === "KeyW") {
        handleEject();
      }
    };

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKeyDown);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const loop = (timestamp: number) => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;

      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      updateCamera(
        cameraRef.current!,
        stateRef.current,
        socketIdRef.current
      );

      render(
        ctx,
        stateRef.current,
        cameraRef.current!,
        socketIdRef.current,
        themeRef.current,
        timestamp,
        playerNamesRef.current
      );

      if (isMobileRef.current) {
        drawMobileButtons(
          ctx,
          w,
          h,
          splitPressedRef.current,
          ejectPressedRef.current
        );
      }

      ctx.restore();
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", setCanvasSize);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [gamePayload, sendMove, handleSplit, handleEject]);

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
          touchAction: "none",
          cursor: "crosshair",
          background: theme.background,
        }}
      />
      {waiting && (
        <div className="fixed inset-0 z-[51] flex items-center justify-center pointer-events-none">
          <p className="text-sm text-muted animate-pulse">Connecting to game...</p>
        </div>
      )}
    </>
  );
}
