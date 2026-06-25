## Epic 3: Documents

**Goal:** The Owner can produce, view, version, and export business documents through an elicitation-first conversation — ARIA never generates a full document without outline approval, every save is a retained version, and ARIA teaches which document the deal needs and why.

---

### Story 3.1: Document Data Layer, Status Lifecycle, and Versioning

As an Owner, I want every document I create to be persisted with a full version history and a clear status lifecycle, so that I always have a traceable, recoverable record of every draft and its current state.

**Acceptance Criteria:**

**Given** the `documents` table defined in addendum.md §B.3 does not yet exist,
**When** the Epic 3 migration runs,
**Then** the table is created with columns: `id`, `owner_id` (FK → auth user, AD-2), `deal_id` (FK nullable), `client_id` (FK nullable), `type` (enum: `proposal | contract | brief | sop | report | invoice | onboarding | other`), `title` (text), `status` (enum: `draft | review | sent | signed | archived`), `content_md` (text), `file_url` (text, nullable — Storage path to PDF), `version` (int, default 1), `created_by` (enum: `ai | human`), `created_at`, `updated_at`.
**And** a Postgres RLS policy exists on `documents` that allows SELECT/INSERT/UPDATE/DELETE only where `owner_id = auth.uid()`, enforcing AD-2 owner-scoping with no service-role bypass on owner-data paths (AD-13).

**Given** a `documents` row exists for the authenticated owner,
**When** ARIA or the Owner modifies `content_md` (via the `create_document` or an edit action),
**Then** a new row is inserted (not an UPDATE to the existing row) with `version = previous_version + 1`, all other fields copied forward, and the previous row retained unchanged — implementing AD-14's append-only versioning model.
**And** the new row's `created_by` is set to `ai` if the modification originated from an AI tool call, or `human` if the Owner typed it directly.

**Given** a document exists at version N,
**When** the Owner or a tool sets `status` to any value in the lifecycle (`draft → review → sent → signed | archived`),
**Then** the status change is applied to the current version row,
**And** an `activity_log` entry is written with `entity_type=document`, `entity_id`, `action="status_changed"`, `actor` (ai|user), `payload={from_status, to_status}` — satisfying FR-20 and AD-14 (material changes logged, no-op writes log nothing).

**Given** a document's `status` is updated to `sent`,
**When** the activity log entry is written,
**Then** it includes `payload.sent_at` timestamp and the `actor` value reflects whether the change was triggered by the Owner or by ARIA.

**Given** a document naming requirement (FR-20),
**When** a document is saved (new or versioned),
**Then** its `title` follows the pattern `{ClientName}_{DocumentType}_{YYYY-MM-DD}_v{N}` where `YYYY-MM-DD` is the creation date of this version and `N` is the integer version number — e.g. `PhuLong_Proposal_2026-06-25_v1`.

**Given** the Owner queries for documents linked to a specific deal or client,
**When** the query executes,
**Then** only documents with matching `deal_id` or `client_id` **and** `owner_id = auth.uid()` are returned — no cross-owner data is reachable (AD-2).

---

### Story 3.2: Elicitation → Outline → Generate Flow

As an Owner, I want ARIA to ask me targeted questions and present a draft outline for my approval before writing a full document, so that I never receive an off-target document and always feel in control of what gets produced.

**Acceptance Criteria:**

**Given** the Owner sends a message that the Orchestrator classifies as a document-creation request (FR-1, e.g. "Draft a proposal for the Hanoi restaurant client" / "Soạn đề xuất cho khách nhà hàng Hà Nội"),
**When** the Orchestrator routes to the Document specialist (AD-4: elicitation uses Haiku; drafting uses Sonnet),
**Then** ARIA does NOT generate a full document — it first calls `get_deal` and `get_client` via the CRM tool surface to retrieve existing context (AD-1, AD-3).

**Given** ARIA has fetched deal and client context and identified missing information required for the requested document type (cross-referencing the template fields in addendum.md §E),
**When** ARIA responds,
**Then** it asks no more than 3 targeted questions in that turn (FR-19) — the questions are ranked by criticality (e.g. budget confirmed? decision-maker? timeline?) and framed in the Owner's current language (FR-2, e.g. Vietnamese if the Owner's message was Vietnamese).
**And** if all required information is already present in the deal/client record, ARIA skips elicitation and proceeds directly to the outline step.

