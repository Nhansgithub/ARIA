## Epic 2: CRM & Memory

**Goal:** Establish the durable, owner-scoped data layer that lets ARIA get smarter about each client over time — through an append-only activity log, AI-maintained intelligence fields, similar-deal matching, conversational data maintenance, and a governed stub lifecycle — all without any manual maintenance by the Owner.

---

### Story 2.1: Owner-Scoped Persistence with Append-Only Activity Log

As an **Owner**, I want every client, deal, and document change persisted under my account and recorded in an audit trail, so that ARIA always has a trustworthy history to reason from and I can trust nothing is lost or mixed with other data.

**Acceptance Criteria:**

**Given** the `clients`, `deals`, `documents`, `activity_log`, and `briefings` tables are created with an `owner_id uuid` column (FK → authenticated user), **when** any row is inserted or updated, **then** Postgres RLS policies enforce that the row is only readable and writable by the authenticated owner whose `owner_id` matches — cross-owner access returns zero rows (AD-2, FR-30).

**Given** a request handler processes an owner data read or write, **when** it uses the Supabase client, **then** it uses the owner's RLS-enforced session token, never the service-role key (AD-13).

**Given** ARIA creates or updates a client, deal, or document record, **when** the write changes a material field (stage, status, intelligence field, note, relationship_stage, priority, value_estimate), **then** an `activity_log` row is appended with: `entity_type`, `entity_id`, `action` (descriptive string e.g. `"stage_changed"`), `actor` (`ai` or `user`), `payload` (jsonb capturing old + new value of the changed field), `created_at`, and `owner_id` (FR-30, AD-14).

**Given** ARIA writes an intelligence field update that produces the same value already stored (no material change), **when** the tool call completes, **then** no activity log row is written — the log remains append-only and records only genuine changes (AD-14).

**Given** the Owner creates or updates a client or deal via conversation, **when** the write succeeds, **then** the activity log records `actor=user`; when ARIA performs the same write autonomously, the log records `actor=ai` (FR-30, AD-14).

**Given** the activity log table exists, **when** any code path attempts to delete or update an existing `activity_log` row, **then** the operation is rejected — either by a DB trigger or by the absence of any delete/update surface in the tool layer (AD-14 append-only invariant).

---

### Story 2.2: Core CRM Tool Surface — Create, Read, Update via Conversation

As an **Owner**, I want to create, retrieve, and update full client and deal records entirely through conversation, so that I never need to open a form to maintain my pipeline.

**Acceptance Criteria:**

**Given** the CRM tool surface is wired to the orchestrator (AD-1), **when** ARIA calls `create_client_stub(name, company, known_fields)`, **then** a client row is persisted with `owner_id`, `is_stub=true`, and the supplied fields; ARIA's reply confirms creation and names the record (FR-31, FR-7).

**Given** the CRM tool surface is wired, **when** ARIA calls `create_deal_stub(client_id, fields)`, **then** a deal row is persisted with `owner_id`, linked `client_id`, `is_stub=true`, and supplied fields; the activity log records `action="deal_stub_created"`, `actor=ai` (FR-31, AD-14).

**Given** a client or deal exists, **when** ARIA calls `update_deal(id, fields)` or `update_client(id, fields)` with one or more changed fields, **then** only the supplied fields are updated (no clobber of other fields); if any updated field is an AI-maintained intelligence field, the update carries `actor=ai` in the activity log; if the field was last set by a human (`actor=user`), the new AI value does not silently overwrite it — ARIA proposes the update in its reply and writes it only after no conflicting human value exists or after the Owner confirms (AD-14).

**Given** the Owner types "update the Hanoi restaurant deal — they pushed the timeline to August" in chat, **when** the orchestrator processes the message, **then** ARIA calls `update_deal` with the relevant fields, confirms the update in its reply, and the activity log records the change with `actor=user` (since the information came from the Owner) (FR-31).

**Given** a client or deal record exists, **when** ARIA calls `get_client(id|name)` or `get_deal(id|title)`, **then** the tool returns the full record filtered by the caller's `owner_id`; no fields from another owner are present (AD-2).

