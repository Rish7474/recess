import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { requireAuth, AuthenticatedRequest } from "./middleware/auth";
import { setupSocket } from "./socket";
import { startGame } from "./game/lifecycle";
import { supabaseAdmin } from "./lib/supabase";
import { initCron } from "./cron";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`[http] ${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
  });
  next();
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  },
});

setupSocket(io);

// --- Routes ---

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/me", requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ userId: req.userId, email: req.userEmail });
});

// Today's drop info for the lobby
app.get("/api/drop/today", async (_req, res) => {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });

  const { data, error } = await supabaseAdmin
    .from("drops")
    .select("id, date, engine, title, lore, theme, params, duration, status, total_players")
    .eq("date", today)
    .single();

  if (error || !data) {
    res.json({ drop: null });
    return;
  }

  res.json({ drop: data });
});

// Yesterday's leaderboard
app.get("/api/leaderboard/yesterday", async (_req, res) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });

  const { data: drop } = await supabaseAdmin
    .from("drops")
    .select("id, title, engine")
    .eq("date", dateStr)
    .single();

  if (!drop) {
    res.json({ drop: null, scores: [] });
    return;
  }

  const { data: scores } = await supabaseAdmin
    .from("scores")
    .select("raw_score, percentile, badge, user_id")
    .eq("drop_id", drop.id)
    .order("raw_score", { ascending: false })
    .limit(10);

  if (!scores || scores.length === 0) {
    res.json({ drop, scores: [] });
    return;
  }

  const userIds = scores.map((s) => s.user_id);
  const { data: users } = await supabaseAdmin
    .from("users")
    .select("id, display_name, avatar_url")
    .in("id", userIds);

  const userMap = new Map(
    (users || []).map((u) => [u.id, u])
  );

  const enriched = scores.map((s) => {
    const user = userMap.get(s.user_id);
    return {
      score: s.raw_score,
      percentile: s.percentile,
      badge: s.badge,
      displayName: user?.display_name || "Player",
      avatarUrl: user?.avatar_url || null,
    };
  });

  res.json({ drop, scores: enriched });
});

// --- Profile ---

app.get("/api/profile/:userId", async (req, res) => {
  const { userId } = req.params;

  const { data: user, error: userErr } = await supabaseAdmin
    .from("users")
    .select("display_name, avatar_url, created_at")
    .eq("id", userId)
    .single();

  if (userErr || !user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const { data: scores } = await supabaseAdmin
    .from("scores")
    .select("raw_score, percentile, badge, drop_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!scores || scores.length === 0) {
    res.json({
      user: {
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        createdAt: user.created_at,
      },
      history: [],
    });
    return;
  }

  const dropIds = [...new Set(scores.map((s) => s.drop_id))];
  const { data: drops } = await supabaseAdmin
    .from("drops")
    .select("id, date, title, lore, engine")
    .in("id", dropIds);

  const dropMap = new Map((drops || []).map((d) => [d.id, d]));

  const history = scores.map((s) => {
    const drop = dropMap.get(s.drop_id);
    return {
      date: drop?.date || null,
      dropTitle: drop?.title || "Unknown",
      dropLore: drop?.lore || "",
      engine: drop?.engine || "unknown",
      score: Number(s.raw_score),
      percentile: s.percentile,
      badge: s.badge,
    };
  });

  res.json({
    user: {
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      createdAt: user.created_at,
    },
    history,
  });
});

// --- Game Bank ---

app.get("/api/game-bank", async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("game_bank")
    .select("*")
    .is("used_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ games: data || [] });
});

app.post("/api/game-bank", async (req, res) => {
  const { engine, title, lore, params, theme, duration } = req.body;

  if (!engine || !title) {
    res.status(400).json({ error: "engine and title are required" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("game_bank")
    .insert({
      engine,
      title,
      lore: lore || "",
      params: params || {},
      theme: theme || {},
      duration: duration || 300,
    })
    .select("id")
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ id: data.id, message: "Game added to bank" });
});

// --- Admin / Dev ---

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) { res.status(403).json({ error: "Admin access disabled" }); return; }
  if (req.headers["x-admin-secret"] !== secret) { res.status(403).json({ error: "Invalid admin secret" }); return; }
  next();
}

app.post("/api/admin/test-game", requireAdmin, async (_req, res) => {
  const durationSeconds = 60;
  console.log("[admin] triggering test game...");

  await startGame(io, {
    engine: "agario",
    duration: durationSeconds,
    title: "Test Game",
    lore: "A quick test round",
    params: {
      world_size: 5000,
      food_count: 400,
      base_speed: 3,
    },
    theme: { background: "#111118", accent: "#ff3366", grid: "#1a1a24" },
  });

  res.json({ message: "Test game started", durationSeconds });
});

app.use(((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[error]", err.message);
  res.status(500).json({ error: "Internal server error" });
}) as express.ErrorRequestHandler);

httpServer.listen(PORT, () => {
  console.log(`[server] listening on port ${PORT}`);
  initCron(io);
});

export { io };
