-- Story 5.3: Zalo OA setup columns
-- encrypted_zalo_refresh_token already exists from initial schema
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS zalo_user_id text,        -- Owner's personal Zalo numeric user ID (must follow the OA before use)
  ADD COLUMN IF NOT EXISTS zalo_access_token text,   -- Current Zalo access token — expires ~1 hour; refresh job keeps it fresh
  ADD COLUMN IF NOT EXISTS zalo_token_issued_at timestamptz; -- When the access token was issued (used to decide when to refresh)