**Given** the Owner asks "what are all my active deals?" in chat, **when** the orchestrator calls `list_deals(filters)` with `stage != closed`, **then** only deals with the Owner's `owner_id` are returned; the reply is prose synthesis, not a field dump (FR-31, FR-14).

**Given** ARIA creates or updates a record, **when** `log_activity(entity, action, note)` is called explicitly (e.g. for a note or stage advancement not covered by a field write), **then** an activity log row is appended with the correct `actor`, `entity_type`, `entity_id`, and `payload` (FR-30, AD-14).

---

### Story 2.3: Stub Lifecycle — Deduplication, Enrichment Gate, and Archival

As **ARIA**, I want to manage stubs — checking for duplicates before creating, blocking un-enriched stubs from matching, and surfacing stale stubs for archival — so that the CRM stays clean and pattern-matching is never corrupted by thin records.

**Acceptance Criteria:**

**Given** the Owner mentions a new client or deal by name, **when** ARIA is about to call `create_client_stub` or `create_deal_stub`, **then** ARIA first calls `list_deals` or `get_client` to check for an existing record with a similar name/company; if a likely match is found, ARIA proposes linking to the existing record rather than creating a duplicate, and creation proceeds only if the Owner confirms it is a different entity (FR-37, AD-14 stub→full is a state transition not a new record).

**Given** a stub record exists with `is_stub=true`, **when** `find_similar_deals` is called to populate pattern-matching context (used in Deal Intelligence or Story 2.4), **then** records with `is_stub=true` are excluded from the results — un-enriched stubs do not influence the similar-deal read (FR-37, FR-10).

**Given** a stub has `is_stub=true` and has not been updated (no activity log entry against it) for longer than the configurable idle threshold (default: 14 days), **when** the briefing scheduler or an inline conversation check runs, **then** the stub is flagged for completion or archival; ARIA surfaces the flag to the Owner conversationally ("I have a stub for [name] with no updates in 14 days — complete it, keep it, or archive it?") (FR-37).

**Given** a stub has been enriched with minimally required fields — `client_stated_need`, `service_type`, `stage`, and `value_estimate` present and non-null — **when** ARIA or the Owner provides these fields, **then** `is_stub` is set to `false` (the promotion is a state transition on the same record, not a new insert), and the activity log records `action="stub_promoted"`, `actor` set to whichever party provided the final fields (FR-37, AD-14).

**Given** the Owner says "discard the stub for Viet Coffee" via conversation, **when** ARIA processes the request, **then** ARIA calls `update_deal` or `update_client` to set `status=archived` (not delete), confirms the action in its reply, and the activity log records `action="stub_archived"`, `actor=user` (FR-37, AD-14 — archival not deletion preserves the log).

**Given** the Owner says "merge the Pho 24 stub with the existing Pho 24 Hanoi record" via conversation, **when** ARIA processes the request, **then** ARIA proposes which fields to carry over from the stub onto the existing record, the Owner confirms, ARIA calls `update_deal`/`update_client` with the merged fields on the target record, and the stub is archived — no duplicate persists (FR-37).

---

### Story 2.4: Similar-Deal Matching with Stated Similarity Reason

As **ARIA**, I want to find past deals similar to the current one by service type and client industry/size, and attach a stated similarity reason, so that Deal Intelligence reads are grounded in real pattern evidence rather than generic domain knowledge alone.

**Acceptance Criteria:**

**Given** a deal's `service_type` and the client's `industry` and `company_size` are known, **when** the Deal Intelligence specialist calls `find_similar_deals(service_type, industry, size)`, **then** the tool queries the `deals` table filtered by `owner_id`, `service_type`, and optionally `industry`/`company_size`; only records with `is_stub=false` are returned; each result includes `deal_id`, `title`, `predicted_outcome`, `risk_flags`, and a `similarity_reason` field explaining why the match is relevant (FR-10, FR-37).

