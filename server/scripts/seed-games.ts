/**
 * Seed the game_bank table with sample Agar.io games.
 * Run: npx tsx server/scripts/seed-games.ts
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const games = [
  {
    engine: "agario",
    title: "Neon Sprawl",
    lore: "The grid pulses with energy. Consume or be consumed.",
    params: { world_size: 5000, food_count: 400, base_speed: 3 },
    theme: { background: "#0a0a14", accent: "#00ffaa", grid: "#151525" },
    duration: 300,
  },
  {
    engine: "agario",
    title: "Blood Moon Rising",
    lore: "Under the crimson sky, only the largest survive.",
    params: { world_size: 4000, food_count: 350, base_speed: 3.5 },
    theme: { background: "#140a0a", accent: "#ff3333", grid: "#251515" },
    duration: 300,
  },
  {
    engine: "agario",
    title: "Deep Blue",
    lore: "The abyss is vast. Grow before the depths swallow you whole.",
    params: { world_size: 6000, food_count: 500, base_speed: 2.5 },
    theme: { background: "#060a14", accent: "#3388ff", grid: "#0f1525" },
    duration: 300,
  },
  {
    engine: "agario",
    title: "Golden Hour",
    lore: "The sun dips low. Five minutes of pure gold.",
    params: { world_size: 4500, food_count: 450, base_speed: 3 },
    theme: { background: "#141008", accent: "#ffaa22", grid: "#201a10" },
    duration: 300,
  },
  {
    engine: "agario",
    title: "Violet Void",
    lore: "Reality bends at the edges. Mass is the only truth.",
    params: { world_size: 5500, food_count: 600, base_speed: 2.8 },
    theme: { background: "#0e0814", accent: "#aa44ff", grid: "#1a1025" },
    duration: 300,
  },
  {
    engine: "agario",
    title: "Speed Demon",
    lore: "Everything moves faster tonight. Blink and you're eaten.",
    params: { world_size: 3500, food_count: 300, base_speed: 5 },
    theme: { background: "#140808", accent: "#ff6633", grid: "#251010" },
    duration: 300,
  },
  {
    engine: "agario",
    title: "The Quiet Garden",
    lore: "A serene battlefield. Plenty of food. Plenty of predators.",
    params: { world_size: 5000, food_count: 700, base_speed: 2 },
    theme: { background: "#081408", accent: "#44cc44", grid: "#102510" },
    duration: 300,
  },
];

async function seed() {
  console.log(`Seeding ${games.length} games into game_bank...`);

  const { data, error } = await supabase
    .from("game_bank")
    .insert(games)
    .select("id, title");

  if (error) {
    console.error("Failed to seed:", error.message);
    process.exit(1);
  }

  console.log("Seeded successfully:");
  for (const g of data) {
    console.log(`  ${g.id} — ${g.title}`);
  }
}

seed();
