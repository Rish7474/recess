-- Run this if you already ran the original 002_drops_scores.sql
-- and need to update the drops table schema.
-- Run in Supabase SQL Editor.

-- Add duration column
ALTER TABLE public.drops ADD COLUMN IF NOT EXISTS duration INT NOT NULL DEFAULT 300;

-- Remove pacing column (AI Director remnant)
ALTER TABLE public.drops DROP COLUMN IF EXISTS pacing;

-- Remove generated_at column (AI Director remnant)
ALTER TABLE public.drops DROP COLUMN IF EXISTS generated_at;

-- Make date nullable (test games don't need a date)
ALTER TABLE public.drops ALTER COLUMN date DROP NOT NULL;

-- Drop the unique constraint on date (allows multiple games per day for testing)
ALTER TABLE public.drops DROP CONSTRAINT IF EXISTS drops_date_key;
