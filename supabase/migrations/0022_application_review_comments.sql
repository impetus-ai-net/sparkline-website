-- ============================================================================
-- 0022 — Inline review-only comment thread on applications.
--
-- The existing `review_notes` field on applications is a single text blob
-- visible to the applicant (sent in the rejection email). Reviewers
-- needed a back-channel to leave notes / questions for each other that
-- never reaches the applicant, so this table holds an append-only thread
-- per application.
--
-- Run in Supabase SQL Editor. Idempotent / safe to re-run.
-- ============================================================================

create table if not exists public.application_review_comments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null check (length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index if not exists application_review_comments_app_idx
  on public.application_review_comments (application_id, created_at desc);

alter table public.application_review_comments enable row level security;

-- Admin-only. Reviewers ARE admins in this codebase (mentors don't review
-- applications). If that changes later, broaden the policy to is_staff.
drop policy if exists "app_review_comments admin all"
  on public.application_review_comments;
create policy "app_review_comments admin all"
  on public.application_review_comments
  for all using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

notify pgrst, 'reload schema';
