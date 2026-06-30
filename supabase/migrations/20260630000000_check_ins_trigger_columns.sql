-- Story 4.6: Add trigger_type + due_date to check_ins for scheduler idempotency
-- The original schema had a partial unique index (one pending per deal).
-- We replace it with a 4-column unique index that allows one check-in per trigger type per day.

ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS trigger_type text NOT NULL DEFAULT 'manual';
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS due_date date NOT NULL DEFAULT current_date;

-- Drop the old partial unique index (one-pending-per-deal)
DROP INDEX IF EXISTS check_ins_pending_per_deal;

-- New idempotency constraint: one row per (owner, deal, trigger_type, due_date)
CREATE UNIQUE INDEX IF NOT EXISTS check_ins_unique_trigger
  ON check_ins (owner_id, deal_id, trigger_type, due_date);
