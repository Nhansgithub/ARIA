-- Remediation: replace all hardcoded URLs/secrets in pg_cron jobs with
-- Supabase Vault lookups so credentials are never stored in cron.job SQL text.
--
-- BEFORE running this migration, store your secrets in Supabase Vault via the
-- SQL editor (Dashboard → SQL Editor). Run these two lines (not in git):
--
--   SELECT vault.create_secret('https://aria-consult.vercel.app', 'aria_base_url', 'ARIA app URL');
--   SELECT vault.create_secret('YOUR-NEW-CRON-SECRET', 'aria_cron_secret', 'ARIA cron auth secret');
--
-- To rotate the secret later, run this in the SQL editor:
--   UPDATE vault.secrets SET secret = 'NEW-SECRET' WHERE name = 'aria_cron_secret';
-- Then update CRON_SECRET in Vercel to match the new value.

-- generate-daily-briefing
SELECT cron.unschedule('generate-daily-briefing');
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

-- refresh-zalo-token
SELECT cron.unschedule('refresh-zalo-token');
SELECT cron.schedule(
  'refresh-zalo-token',
  '5 * * * *',
  $$
    SELECT net.http_get(
      url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'aria_base_url') || '/api/cron/refresh-zalo-token',
      headers := jsonb_build_object(
                   'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'aria_cron_secret')
                 ),
      timeout_milliseconds := 30000
    );
  $$
);

-- send-zalo-notifications
SELECT cron.unschedule('send-zalo-notifications');
SELECT cron.schedule(
  'send-zalo-notifications',
  '5 * * * *',
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

-- send-email-notifications
SELECT cron.unschedule('send-email-notifications');
SELECT cron.schedule(
  'send-email-notifications',
  '15 * * * *',
  $$
    SELECT net.http_get(
      url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'aria_base_url') || '/api/cron/send-emails',
      headers := jsonb_build_object(
                   'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'aria_cron_secret')
                 ),
      timeout_milliseconds := 55000
    );
  $$
);
