-- ============================================================================
-- 0010 — Weekly student check-ins + cohort resource library.
--
-- Run in Supabase SQL Editor. Idempotent / safe to re-run.
-- Assumes 0001..0009 applied.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- student_checkins: one entry per (user, ISO week). Mentors and admins read
-- everything; students see only their own. Updated when re-submitted in the
-- same week.
-- ----------------------------------------------------------------------------
create table if not exists public.student_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete set null,
  week_start date not null,           -- Monday of the ISO week
  accomplished text,
  next_up text,
  blockers text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create index if not exists student_checkins_user_idx
  on public.student_checkins (user_id, week_start desc);
create index if not exists student_checkins_cohort_idx
  on public.student_checkins (cohort_id, week_start desc);

drop trigger if exists touch_student_checkins on public.student_checkins;
create trigger touch_student_checkins before update on public.student_checkins
  for each row execute procedure public.touch_updated_at();

alter table public.student_checkins enable row level security;

drop policy if exists "checkins self all" on public.student_checkins;
create policy "checkins self all" on public.student_checkins
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "checkins staff read" on public.student_checkins;
create policy "checkins staff read" on public.student_checkins
  for select using (public.is_staff(auth.uid()));

-- ----------------------------------------------------------------------------
-- checkin_feedback: one mentor comment per checkin. Multiple allowed in case
-- mentors want to add follow-ups.
-- ----------------------------------------------------------------------------
create table if not exists public.checkin_feedback (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references public.student_checkins(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists checkin_feedback_checkin_idx
  on public.checkin_feedback (checkin_id, created_at desc);

alter table public.checkin_feedback enable row level security;

-- The student can read feedback on their own checkin; staff can read all.
drop policy if exists "checkin_feedback read" on public.checkin_feedback;
create policy "checkin_feedback read" on public.checkin_feedback
  for select using (
    public.is_staff(auth.uid())
    or exists (
      select 1 from public.student_checkins c
      where c.id = checkin_feedback.checkin_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "checkin_feedback staff write" on public.checkin_feedback;
create policy "checkin_feedback staff write" on public.checkin_feedback
  for all using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- ----------------------------------------------------------------------------
-- resources: cohort-scoped (or global if cohort_id is null) shared library.
-- Stored files live in the `resources` storage bucket.
-- ----------------------------------------------------------------------------
create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid references public.cohorts(id) on delete cascade,
  category text not null default 'general',
  title text not null,
  description text,
  -- Either a path in the `resources` bucket OR an external URL.
  storage_path text,
  external_url text,
  size_bytes integer,
  mime_type text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (storage_path is not null or external_url is not null)
);

create index if not exists resources_cohort_idx
  on public.resources (cohort_id, created_at desc);

drop trigger if exists touch_resources on public.resources;
create trigger touch_resources before update on public.resources
  for each row execute procedure public.touch_updated_at();

alter table public.resources enable row level security;

-- Read: admins always; staff always; enrolled students see their cohort
-- AND any global (cohort_id null) entries.
drop policy if exists "resources read" on public.resources;
create policy "resources read" on public.resources
  for select using (
    public.is_staff(auth.uid())
    or (
      cohort_id is null
      or exists (
        select 1 from public.enrollments e
        where e.user_id = auth.uid() and e.cohort_id = resources.cohort_id
      )
    )
  );

drop policy if exists "resources admin write" on public.resources;
create policy "resources admin write" on public.resources
  for all using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- Storage bucket for resource uploads. Same posture as course-materials:
-- private; clients fetch via signed URLs minted server-side.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('resources', 'resources', false)
on conflict (id) do nothing;

drop policy if exists "resources bucket read" on storage.objects;
create policy "resources bucket read" on storage.objects
  for select using (
    bucket_id = 'resources' and (
      public.is_staff(auth.uid())
      or exists (
        select 1 from public.enrollments e
        where e.user_id = auth.uid()
      )
    )
  );

drop policy if exists "resources bucket admin write" on storage.objects;
create policy "resources bucket admin write" on storage.objects
  for all using (
    bucket_id = 'resources' and public.is_admin(auth.uid())
  )
  with check (
    bucket_id = 'resources' and public.is_admin(auth.uid())
  );

notify pgrst, 'reload schema';