**Given** `find_similar_deals` returns one or more results, **when** ARIA includes them in the Deal Intelligence read, **then** ARIA explicitly states the pattern basis in its response (e.g. "Based on your last 3 F&B web-design deals…") and the `similar_deals` jsonb field on the current deal is updated with the matched `deal_id`s and their `similarity_reason`s (FR-10, AD-14).

**Given** no matching non-stub deals exist for the current service type and industry, **when** `find_similar_deals` returns an empty result, **then** ARIA reasons from domain knowledge and explicitly says so in its response ("No similar past deals — reasoning from domain knowledge") — the `similar_deals` field on the deal is set to an empty array, not left null (FR-10, FR-6).

**Given** similar deals are populated on a deal record, **when** ARIA later updates the `similar_deals` field with the same list of `deal_id`s and `similarity_reason`s (no material change), **then** no activity log row is written (AD-14 idempotent writes log nothing on no-op).

**Given** similar deals are populated and the activity log entry was previously written, **when** a new similar deal is identified and added to the list, **then** the activity log records `action="similar_deals_updated"`, `actor=ai`, with `payload` showing the added entry (AD-14).

---

### Story 2.5: AI-Maintained Intelligence Fields — Idempotent Updates with Provenance

As **ARIA**, I want to update deal and client intelligence fields automatically after a Deal Intelligence session, with full provenance and idempotency, so that the Owner's records improve over time without any manual effort and without clobbering human edits.

**Acceptance Criteria:**

**Given** a Deal Intelligence session has produced new signals (new `inferred_real_need`, changed `risk_flags`, updated `opportunity_signals`, revised `predicted_outcome`/`prediction_reason`), **when** the session concludes and ARIA calls `update_deal(id, fields)`, **then** all changed intelligence fields are written in a single call; the activity log records one entry per changed field (or one entry for the batch) with `actor=ai`, `action="intelligence_fields_updated"`, and `payload` containing the old and new values (FR-8, AD-14).

**Given** a Deal Intelligence session produces intelligence field values identical to those already stored, **when** ARIA calls `update_deal` with those values, **then** no database write occurs (or the write is skipped before execution) and no activity log row is appended — the update is a no-op (AD-14 idempotent AI writes).

**Given** the Owner has previously set `inferred_real_need` to a specific value via conversation (`actor=user` in the log), **when** a subsequent AI session would overwrite it with a different value, **then** ARIA does not silently overwrite it; instead ARIA proposes the new inference in its response ("I now read their real need as X — want me to update the record?") and writes only after the Owner confirms (AD-14 human edits not silently overwritten).

**Given** a Deal Intelligence session extracts new signals about a client's `communication_style` or `known_hesitations`, **when** ARIA calls `update_client(id, fields)` with the updated values, **then** the client record is updated, the activity log records `actor=ai`, and the same idempotency and human-edit-protection rules apply as for deal fields (FR-8, AD-14).

**Given** a Deal Intelligence session is run multiple times for the same deal with the same conversation input (e.g. a retry), **when** each run attempts to write intelligence fields, **then** only the first run that produces a change writes to the log; subsequent identical writes are no-ops — the log does not accumulate duplicate entries for the same change (AD-14).

**Given** intelligence fields are written with `actor=ai`, **when** the activity log entry is inspected, **then** it includes a `source` field naming the originating reasoning path (e.g. `"deal_intelligence"`, `"proactive_checkin"`) so the provenance is auditable (AD-14).

---

### Story 2.6: Conversational Data Maintenance — Full Client and Deal Lifecycle via Chat

As an **Owner**, I want to create, advance, and correct any client or deal entirely through natural language conversation — including stage transitions, field corrections, and relationship notes — so that I never need to open a data-entry form to keep my CRM current.

**Acceptance Criteria:**

**Given** the Owner types a description of a new client and deal in chat (e.g. "Just met an F&B chain owner who wants a website and maybe automation, budget unclear"), **when** the orchestrator processes the message, **then** ARIA calls `create_client_stub` and `create_deal_stub`, confirms creation in its reply ("I've created a stub for [name] linked to a new deal"), and asks no more than 2 gap-filling questions in the same turn (FR-31, FR-7).

