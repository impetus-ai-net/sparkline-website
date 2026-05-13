-- Seed the referrals_enabled site setting. Tolerated by the app even
-- if this row is missing (FALLBACK_SETTINGS keeps the feature on by
-- default), but seeding it makes the admin form show the current value.
insert into public.site_settings (key, value)
values ('referrals_enabled', 'true')
on conflict (key) do nothing;
