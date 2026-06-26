-- ============================================================
-- ARIA v0 Initial Schema
-- Migration: 20260626000000_initial_schema.sql
-- All tables carry owner_id (AD-2). RLS added in next migration.
-- ============================================================

-- ------------------------------------
-- Enum types
-- ------------------------------------
CREATE TYPE client_source AS ENUM ('cold_outreach', 'referral', 'repeat');
CREATE TYPE language_pref AS ENUM ('vi', 'en');
CREATE TYPE company_size_enum AS ENUM ('solo', 'small', 'medium', 'enterprise');
CREATE TYPE relationship_stage AS ENUM ('cold', 'warming', 'trusted', 'long_term');
CREATE TYPE service_type AS ENUM ('web_design', 'web_app', 'automation', 'other');
CREATE TYPE currency_type AS ENUM ('VND', 'USD');
CREATE TYPE priority_level AS ENUM ('high', 'medium', 'low');
CREATE TYPE predicted_outcome AS ENUM ('likely_win', 'uncertain', 'at_risk', 'likely_lost');
CREATE TYPE document_type AS ENUM (
  'proposal', 'contract', 'brief', 'sop', 'report', 'invoice', 'onboarding', 'other'
);
CREATE TYPE document_status AS ENUM ('draft', 'review', 'sent', 'signed', 'archived');
CREATE TYPE created_by_type AS ENUM ('ai', 'human');
CREATE TYPE entity_type AS ENUM ('client', 'deal', 'document');
CREATE TYPE actor_type AS ENUM ('ai', 'user');
CREATE TYPE checkin_channel AS ENUM ('in_app', 'zalo', 'email');
CREATE TYPE checkin_status AS ENUM ('pending', 'answered', 'skipped');

-- ------------------------------------
-- clients
-- ------------------------------------
CREATE TABLE clients (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  company       text,
  email         text,
  phone         text,
  source        client_source,
  language_pref language_pref DEFAULT 'vi',
  industry      text,
  company_size  company_size_enum,
  communication_style text,     -- AI-maintained (FR-7)
  known_hesitations   text,     -- AI-maintained (FR-11)
  relationship_stage  relationship_stage DEFAULT 'cold',
  decision_maker      text,     -- NEW (FR-11)
  notes               text,     -- AI-maintained
  created_at    timestamptz DEFAULT now() NOT NULL,
  updated_at    timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX clients_owner_id_idx ON clients (owner_id);

-- ------------------------------------
-- deals
-- ------------------------------------
CREATE TABLE deals (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id           uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service_type        service_type NOT NULL,
  title               text NOT NULL,
  stage               text DEFAULT 'discovery',
  stage_history       jsonb DEFAULT '[]'::jsonb,
  value_estimate      numeric,
  currency            currency_type DEFAULT 'VND',
  priority            priority_level DEFAULT 'medium',
  next_action         text,
  next_action_due     date,
  stale_since         date,
  client_stated_need  text,
  inferred_real_need  text,                        -- AI-maintained (FR-6)
  risk_flags          jsonb DEFAULT '[]'::jsonb,   -- [{flag, severity, noted_at}]
  opportunity_signals jsonb DEFAULT '[]'::jsonb,
  predicted_outcome   predicted_outcome,           -- AI-maintained (FR-6)
  prediction_reason   text,                        -- AI-maintained
  similar_deals       jsonb DEFAULT '[]'::jsonb,   -- [{deal_id, similarity_reason}]
  stall_diagnosis     text,                        -- NEW (FR-12)
  notes               text,
  created_at          timestamptz DEFAULT now() NOT NULL,
  updated_at          timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX deals_owner_id_idx ON deals (owner_id);
CREATE INDEX deals_client_id_idx ON deals (client_id);

-- ------------------------------------
-- documents
-- ------------------------------------
CREATE TABLE documents (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id     uuid REFERENCES deals(id) ON DELETE SET NULL,
  client_id   uuid REFERENCES clients(id) ON DELETE SET NULL,
  type        document_type NOT NULL,
  title       text NOT NULL,
  status      document_status DEFAULT 'draft',
  content_md  text,
  file_url    text,   -- Supabase Storage path (PDF)
  version     int DEFAULT 1 NOT NULL,
  created_by  created_by_type DEFAULT 'ai',
  created_at  timestamptz DEFAULT now() NOT NULL,
  updated_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX documents_owner_id_idx ON documents (owner_id);
CREATE INDEX documents_deal_id_idx ON documents (deal_id);

-- ------------------------------------
-- activity_log (append-only — AD-14)
-- No updated_at: this table is never UPDATEd, only INSERTed
-- ------------------------------------
CREATE TABLE activity_log (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type entity_type NOT NULL,
  entity_id   uuid NOT NULL,
  action      text NOT NULL,
  actor       actor_type NOT NULL,
  payload     jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX activity_log_owner_id_idx ON activity_log (owner_id);
CREATE INDEX activity_log_entity_type_id_idx ON activity_log (entity_type, entity_id);

-- ------------------------------------
-- briefings
-- UNIQUE(owner_id, date) — AD-7 idempotency guard
-- ------------------------------------
CREATE TABLE briefings (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date         date NOT NULL,
  content_md   text,
  flags        jsonb DEFAULT '[]'::jsonb,
  generated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (owner_id, date)
);

-- Note: UNIQUE(owner_id, date) already creates an index with owner_id as leftmost key;
-- no separate owner_id-only index needed.

-- ------------------------------------
-- check_ins
-- ------------------------------------
CREATE TABLE check_ins (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id         uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  prompt_template text,
  sent_at         timestamptz,
  channel         checkin_channel DEFAULT 'in_app',
  answered_at     timestamptz,
  answer          jsonb,
  status          checkin_status DEFAULT 'pending',
  created_at      timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX check_ins_owner_id_idx ON check_ins (owner_id);
CREATE INDEX check_ins_deal_id_idx ON check_ins (deal_id);

-- Partial unique index: only one pending check-in per (owner_id, deal_id) at a time (AD-7)
CREATE UNIQUE INDEX check_ins_pending_per_deal
  ON check_ins (owner_id, deal_id)
  WHERE status = 'pending';

-- ------------------------------------
-- settings (one row per owner)
-- Stores business context + cadence config
-- ------------------------------------
CREATE TABLE settings (
  id                           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id                     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_context             text,                           -- <=~2,000 tokens (FR-4)
  pricing_benchmarks           jsonb DEFAULT '{}'::jsonb,      -- FR-13
  escalation_thresholds        jsonb DEFAULT '{}'::jsonb,
  followup_cadence_days        int DEFAULT 7,
  checkin_cadence_days         int DEFAULT 14,
  encrypted_zalo_refresh_token text,   -- populated & used in Story 0.5; server-encrypted
  created_at                   timestamptz DEFAULT now() NOT NULL,
  updated_at                   timestamptz DEFAULT now() NOT NULL,
  UNIQUE (owner_id)
);

-- Note: UNIQUE(owner_id) already creates an index; no separate owner_id index needed.
