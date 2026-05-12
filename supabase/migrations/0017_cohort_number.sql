-- Add an editable cohort number (e.g. "Cohort 1", "Cohort 2") that the
-- marketing site renders. Distinct from `name`, which is the season label
-- (e.g. "Summer 2026"). Admins can edit both independently.
alter table public.cohorts
  add column if not exists cohort_number smallint;

-- Backfill: assign sequential numbers in chronological order so existing
-- rows get a sane default.
with ordered as (
  select id, row_number() over (order by starts_on nulls last, created_at) as rn
  from public.cohorts
  where cohort_number is null
)
update public.cohorts c
set cohort_number = ordered.rn
from ordered
where c.id = ordered.id;