**Given** the Owner answers the elicitation questions (in one or multiple turns until all critical fields are resolved),
**When** ARIA is ready to proceed,
**Then** ARIA presents a numbered draft outline — title + one-line description per section — and explicitly asks for approval before generating the full document (FR-19):
- Vietnamese: "Outline này ổn không anh? Anh có muốn thêm hoặc bỏ phần nào không?"
- English: "Does this outline work? Any sections to add or remove?"

**Given** the Owner requests a change to the outline (e.g. "Add a section on workflow"),
**When** ARIA receives the revision request,
**Then** ARIA updates the outline and re-presents it for confirmation — no full document is generated until the Owner gives explicit approval (FR-19 invariant: full generation is always gated on outline approval).

**Given** the Owner explicitly approves the outline (e.g. "OK, go ahead" / "Được rồi, viết đi"),
**When** ARIA generates the full document,
**Then** the generation call is routed to Sonnet (AD-4: document drafting = high-judgment tier),
**And** the document language follows the Client's `language_pref` (default Vietnamese for Vietnamese-market clients, FR-2),
**And** the content follows the relevant template scaffold from addendum.md §E (e.g. Proposal: Understanding → Deliverables → How We Work → Timeline → Investment → Next Step),
**And** the document is written in ARIA's client-facing Vietnamese register when applicable: warm, relationship-preserving, appropriately hierarchical (Anh/Chị for the client), no urgency language (PRD §10).

**Given** the full document has been generated,
**When** ARIA saves it via `create_document`,
**Then** a `documents` row is created with `status=draft`, `version=1`, `created_by=ai`, and the `title` in `{ClientName}_{DocumentType}_{YYYY-MM-DD}_v1` format (FR-20),
**And** an `activity_log` entry is written with `action="document_created"`, `actor=ai`.

**Given** the document is saved,
**When** ARIA responds in Chat,
**Then** ARIA explains in one sentence why this document matters at this deal stage (guidance stance, FR-3, FR-22 teaching rationale) — e.g.: "Em đã lưu đề xuất này. Đây là bước quan trọng vì đề xuất rõ ràng giúp anh kiểm soát kỳ vọng của khách trước khi ký hợp đồng."
**And** the panel switches to the Document Viewer (FR-32, UJ-4) displaying the newly created document.

---

### Story 3.3: Document Viewer — Read, Edit, and Version History

As an Owner, I want a dedicated document viewer where I can read, edit, change status, and browse version history, so that I have full visibility and control over my document vault without leaving the app.

**Acceptance Criteria:**

**Given** a Document is created (Story 3.2) or retrieved from the Docs nav list,
**When** the main panel switches to Document Viewer mode (FR-32),
**Then** the viewer header displays: document `title` (editable inline), a status pill showing the current `status` with label in Vietnamese/English (draft=Nháp, review=Đang xét, sent=Đã gửi, signed=Đã ký, archived=Lưu trữ), a linked deal/client chip (tappable — opens deal context in Chat), and a version selector showing the current version number (e.g. "v3").

**Given** the Owner is in the Document Viewer,
**When** they tap "Edit",
**Then** the body switches to a markdown textarea ({typography.mono}) and the Owner can modify `content_md`.
**And** on 2-second idle or explicit "Save" press, the system creates a new version row (Story 3.1 versioning rule: insert new row, `version = N+1`, `created_by=human`),
**And** the header version selector silently updates to the new version number,
**And** an `activity_log` entry is written with `action="document_edited"`, `actor=user`.

**Given** the Owner selects a different version from the version selector in the header,
**When** the selection is made,
**Then** the viewer body renders the `content_md` of the selected version (read-only) — the user is not editing a past version but previewing it.

**Given** the Owner taps "History" in the viewer toolbar,
**When** the slide-over opens,
**Then** it lists all versions of the document in reverse chronological order, each showing: version number, `created_by` (displayed as "ARIA" or "You"), and `created_at` timestamp.
**And** clicking any version entry shows a side-by-side diff of that version vs the previous one, with added lines highlighted in {colors.success} tint and removed lines in {colors.danger} tint (EXPERIENCE.md Document Viewer rules).

**Given** the Owner taps "Change Status" in the viewer toolbar,
**When** the inline dropdown opens (no modal),
**Then** it shows only legally forward-moving transitions: draft → review → sent → signed | archived (plus "archive" from any state).
**And** selecting "Sent" prompts: "Ghi vào lịch sử hoạt động không?" / "Log to activity feed?" with [Yes (default)] [No] chips.
**And** on confirmation, `status` is updated and an `activity_log` entry is written (FR-20 lifecycle + AD-14).

