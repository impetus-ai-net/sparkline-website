-- ============================================================================
-- 0030 — Drop MFA / two-factor entirely.
--
-- The product no longer enforces TOTP step-up on admin actions; the
-- `mfa_verifications` table, its policies, and the supporting code paths
-- have all been removed. This migration tears down the table for any
-- environment that already ran 0011 / 0012.
--
-- Run in Supabase SQL Editor. Idempotent / safe to re-run.
-- ============================================================================

drop policy if exists "mfa_verifications self read" on public.mfa_verifications;
drop policy if exists "mfa_verifications self insert" on public.mfa_verifications;
drop index if exists public.mfa_verifications_user_idx;
drop table if exists public.mfa_verifications;

notify pgrst, 'reload schema';
