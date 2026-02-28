import cron from "node-cron";
import { Server } from "socket.io";
import { startGame, isGameActive } from "./game/lifecycle";
import { supabaseAdmin } from "./lib/supabase";

export function initCron(io: Server) {
  // 6:00 PM EST every day
  cron.schedule(
    "0 18 * * *",
    async () => {
      console.log("[cron] 6:00 PM trigger fired");

      if (isGameActive()) {
        console.warn("[cron] game already active, skipping");
        return;
      }

      const { data: game, error } = await supabaseAdmin
        .from("game_bank")
        .select("*")
        .is("used_at", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

      if (error || !game) {
        console.warn("[cron] no available games in game_bank — skipping today");
        return;
      }

      // Mark game as used
      await supabaseAdmin
        .from("game_bank")
        .update({ used_at: new Date().toISOString() })
        .eq("id", game.id);

      console.log(`[cron] picked game: "${game.title}" (${game.engine})`);

      await startGame(io, {
        engine: game.engine,
        duration: game.duration,
        title: game.title,
        lore: game.lore,
        params: game.params,
        theme: game.theme,
      });
    },
    { timezone: "America/New_York" }
  );

  console.log("[cron] scheduled daily game at 6:00 PM EST");
}