**Given** the Owner taps "Ask ARIA about this doc" in the viewer toolbar,
**When** the action fires,
**Then** the viewer closes, the Chat panel opens, and the input bar is pre-populated with "Tell me about [document title]" (editable, not auto-sent — Owner agency preserved per EXPERIENCE.md).

**Given** the Docs nav item is tapped,
**When** the panel opens,
**Then** it shows a filterable list of all documents belonging to the Owner, with columns: title, type, status pill, linked client/deal, last-modified date — filterable by status and client.
**And** tapping any document in the list opens the Document Viewer for that document.

---

### Story 3.4: PDF Export to Storage

As an Owner, I want to export any document to a styled PDF that is saved to storage and downloadable, so that I can send a professional-looking file to my client without leaving ARIA.

**Acceptance Criteria:**

**Given** a document exists in the Document Viewer with any status,
**When** the Owner taps "Export PDF" in the toolbar,
**Then** the server generates a PDF from the document's `content_md` using the configured PDF renderer (html-pdf-node / Puppeteer, addendum.md §A) — no AI call is made at any point during PDF export (FR-21, PRD §8 "What never hits the API").

**Given** the PDF generation request is received server-side,
**When** generation completes,
**Then** the PDF is uploaded to Supabase Storage under an owner-scoped path (AD-2, AD-9) — e.g. `owner_id/documents/{document_id}_v{N}.pdf`,
**And** the `documents` row for the current version has its `file_url` field updated to the Storage path,
**And** an `activity_log` entry is written with `action="pdf_exported"`, `actor=user`, `payload={version, file_url}`.

**Given** the PDF has been saved to Storage,
**When** the server returns the response to the client,
**Then** the file is offered as a download with the filename `{ClientName}_{DocumentType}_{YYYY-MM-DD}_v{N}.pdf` matching the document's title convention (FR-20, FR-21),
**And** the "Export PDF" button in the viewer shows a spinner during generation and returns to its default state on completion — other viewer actions (Edit, Change Status, History) remain enabled during export.

**Given** PDF generation fails (server error, renderer crash),
**When** the failure response reaches the client,
**Then** a toast is shown: "Xuất PDF thất bại — thử lại" / "PDF export failed — try again" (EXPERIENCE.md Error states),
**And** no partial file is stored in Storage,
**And** `file_url` on the document row is not updated.

**Given** a PDF has been previously exported for a document version (i.e. `file_url` is non-null),
**When** the Owner taps "Export PDF" again on the same version,
**Then** the system re-generates and overwrites the existing Storage object (idempotent export — AD-7 idempotency principle applied to storage ops),
**And** a fresh download is offered.

**Given** the PDF is styled (FR-21 branding placeholder),
**When** the PDF is rendered,
**Then** it applies the v1 brand placeholder (ARIA logo placeholder, color palette header/footer, agency name from Business Context) — full branding is deferred to the UX branding step per the assumption in PRD §4.5 (FR-21).

---

### Story 3.5: Missing-Document Detection and Teaching

As an Owner, I want ARIA to detect when a deal's stage implies a document should exist but doesn't, and explain why that document matters now, so that I never silently miss a critical step in the client relationship.

**Acceptance Criteria:**

**Given** the missing-document detection logic runs (triggered during: daily Briefing generation, a Deal Intelligence read for a specific deal, or any pipeline status query for that deal),
**When** ARIA evaluates a deal's current `stage` against the expected document set for that `service_type` and `stage`,
**Then** ARIA identifies a "missing document" when: a deal's stage is at or past the threshold for a document type AND no `documents` row exists for that `(deal_id, type)` with `status` in `(draft, review, sent, signed)`.

The default detection rules are:
- Stage contains "proposal" / "đề xuất" / "sent" AND no `proposal` document → flag.
- Stage contains "contract" / "hợp đồng" / "signed" / "SOW" AND no `contract` document → flag.
- Stage contains "brief" / "discovery confirmed" / "kickoff" AND no `brief` document → flag.
- Stage contains "onboarding" / "started" AND no `onboarding` document → flag.

**Given** a missing-document flag is detected for a deal,
**When** ARIA surfaces it in a Briefing "Documents Pending" section or in a Chat reply,
**Then** the flag includes: the document type missing, the deal name, and a one-line teaching rationale explaining why this document matters now (FR-22 guidance stance) — the rationale is specific to the document type:
- Proposal missing after proposal stage: "Đề xuất bằng văn bản giúp anh kiểm soát kỳ vọng và có căn cứ để theo dõi — không có nó, khách dễ hiểu sai phạm vi." / "A written proposal sets expectations and creates an accountability baseline — without it, scope misalignment is hard to catch early."
- Contract missing after contract stage: "Hợp đồng bảo vệ cả hai bên nếu có tranh chấp về phạm vi hoặc thanh toán — anh nên có bản ký trước khi bắt đầu." / "A signed contract protects both parties if scope or payment disputes arise — you should have it before work begins."
- Brief missing at kickoff: "Brief giúp cả team và khách đồng thuận về mục tiêu trước khi thực hiện — thiếu nó thường dẫn đến scope creep." / "A project brief aligns everyone on goals before execution — missing it is the most common cause of scope creep."

