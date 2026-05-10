-- ============================================================================
-- 0009 — Master kill-switch for the Discord integration.
-- ============================================================================

insert into public.site_settings (key, value)
values ('discord_enabled', 'true')
on conflict (key) do nothing;

notify pgrst, 'reload schema';
