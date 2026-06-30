-- supabase/migrations/20260629000000_activity_log_append_only_trigger.sql
-- Enforces AD-14 append-only invariant on activity_log at the DB level.
-- This blocks UPDATE and DELETE from ALL callers including service-role (BYPASSRLS).
-- RLS already prevents anon-key UPDATE/DELETE (no policies defined).
-- This trigger adds a second layer covering the service-role path.

CREATE OR REPLACE FUNCTION enforce_activity_log_append_only()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'activity_log is append-only — UPDATE and DELETE are forbidden (AD-14)';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS activity_log_no_update_delete ON activity_log;

CREATE TRIGGER activity_log_no_update_delete
  BEFORE UPDATE OR DELETE ON activity_log
  FOR EACH ROW
  EXECUTE FUNCTION enforce_activity_log_append_only();
