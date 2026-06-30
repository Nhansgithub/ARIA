-- Story 2.3: Add status column to clients and deals for stub archival (AD-14)
-- 'active' is the default; 'archived' is set by archiveStub() without a DELETE.
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
