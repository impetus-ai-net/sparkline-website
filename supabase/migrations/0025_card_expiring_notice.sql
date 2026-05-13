-- ============================================================================
-- 0025 — Track when a card-expiring reminder was last sent.
--
-- The daily card-expiring cron checks every Stripe customer with a
-- default card within 30 days of expiry, but should not re-notify a
-- user it already pinged this calendar month — otherwise students
-- whose card sits in the expiring window for 30 days would get a
-- daily nag. The column stores the calendar month (YYYY-MM) we last
-- notified them, so the cron can skip anyone matching the current
-- month.
--
-- Run in Supabase SQL Editor. Idempotent / safe to re-run.
-- ============================================================================

alter table public.profiles
  add column if not exists last_card_expiring_notified_month text;

notify pgrst, 'reload schema';
