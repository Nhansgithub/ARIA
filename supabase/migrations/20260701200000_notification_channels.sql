-- Story 5.6: Delivery Channel Settings
-- email_enabled controls whether the email fallback fires for this owner
-- zalo_status tracks Zalo OA connection state (set by Story 5.3 cron, not directly writable by owner)
-- zalo_setup_note_shown tracks the one-time onboarding hint in ChatPanel
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS email_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS zalo_status text NOT NULL DEFAULT 'not_configured'
    CHECK (zalo_status IN ('not_configured', 'connected', 'token_expired'));

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS zalo_setup_note_shown boolean NOT NULL DEFAULT false;