**Given** a deal exists in stage "Discovery," **when** the Owner says "the Hanoi restaurant signed off on scope, moving to proposal" in chat, **then** ARIA calls `update_deal` to advance the stage, the old stage is appended to `stage_history` (jsonb), the activity log records `action="stage_changed"`, `actor=user`, and ARIA confirms the transition and recommends the next document or action (FR-31, AD-14).

**Given** a client or deal record has incorrect information, **when** the Owner says "actually their budget is 80 million VND, not 50" in chat, **then** ARIA calls `update_deal` with the corrected `value_estimate`, the activity log records `actor=user`, and ARIA confirms the correction in its reply (FR-31).

**Given** the Owner wants to check the full conversational maintenance lifecycle without ever opening a UI form, **when** a complete sequence of create → enrich → stage-advance → correct → close is performed via chat messages alone, **then** all state transitions are reflected in the DB and activity log, and no form submission is required at any step (FR-31).

**Given** a minimal manual edit surface exists in the UI (e.g. an inline field editor on a client/deal detail view), **when** the Owner uses it to edit a field, **then** the same `update_client`/`update_deal` tool path is invoked and the activity log records `actor=user` — the manual surface reuses the same write path, it is not a separate code path (FR-31 assumption: manual surface exists but is never on the critical path).

**Given** the Owner closes a deal via conversation ("mark the Pho 24 deal as won"), **when** ARIA processes the message, **then** ARIA calls `update_deal` to set `stage="Won"`, `predicted_outcome="likely_win"`, appends to `stage_history`, writes an activity log entry with `actor=user`, and offers to create a win-note or next document (FR-31, AD-14).

---

### Story 2.7: Intelligence Field Persistence Across Sessions (Context Reconstruction)

As **ARIA**, I want intelligence fields and activity history persisted in the CRM to be the sole durable record of what is known about a deal or client, so that every new session reconstructs full context from the DB rather than relying on chat transcript memory.

**Acceptance Criteria:**

**Given** a Deal Intelligence session has concluded and intelligence fields have been written to the deal record, **when** the Owner starts a new conversation session (new browser tab, next-day open, or "Start new topic"), **then** ARIA reconstructs deal context by calling `get_deal` and `get_client` via tools and has access to all previously written intelligence fields — without re-reading any prior conversation transcript (AD-3, FR-35).

**Given** a new session begins and the orchestrator loads Business Context (≤~2,000 tokens per AD-3/FR-4), **when** the Owner asks about a specific deal, **then** ARIA fetches only that deal and its client via tools (not the entire CRM) and the reconstructed context fits within the per-DI-call context budget (AD-3, AD-5).

**Given** `similar_deals` is populated on a deal record from a prior session, **when** a new Deal Intelligence session runs for the same deal, **then** ARIA calls `find_similar_deals` again to get fresh matches (in case new deals have been added) but also reads the stored `similar_deals` field as a prior-session baseline — if results are unchanged, no new activity log entry is written (AD-14 idempotency).

**Given** the `activity_log` contains a history of field changes for a deal, **when** ARIA is asked "what has changed on this deal recently?" in conversation, **then** ARIA queries the activity log for that `entity_id` and summarizes the material changes in chronological order — the log is the source of truth, not the chat history (AD-3, FR-30).

**Given** the activity log contains entries with `actor=ai` and `actor=user`, **when** ARIA summarizes deal history, **then** it correctly attributes each change (e.g. "You updated the budget on June 10; I revised the risk flags after our session on June 12") so the Owner understands who changed what (FR-30, AD-14).

**Given** the "Start new topic" action is triggered in the chat UI, **when** conversation context is cleared, **then** all CRM data (clients, deals, documents, activity log, intelligence fields) remains fully intact in the database — only the in-memory conversation window is reset (AD-3, FR-35).
