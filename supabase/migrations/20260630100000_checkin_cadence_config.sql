-- Story 4.8: Check-in Cadence Configuration & Per-Deal Pause
-- Adds owner-level cadence config to settings and per-deal pause flag to deals.

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS checkin_config jsonb NOT NULL DEFAULT '{"daily_cap":3,"high_priority_threshold_days":3,"standard_threshold_days":5,"enabled":true}'::jsonb;

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS checkin_paused boolean NOT NULL DEFAULT false;
