-- ============================================================
-- pg_cron briefing generation job — AD-7
-- Fires at 00:00 UTC = 07:00 Asia/Ho_Chi_Minh daily.
-- Calls the Next.js GET /api/cron/briefing endpoint via pg_net.
--
-- Prerequisites:
--   1. Supabase project has pg_cron and pg_net extensions enabled.
--
-- To verify after migration:
--   SELECT * FROM cron.job;
--   SELECT * FROM net._http_response ORDER BY created DESC LIMIT 5;
-- ============================================================

-- Enable required extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove old job if it exists — cron.unschedule raises ERROR if not found, so guard with DO block
DO $$
BEGIN
  PERFORM cron.unschedule('generate-daily-briefing');
EXCEPTION WHEN OTHERS THEN
  NULL; -- job does not exist yet, safe to ignore
END;
$$;

-- Schedule: daily at 00:00 UTC (07:00 Asia/Ho_Chi_Minh, AD-7)
-- Uses net.http_get — route handler is exported as GET (not POST)
-- IMPORTANT: Before running this migration, store secrets in Supabase Vault via SQL editor:
--   SELECT vault.create_secret('https://your-app.vercel.app', 'aria_base_url', 'ARIA app URL');
--   SELECT vault.create_secret('your-cron-secret', 'aria_cron_secret', 'ARIA cron auth');
SELECT cron.schedule(
  'generate-daily-briefing',
  '0 0 * * *',
  $$
    SELECT net.http_get(
      url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'aria_base_url') || '/api/cron/briefing',
      headers := jsonb_build_object(
                   'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'aria_cron_secret')
                 ),
      timeout_milliseconds := 30000
    );
  $$
);