**Given** a missing-document flag is surfaced in Chat,
**When** ARIA presents the flag,
**Then** ARIA appends a single offer to create the document: "Anh có muốn em soạn [document type] này không?" / "Shall I draft the [document type] now?" — tapping or responding Yes routes directly into the elicitation flow (Story 3.2).

**Given** a deal already has a document of the required type,
**When** detection runs,
**Then** no flag is generated for that type on that deal — detection is idempotent.

**Given** a deal is in `archived` or `likely_lost` / `at_risk` predicted state with no recent activity,
**When** missing-document detection runs,
**Then** no new missing-document flags are surfaced for that deal — flags are suppressed for inactive/closed deals to avoid noise.

**Given** detection runs server-side as part of Briefing generation (Epic 4) or a Deal Intelligence call,
**When** flags are generated,
**Then** each flag is written to `briefings.flags` (jsonb) or returned inline in the Chat response — no separate `document_flags` table is needed in Epic 3 (kept simple; the Briefing epic owns the flag persistence structure).

---

### Story 3.6: Inline Document Edit and Conversational Re-Generation

As an Owner, I want to ask ARIA to revise a document in conversation — or edit it directly in the viewer — so that I can iterate on a draft without starting the elicitation flow from scratch.

**Acceptance Criteria:**

**Given** a document is open in the Document Viewer with `status=draft` or `status=review`,
**When** the Owner sends a message in Chat referencing the open document (e.g. "Make the investment section shorter" / "Rút gọn phần ngân sách lại"),
**Then** ARIA identifies this as a document-revision request (not a new document request), fetches the current version's `content_md` via `get_document`, and applies the targeted revision using Sonnet (AD-4: document drafting tier),
**And** ARIA does NOT re-run the full elicitation→outline→generate flow — the outline approval gate (Story 3.2) only applies to initial document creation, not to revision of an approved document.

**Given** ARIA has generated the revised content,
**When** the revision is saved,
**Then** a new version row is created (`version = N+1`, `created_by=ai`) following Story 3.1 versioning rules,
**And** the Document Viewer's header version selector updates to the new version,
**And** an `activity_log` entry is written with `action="document_revised"`, `actor=ai`, `payload={from_version, to_version, revision_instruction}`.

**Given** the revision is complete,
**When** ARIA responds in Chat,
**Then** ARIA briefly describes what changed (e.g. "Em đã rút gọn phần ngân sách từ 3 đoạn xuống còn 1. Anh xem lại nhé." / "I've condensed the investment section from 3 paragraphs to 1. Take a look."),
**And** ARIA does not re-explain the teaching rationale already given at document creation (SM-C3: do not over-explain to the expert).

**Given** the Owner directly edits `content_md` in the viewer's Edit mode (Story 3.3),
**When** an autosave or explicit Save fires,
**Then** the new version is saved with `created_by=human` (Story 3.1),
**And** subsequent conversational revision requests from ARIA operate on this latest human-edited version — human edits are not silently overwritten (AD-14: human edits win over AI proposals).

**Given** a document with `status=sent`, `status=signed`, or `status=archived`,
**When** the Owner attempts to edit it (via Edit mode or conversational revision),
**Then** ARIA presents a confirmation: "Tài liệu này đã được gửi/ký. Anh có chắc muốn sửa không? Em sẽ lưu phiên bản mới." / "This document has already been sent/signed. Are you sure you want to edit? A new version will be saved.",
**And** on confirmation the edit proceeds with a new version row; the previously sent/signed version is preserved unchanged (append-only history, AD-14).

**Given** a document revision request is made while the Claude API is unavailable (FR-5, AD-6),
**When** the orchestrator detects the API failure,
**Then** ARIA returns a degraded response: "AI tạm thời không khả dụng — không thể sửa tài liệu lúc này. Anh có thể chỉnh trực tiếp trong trình xem." / "AI synthesis unavailable — can't revise the document right now. You can edit it directly in the viewer.",
**And** the Document Viewer's Edit mode remains fully functional (no AI required for direct edits).
