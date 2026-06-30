-- Story 5.2: track email delivery idempotency on briefings and check_ins
ALTER TABLE briefings
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;

ALTER TABLE check_ins
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;
