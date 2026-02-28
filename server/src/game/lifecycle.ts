import { Server } from "socket.io";
import { getPlayerCount, getPlayerSockets, getPlayerNames } from "../socket";
import { GameEngine, BaseGameState, PlayerInput } from "../engines/types";
import { agarioEngine } from "../engines/agario";
import { supabaseAdmin } from "../lib/supabase";

export interface GameStartPayload {
  dropId?: string;
  engine: string;
  params: Record<string, unknown>;
  theme: Record<string, string>;
  duration: number;
  title?: string;
  lore?: string;
}

export interface GameEndPayload {
  dropId: string;
}

const TICK_RATE_MS = 67; // 15Hz

const engines: Record<string, GameEngine<any>> = {
  agario: agarioEngine,
};

let activeGame: {
  dropId: string;
  engineName: string;
  engine: GameEngine<any>;
  state: BaseGameState;
  tickInterval: ReturnType<typeof setInterval>;
  endTimeout: ReturnType<typeof setTimeout>;
  theme: Record<string, string>;
  players: Set<string>;
} | null = null;

export function isGameActive(): boolean {
  return activeGame !== null;
}

export function handlePlayerInput(playerId: string, input: PlayerInput) {
  if (!activeGame) return;
  activeGame.players.add(playerId);
  activeGame.engine.processInput(activeGame.state, playerId, input);
}

export function handlePlayerJoin(playerId: string) {
  if (!activeGame) return;
  activeGame.players.add(playerId);
  if (activeGame.engine.onPlayerJoin) {
    activeGame.engine.onPlayerJoin(activeGame.state, playerId);
  }
}

export function handlePlayerLeave(playerId: string) {
  if (!activeGame) return;
  if (activeGame.engine.onPlayerLeave) {
    activeGame.engine.onPlayerLeave(activeGame.state, playerId);
  }
}

export async function startGame(io: Server, payload: GameStartPayload) {
  if (activeGame) {
    console.warn("[lifecycle] game already active, ignoring start");
    return;
  }

  const engine = engines[payload.engine];
  if (!engine) {
    console.error(`[lifecycle] unknown engine: ${payload.engine}`);
    return;
  }

  // Create a drops row in Supabase if no dropId provided
  let dropId = payload.dropId;
  if (!dropId) {
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/New_York",
    });

    const { data, error } = await supabaseAdmin
      .from("drops")
      .insert({
        date: today,
        engine: payload.engine,
        title: payload.title || "Recess",
        lore: payload.lore || "",
        theme: payload.theme,
        params: payload.params,
        duration: payload.duration,
        status: "active",
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error("[lifecycle] failed to create drops row:", error?.message);
      // Fall back to a temporary ID so the game still works
      dropId = crypto.randomUUID();
    } else {
      dropId = data.id;
      console.log(`[lifecycle] created drops row: ${dropId}`);
    }
  }

  const playerCount = getPlayerCount();
  console.log(
    `[lifecycle] starting ${payload.engine} — players=${playerCount}, duration=${payload.duration}s, dropId=${dropId}`
  );

  const state = engine.initState(payload.params, playerCount, payload.duration);

  const playerSockets = getPlayerSockets();
  for (const [socketId] of playerSockets) {
    if (engine.onPlayerJoin) {
      engine.onPlayerJoin(state, socketId);
    }
  }

  io.emit("game_start", {
    dropId,
    engine: payload.engine,
    params: payload.params,
    theme: payload.theme,
    startsAt: Date.now(),
    playerCount,
    duration: payload.duration,
  });

  const tickInterval = setInterval(() => {
    engine.tick(state, TICK_RATE_MS);
    io.emit("state_update", engine.getClientState(state, getPlayerNames()));
  }, TICK_RATE_MS);

  const endTimeout = setTimeout(() => {
    endGame(io, { dropId: dropId! });
  }, payload.duration * 1000);

  const gamePlayers = new Set<string>();

  activeGame = {
    dropId: dropId!,
    engineName: payload.engine,
    engine,
    state,
    tickInterval,
    endTimeout,
    theme: payload.theme,
    players: gamePlayers,
  };
}

export async function endGame(io: Server, payload: GameEndPayload) {
  if (!activeGame) {
    console.warn("[lifecycle] no active game to end");
    return;
  }

  clearInterval(activeGame.tickInterval);
  clearTimeout(activeGame.endTimeout);

  const { engine, state, players, dropId } = activeGame;
  const playerSockets = getPlayerSockets();
  const names = getPlayerNames();

  const scores: { socketId: string; userId: string; name: string; score: number }[] = [];
  for (const socketId of players) {
    const userId = playerSockets.get(socketId) || socketId;
    scores.push({
      socketId,
      userId,
      name: names.get(socketId) || "",
      score: engine.getScore(state, socketId),
    });
  }
  scores.sort((a, b) => b.score - a.score);

  const totalPlayers = scores.length;

  const scoredResults = scores.map((s, index) => ({
    ...s,
    percentile: totalPlayers > 1
      ? Math.round(((totalPlayers - 1 - index) / (totalPlayers - 1)) * 100)
      : 100,
  }));

  const topThree = scoredResults.slice(0, 3).map((s, i) => ({
    rank: i + 1,
    userId: s.userId,
    name: s.name,
    score: s.score,
  }));

  console.log(
    `[lifecycle] game_over — dropId=${dropId}, players scored=${totalPlayers}`
  );

  io.emit("game_over", {
    dropId,
    totalPlayers,
    scores: scoredResults.map((s) => ({
      socketId: s.socketId,
      userId: s.userId,
      name: s.name,
      score: s.score,
      percentile: s.percentile,
    })),
    topThree,
  });

  // Persist scores to Supabase for authenticated users
  const dbScores: {
    user_id: string;
    drop_id: string;
    raw_score: number;
    percentile: number;
    badge: string;
  }[] = [];

  for (let i = 0; i < scoredResults.length; i++) {
    const s = scoredResults[i];
    // Only persist if this is a real Supabase user (UUID format, not a socket ID)
    const isAuthUser = s.userId !== s.socketId && s.userId.includes("-");
    if (!isAuthUser) continue;

    let badge = "participant";
    if (i === 0) badge = "gold";
    else if (i === 1) badge = "silver";
    else if (i === 2) badge = "bronze";

    dbScores.push({
      user_id: s.userId,
      drop_id: dropId,
      raw_score: s.score,
      percentile: s.percentile,
      badge,
    });
  }

  if (dbScores.length > 0) {
    const { error } = await supabaseAdmin
      .from("scores")
      .upsert(dbScores, { onConflict: "user_id,drop_id" });

    if (error) {
      console.error("[lifecycle] failed to persist scores:", error.message);
    } else {
      console.log(`[lifecycle] persisted ${dbScores.length} scores to DB`);
    }
  }

  // Update drops row with total players and status
  await supabaseAdmin
    .from("drops")
    .update({ total_players: totalPlayers, status: "completed" })
    .eq("id", dropId);

  activeGame = null;
}
