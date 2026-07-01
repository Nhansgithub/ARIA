-- Story 5.3: pg_cron job — refresh Zalo access tokens every 55 minutes
-- Fires at :05 past the hour (offset from briefing job at :00).
-- Same pg_net / app.base_url / app.cron_secret pattern as briefing job.
-- Prerequisites: pg_cron and pg_net extensions must be enabled (see 20260629040000_pg_cron_briefing_job.sql).

DO $$
BEGIN
  PERFORM cron.unschedule('refresh-zalo-token');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

SELECT cron.schedule(
  'refresh-zalo-token',
  '5 * * * *',  -- every hour at :05 past
  $$
    SELECT net.http_get(
      url     := 'https://aria-consult.vercel.app/api/cron/refresh-zalo-token',
      headers := '{"Authorization": "Bearer Jz3Jy2DvLWE3VBNtrPMa8UGALnkWf27KkpcZu1yT9gg="}'::jsonb,
      timeout_milliseconds := 30000
    );
  $$
);
