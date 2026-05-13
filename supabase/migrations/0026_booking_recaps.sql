-- ============================================================================
-- 0026 — Mentor recap notes on a booking.
--
-- After a session ends the mentor can drop a recap that the student
-- sees on their /dashboard/office-hours page. Keeps the mentor-student
-- loop tighter without adding scheduling or messaging primitives.
--
-- The recap is plain text (max 4k chars). Reads piggyback on the
-- existing mentor_bookings RLS — student / mentor / admin already see
-- the row; the new columns ride that.
--
-- Run in Supabase SQL Editor. Idempotent / safe to re-run.
-- ============================================================================

alter table public.mentor_bookings
  add column if not exists recap_notes text,
  add column if not exists recap_posted_at timestamptz;

notify pgrst, 'reload schema';
