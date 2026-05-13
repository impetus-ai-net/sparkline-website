-- ============================================================================
-- 0027 — Persisted announcements + reactions.
--
-- Until now, an "announcement" was a transient broadcast: it fanned out
-- as in-app notifications + email + Discord, but no row existed for
-- students to re-read or react to. This migration creates a durable
-- table so the dashboard can show past announcements with a small
-- reaction palette (👍 ❤️ 🚀 🎉) — mirroring the social affordance
-- students already use in Discord.
--
-- Reactions are scoped (announcement, user, emoji) so each user can
-- pick multiple emoji on the same announcement (matches Discord's
-- behavior) but never double-vote for the same emoji.
--
-- Run in Supabase SQL Editor. Idempotent / safe to re-run.
-- ============================================================================

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid references public.cohorts(id) on delete set null,
  author_id uuid references public.profiles(id) on delete set null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists announcements_cohort_idx
  on public.announcements (cohort_id, created_at desc);
create index if not exists announcements_created_at_idx
  on public.announcements (created_at desc);

alter table public.announcements enable row level security;

-- Read access: enrolled students of the targeted cohort (or all
-- enrolled when cohort_id is null), plus staff. Mirrors how the
-- existing in-app notification fan-out scopes recipients.
drop policy if exists "announcements read" on public.announcements;
create policy "announcements read" on public.announcements
  for select using (
    public.is_staff(auth.uid())
    or (
      cohort_id is null and exists (
        select 1 from public.enrollments e where e.user_id = auth.uid()
      )
    )
    or (
      cohort_id is not null and exists (
        select 1 from public.enrollments e
        where e.user_id = auth.uid() and e.cohort_id = announcements.cohort_id
      )
    )
  );

drop policy if exists "announcements admin write" on public.announcements;
create policy "announcements admin write" on public.announcements
  for all using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Reactions
create table if not exists public.announcement_reactions (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- Tiny palette; constrained at the DB level so the UI can't be
  -- subverted to insert arbitrary text (which would balloon the
  -- aggregate group-by surface).
  emoji text not null check (emoji in ('thumbs_up', 'heart', 'rocket', 'party')),
  created_at timestamptz not null default now(),
  primary key (announcement_id, user_id, emoji)
);

create index if not exists announcement_reactions_announcement_idx
  on public.announcement_reactions (announcement_id, emoji);

alter table public.announcement_reactions enable row level security;

-- Read access mirrors announcements: if you can see the announcement,
-- you can see the reactions on it.
drop policy if exists "announcement_reactions read"
  on public.announcement_reactions;
create policy "announcement_reactions read" on public.announcement_reactions
  for select using (
    public.is_staff(auth.uid())
    or exists (
      select 1 from public.announcements a
      where a.id = announcement_reactions.announcement_id
        and (
          a.cohort_id is null
          or exists (
            select 1 from public.enrollments e
            where e.user_id = auth.uid() and e.cohort_id = a.cohort_id
          )
        )
    )
  );

-- Users can only insert/delete their own reactions. The PK already
-- prevents duplicates (user can't double-up the same emoji).
drop policy if exists "announcement_reactions self insert"
  on public.announcement_reactions;
create policy "announcement_reactions self insert"
  on public.announcement_reactions
  for insert with check (user_id = auth.uid());

drop policy if exists "announcement_reactions self delete"
  on public.announcement_reactions;
create policy "announcement_reactions self delete"
  on public.announcement_reactions
  for delete using (user_id = auth.uid());

notify pgrst, 'reload schema';
