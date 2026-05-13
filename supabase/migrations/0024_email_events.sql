-- ============================================================================
-- 0024 — Email engagement events from Resend webhooks.
--
-- Resend delivers webhook events for every send: delivered, opened,
-- clicked, bounced, complained. We dedupe on the Svix message id so
-- Resend retries don't double-count. The admin email metrics page
-- aggregates this table by subject prefix and by day.
--
-- Run in Supabase SQL Editor. Idempotent / safe to re-run.
-- ============================================================================

create table if not exists public.email_events (
  -- Svix message id from the webhook headers. Stable across retries
  -- and unique per delivery attempt, so we use it as the primary key
  -- to make the ingest naturally idempotent.
  svix_id text primary key,
  event_type text not null,
  resend_email_id text,
  recipient text,
  subject text,
  -- Full payload kept for forensics; the named columns above are the
  -- subset the admin UI actually queries against, so we don't have to
  -- pay JSON cost on every aggregate.
  payload jsonb,
  -- Timestamp from the event itself (when Resend recorded it), not
  -- when we ingested it. This way reordered deliveries still chart on
  -- the right day.
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists email_events_event_type_idx
  on public.email_events (event_type, occurred_at desc);
create index if not exists email_events_subject_idx
  on public.email_events (subject);
create index if not exists email_events_resend_email_idx
  on public.email_events (resend_email_id);

alter table public.email_events enable row level security;

drop policy if exists "email_events admin read" on public.email_events;
create policy "email_events admin read" on public.email_events
  for select using (public.is_admin(auth.uid()));

-- Writes are service-role only (webhook handler uses the admin client).
-- No client INSERT policy on purpose.

notify pgrst, 'reload schema';
