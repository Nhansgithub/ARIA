-- ============================================================
-- ARIA RLS Policies
-- Migration: 20260626010000_rls_policies.sql
-- Enables Row Level Security on all 7 tables (AD-2, FR-30).
-- auth.uid() returns the authenticated user's UUID from JWT sub.
-- service_role key has BYPASSRLS — it skips all policies (AD-13).
-- Default posture with ENABLE and no policies = deny-all.
-- Each CREATE POLICY below opens specific access for owners only.
-- ============================================================

-- ------------------------------------
-- clients: full CRUD by owner
-- ------------------------------------
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_select_own" ON clients
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "clients_insert_own" ON clients
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "clients_update_own" ON clients
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "clients_delete_own" ON clients
  FOR DELETE USING (owner_id = auth.uid());

-- ------------------------------------
-- deals: full CRUD by owner
-- ------------------------------------
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deals_select_own" ON deals
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "deals_insert_own" ON deals
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "deals_update_own" ON deals
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "deals_delete_own" ON deals
  FOR DELETE USING (owner_id = auth.uid());

-- ------------------------------------
-- documents: full CRUD by owner
-- ------------------------------------
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_select_own" ON documents
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "documents_insert_own" ON documents
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "documents_update_own" ON documents
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "documents_delete_own" ON documents
  FOR DELETE USING (owner_id = auth.uid());

-- ------------------------------------
-- activity_log: SELECT + INSERT only — append-only (AD-14)
-- No UPDATE or DELETE: log entries are immutable by design.
-- Absence of UPDATE/DELETE policies enforces immutability at DB layer.
-- ------------------------------------
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_log_select_own" ON activity_log
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "activity_log_insert_own" ON activity_log
  FOR INSERT WITH CHECK (owner_id = auth.uid());

-- ------------------------------------
-- briefings: SELECT + INSERT + DELETE
-- Scheduler writes via service_role (BYPASSRLS) — no UPDATE needed via anon key.
-- INSERT policy guards against anon-key abuse (defense-in-depth).
-- Owner can DELETE their own briefings for data retention (AD-10).
-- ------------------------------------
ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "briefings_select_own" ON briefings
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "briefings_insert_own" ON briefings
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "briefings_delete_own" ON briefings
  FOR DELETE USING (owner_id = auth.uid());

-- ------------------------------------
-- check_ins: SELECT + INSERT + UPDATE
-- Scheduler creates records via service_role (BYPASSRLS).
-- Owner updates status (answers/skips) via authenticated key.
-- ------------------------------------
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "check_ins_select_own" ON check_ins
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "check_ins_insert_own" ON check_ins
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "check_ins_update_own" ON check_ins
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- ------------------------------------
-- settings: SELECT + INSERT + UPDATE (one row per owner)
-- Owner reads and writes their business context + cadence config.
-- ------------------------------------
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_select_own" ON settings
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "settings_insert_own" ON settings
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "settings_update_own" ON settings
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
