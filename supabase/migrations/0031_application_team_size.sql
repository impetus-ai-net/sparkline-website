-- ============================================================================
-- 0031 — Founding-team size on applications.
--
-- Adds `team_size` to applications: 1 = solo founder, 2 = with one
-- co-founder, up to 5 = team of five-or-more. The application form asks
-- the applicant to pick from a fixed set; we don't need to know who the
-- co-founders are at apply time, just how many. Helps admins triage and
-- helps cohort planning know how many seats a single application
-- effectively claims.
--
-- Run in Supabase SQL Editor. Idempotent / safe to re-run.
-- ============================================================================

alter table public.applications
  add column if not exists team_size smallint
    check (team_size is null or (team_size between 1 and 5));

notify pgrst, 'reload schema';
