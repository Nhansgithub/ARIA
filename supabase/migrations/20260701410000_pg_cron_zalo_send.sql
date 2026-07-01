-- Story 5.4: pg_cron job — send Zalo notifications at :05 UTC each hour
-- Runs before the email cron (:15 UTC) so Story 5.5 can skip email if Zalo sent.
-- Same pg_net / app.base_url / app.cron_secret pattern as other cron jobs.

DO $$
BEGIN
  PERFORM cron.unschedule('send-zalo-notifications');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

SELECT cron.schedule(
  'send-zalo-notifications',
  '5 * * * *',  -- every hour at :05 UTC
  $$
    SELECT net.http_get(
      url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'aria_base_url') || '/api/cron/send-zalo',
      headers := jsonb_build_object(
                   'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'aria_cron_secret')
                 ),
      timeout_milliseconds := 55000
    );
  $$
);
