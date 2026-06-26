-- Story 1.4: Add 'settings' to activity_log entity_type enum
-- Required for logging business_context updates with actor=ai|user (AD-14)
-- Note: business_context column already exists in settings table (initial schema).
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'settings';
