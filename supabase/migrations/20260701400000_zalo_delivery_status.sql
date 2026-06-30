-- Story 5.4: Zalo delivery status columns for briefings and check_ins
-- zalo_status tracks per-message delivery state for the Zalo send cron
ALTER TABLE briefings
  ADD COLUMN IF NOT EXISTS zalo_status text NOT NULL DEFAULT 'pending'
    CHECK (zalo_status IN ('pending', 'sent', 'failed', 'skipped'));

ALTER TABLE check_ins
  ADD COLUMN IF NOT EXISTS zalo_status text NOT NULL DEFAULT 'pending'
    CHECK (zalo_status IN ('pending', 'sent', 'failed', 'skipped'));
