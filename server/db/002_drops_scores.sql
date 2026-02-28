-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Creates the drops and scores tables for game history.
--
-- If you already ran a previous version of this file, run this first:
--   DROP TABLE IF EXISTS public.scores;
--   DROP TABLE IF EXISTS public.drops;

-- 1. Drops table — one row per game played
CREATE TABLE public.drops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE,
  engine TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled',
  lore TEXT NOT NULL DEFAULT '',
  theme JSONB NOT NULL DEFAULT '{}',
  params JSONB NOT NULL DEFAULT '{}',
  duration INT NOT NULL DEFAULT 300,
  total_players INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'upcoming',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.drops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read drops"
  ON public.drops FOR SELECT
  USING (true);

-- Only the service role key (server) can insert/update drops.

-- 2. Scores table — one row per authenticated player per drop
CREATE TABLE public.scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  drop_id UUID NOT NULL REFERENCES public.drops(id) ON DELETE CASCADE,
  raw_score NUMERIC NOT NULL DEFAULT 0,
  percentile FLOAT DEFAULT 0,
  badge TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, drop_id)
);

ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read scores"
  ON public.scores FOR SELECT
  USING (true);

-- Only the service role key (server) can insert/update scores.
