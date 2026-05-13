-- ============================================================================
-- 0028 — Team cap-table snapshot.
--
-- Lightweight fundraising fields on teams so demo-day attendees and
-- investor pipeline UIs can show "what they raised" without us
-- building a full SAFE/cap-table primary. These are admin-editable
-- numbers — single source of truth is whatever the team reports.
--
-- Run in Supabase SQL Editor. Idempotent / safe to re-run.
-- ============================================================================

alter table public.teams
  add column if not exists raised_cents bigint,
  add column if not exists post_money_cents bigint,
  add column if not exists lead_investor text,
  add column if not exists round_kind text
    check (round_kind in ('pre_seed', 'safe', 'seed', 'angel', 'grant', 'other')),
  add column if not exists round_closed_on date;

-- AI-generated tear sheet snapshot. Stored so the AI gateway round-trip
-- only happens when an admin clicks the regenerate button — investors
-- and admins read the cached copy.
alter table public.teams
  add column if not exists tear_sheet text,
  add column if not exists tear_sheet_generated_at timestamptz;

notify pgrst, 'reload schema';
