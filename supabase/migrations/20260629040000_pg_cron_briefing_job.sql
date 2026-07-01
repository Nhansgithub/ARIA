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
SELECT cron.schedule(
  'generate-daily-briefing',
  '0 0 * * *',
  $$
    SELECT net.http_get(
      url     := 'https://aria-consult.vercel.app/api/cron/briefing',
      headers := '{"Authorization": "Bearer Jz3Jy2DvLWE3VBNtrPMa8UGALnkWf27KkpcZu1yT9gg="}'::jsonb,
      timeout_milliseconds := 30000
    );
  $$
);
