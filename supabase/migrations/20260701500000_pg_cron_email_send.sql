-- Story 5.5: pg_cron job — send email notifications at :15 UTC each hour
-- Runs 10 minutes AFTER the Zalo send cron (:05 UTC) so Zalo can mark
-- zalo_status='sent' before email cron runs. Email cron skips any record
-- already delivered via Zalo (zalo_status='sent').
-- Same pg_net / app.base_url / app.cron_secret pattern as other cron jobs.

DO $$
BEGIN
  PERFORM cron.unschedule('send-email-notifications');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

SELECT cron.schedule(
  'send-email-notifications',
  '15 * * * *',  -- every hour at :15 UTC — after Zalo at :05
  $$
    SELECT net.http_get(
      url     := current_setting('app.base_url') || '/api/cron/send-emails',
      headers := jsonb_build_object(
                   'Authorization', 'Bearer ' || current_setting('app.cron_secret')
                 ),
      timeout_milliseconds := 55000
    );
  $$
);
