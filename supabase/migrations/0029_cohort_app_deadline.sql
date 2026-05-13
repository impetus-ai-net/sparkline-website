-- ============================================================================
-- 0029 — Explicit application deadline per cohort.
--
-- Until now the only "applications open / closed" signal was the
-- global `applications_open` site setting. Adding a per-cohort
-- deadline lets the landing page show "applications close in N days"
-- without an admin manually flipping the master switch on the day.
--
-- Stored on cohorts because the deadline travels with the cohort. The
-- site_settings flag still wins — when admin explicitly closes apps,
-- the countdown disappears.
--
-- Run in Supabase SQL Editor. Idempotent / safe to re-run.
-- ============================================================================

alter table public.cohorts
  add column if not exists applications_close_at timestamptz;

notify pgrst, 'reload schema';
