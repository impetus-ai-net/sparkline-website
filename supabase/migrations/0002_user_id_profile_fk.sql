-- ============================================================================
-- 0002 — Re-target user_id FKs to public.profiles so PostgREST can embed
-- profiles directly from applications, enrollments, payments, lesson_progress.
--
-- profiles.id is itself a FK to auth.users(id) ON DELETE CASCADE, so deleting
-- an auth user still cascades through profiles down to these tables.
--
-- Safe to run multiple times.
-- ============================================================================

-- applications.user_id -> profiles(id)
alter table public.applications drop constraint if exists applications_user_id_fkey;
alter table public.applications
  add constraint applications_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

-- enrollments.user_id -> profiles(id)
alter table public.enrollments drop constraint if exists enrollments_user_id_fkey;
alter table public.enrollments
  add constraint enrollments_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

-- payments.user_id -> profiles(id)
alter table public.payments drop constraint if exists payments_user_id_fkey;
alter table public.payments
  add constraint payments_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

-- lesson_progress.user_id -> profiles(id)
alter table public.lesson_progress drop constraint if exists lesson_progress_user_id_fkey;
alter table public.lesson_progress
  add constraint lesson_progress_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

-- Tell PostgREST to refresh its schema cache so the new relationships show up.
notify pgrst, 'reload schema';
