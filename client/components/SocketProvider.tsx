"use client";

import {
  createContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { type Socket } from "socket.io-client";
import { getSocket } from "@/lib/socket";
import { createClient } from "@/lib/supabase";

export type GameState = "lobby" | "name_entry" | "playing" | "results";

export interface GameStartPayload {
  dropId: string;
  engine: string;
  params: Record<string, unknown>;
  theme: Record<string, string>;
  startsAt: number;
  playerCount: number;
  duration: number;
}

export interface ScoreEntry {
  socketId: string;
  userId: string;
  name: string;
  score: number;
  percentile: number;
}

export interface GameResults {
  dropId: string;
  totalPlayers: number;
  scores: ScoreEntry[];
  topThree: { rank: number; userId: string; name: string; score: number }[];
  myScore?: number;
  myPercentile?: number;
}

export interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
  playerCount: number;
  gameState: GameState;
  gamePayload: GameStartPayload | null;
  latestState: Record<string, unknown> | null;
  gameResults: GameResults | null;
  playerName: string;
  setPlayerName: (name: string) => void;
  confirmName: () => void;
  returnToLobby: () => void;
}

export const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connected: false,
  playerCount: 0,
  gameState: "lobby",
  gamePayload: null,
  latestState: null,
  gameResults: null,
  playerName: "",
  setPlayerName: () => {},
  confirmName: () => {},
  returnToLobby: () => {},
});

export default function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [gameState, setGameState] = useState<GameState>("lobby");
  const [gamePayload, setGamePayload] = useState<GameStartPayload | null>(null);
  const [latestState, setLatestState] = useState<Record<string, unknown> | null>(null);
  const [gameResults, setGameResults] = useState<GameResults | null>(null);
  const [playerName, setPlayerName] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const returnToLobby = useCallback(() => {
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    setGameState("lobby");
    setGamePayload(null);
    setGameResults(null);
  }, []);

  const confirmName = useCallback(() => {
    const name = playerName.trim() || "Anon";
    if (socketRef.current) {
      socketRef.current.emit("set_name", name);
    }
    setGameState("playing");
  }, [playerName]);

  const handleGameStart = useCallback((payload: GameStartPayload) => {
    console.log("[socket] game_start", payload);
    setGamePayload(payload);
    setGameResults(null);
    setLatestState(null);
    setGameState("name_entry");
  }, []);

  const handleStateUpdate = useCallback((state: Record<string, unknown>) => {
    setLatestState(state);
  }, []);

  const handleGameOver = useCallback(
    (data: {
      dropId: string;
      totalPlayers: number;
      scores: ScoreEntry[];
      topThree: { rank: number; userId: string; name: string; score: number }[];
    }) => {
      console.log("[socket] game_over", data);

      const sid = socketRef.current?.id;
      const myEntry = data.scores?.find((s) => s.socketId === sid);

      setGameResults({
        dropId: data.dropId,
        totalPlayers: data.totalPlayers || data.scores?.length || 0,
        scores: data.scores || [],
        topThree: data.topThree || [],
        myScore: myEntry?.score,
        myPercentile: myEntry?.percentile,
      });
      setGameState("results");
      setLatestState(null);

      const fallback = setTimeout(() => {
        setGameState("lobby");
        setGamePayload(null);
        setGameResults(null);
      }, 180_000);
      fallbackTimerRef.current = fallback;
    },
    []
  );

  useEffect(() => {
    const s = getSocket();
    const supabase = createClient();
    setSocket(s);
    socketRef.current = s;

    const linkAuth = () => {
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
          s.emit("player_join", { userId: data.user.id });
        }
      });
    };

    s.on("connect", () => {
      setConnected(true);
      linkAuth();
    });
    s.on("reconnect" as string, () => {
      linkAuth();
    });
    s.on("disconnect", () => setConnected(false));
    s.on("player_count", (count: number) => setPlayerCount(count));
    s.on("game_start", handleGameStart);
    s.on("state_update", handleStateUpdate);
    s.on("game_over", handleGameOver);

    s.connect();

    return () => {
      s.off("connect");
      s.off("disconnect");
      s.off("player_count");
      s.off("game_start");
      s.off("state_update");
      s.off("game_over");
      s.disconnect();
    };
  }, [handleGameStart, handleStateUpdate, handleGameOver]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
        playerCount,
        gameState,
        gamePayload,
        latestState,
        gameResults,
        playerName,
        setPlayerName,
        confirmName,
        returnToLobby,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}
