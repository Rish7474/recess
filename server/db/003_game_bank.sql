-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Creates the game_bank table — a queue of pre-configured games
-- that the daily cron picks from.
--
-- Any external process (script, admin UI, AI pipeline) can INSERT rows.
-- The Recess server reads the next unused game at 6 PM EST.

CREATE TABLE public.game_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engine TEXT NOT NULL,
  title TEXT NOT NULL,
  lore TEXT NOT NULL DEFAULT '',
  params JSONB NOT NULL DEFAULT '{}',
  theme JSONB NOT NULL DEFAULT '{}',
  duration INT NOT NULL DEFAULT 300,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.game_bank ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read game_bank"
  ON public.game_bank FOR SELECT
  USING (true);

-- Only the service role key (server) can insert/update game_bank.
