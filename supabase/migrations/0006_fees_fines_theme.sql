-- ============================================================================
-- 0006 — Theme preference, application fee waiver, and arbitrary
--         admin-issued user charges (fees + fines).
--
-- Run in Supabase SQL Editor. Idempotent / safe to re-run.
-- Assumes 0001..0005 are applied.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles.theme: per-user UI preference. 'dark' is the default.
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists theme text not null default 'dark'
    check (theme in ('dark', 'light'));

-- ----------------------------------------------------------------------------
-- applications.fee_waived: admin can waive the $97 fee.
-- ----------------------------------------------------------------------------
alter table public.applications
  add column if not exists fee_waived boolean not null default false,
  add column if not exists fee_waiver_reason text,
  add column if not exists fee_waived_by uuid references public.profiles(id) on delete set null,
  add column if not exists fee_waived_at timestamptz;

-- ----------------------------------------------------------------------------
-- user_charges: arbitrary fees and fines an admin can issue. Fees are a
-- soft block (banner prompt). Fines are a hard block (middleware
-- redirects to a pay screen until paid or waived).
-- ----------------------------------------------------------------------------
create table if not exists public.user_charges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('fee', 'fine')),
  amount_cents integer not null check (amount_cents > 0),
  description text not null,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'waived', 'cancelled')),
  stripe_session_id text,
  stripe_payment_intent_id text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  waived_at timestamptz,
  waived_by uuid references public.profiles(id) on delete set null,
  waiver_reason text
);

create index if not exists user_charges_user_status_idx
  on public.user_charges(user_id, status);
create index if not exists user_charges_created_at_idx
  on public.user_charges(created_at desc);

drop trigger if exists touch_user_charges on public.user_charges;
create trigger touch_user_charges before update on public.user_charges
  for each row execute procedure public.touch_updated_at();

alter table public.user_charges enable row level security;

-- The user can read their own charges; admins can read everything.
drop policy if exists "user_charges self select" on public.user_charges;
create policy "user_charges self select" on public.user_charges
  for select using (
    user_id = auth.uid() or public.is_admin(auth.uid())
  );

-- Admins (and the webhook via service role) write charges.
drop policy if exists "user_charges admin all" on public.user_charges;
create policy "user_charges admin all" on public.user_charges
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

notify pgrst, 'reload schema';
