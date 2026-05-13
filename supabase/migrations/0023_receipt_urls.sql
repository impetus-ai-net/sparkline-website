-- ============================================================================
-- 0023 — Receipt URL columns.
--
-- Stripe hosts a receipt page for every successful charge; the URL is
-- stable and embedded directly in the user-facing receipts inbox. We
-- store it on the row that owns the payment so the inbox doesn't have
-- to round-trip to Stripe to render.
--
-- For rows already in the DB before this migration, the column stays
-- null and the UI shows "—" in place of a download link.
--
-- Run in Supabase SQL Editor. Idempotent / safe to re-run.
-- ============================================================================

alter table public.payments
  add column if not exists stripe_receipt_url text;

alter table public.user_charges
  add column if not exists stripe_receipt_url text;

notify pgrst, 'reload schema';
