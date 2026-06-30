-- Story 5.1: add seen_at to briefings for badge-count tracking
ALTER TABLE briefings
  ADD COLUMN IF NOT EXISTS seen_at timestamptz;
