# PDPL Pre-Launch Compliance Checklist

Vietnam Personal Data Protection Law (Decree 356/2025, effective 2026-01-01).
ARIA is the data processor; each Owner is the data controller for their own client/deal data.

**ALL THREE items below must be marked COMPLETE before production launch (OQ-10).**

---

## Gate 1 — Anthropic Data Processing Agreement (DPA)

**Status: PENDING**

Execute a Data Processing Agreement with Anthropic covering:
- ARIA's use of the Anthropic API to process owner-uploaded client and deal PII
- Data retention and deletion obligations on Anthropic's side
- Cross-border data transfer terms (Vietnam → US)

Action: Legal must initiate the DPA request via Anthropic's enterprise portal.

---

## Gate 2 — Cross-Border Data Transfer Impact Assessment (CDTIA)

**Status: PENDING**

File a Cross-Border Data Transfer Impact Assessment with Vietnam's Ministry of Public Security
(Bộ Công an), naming Anthropic as the foreign processor receiving Vietnamese personal data.

Required under Decree 356/2025 Art. 25 before any transfer of Vietnamese personal data to a
foreign country. Anthropic's servers are located in the United States.

Action: Legal / compliance team to complete and file the CDTIA form with the Ministry.

---

## Gate 3 — Full Privacy Policy page published at `/privacy`

**Status: PENDING**

The `/privacy` route currently serves a placeholder stub (see `app/(public)/privacy/page.tsx`).
Before launch, replace the stub with a full, Vietnamese-language privacy policy that covers:

- Categories of personal data collected (client name, contact, deal descriptions, screenshots)
- Purpose of processing (AI analysis via Anthropic)
- Data retention periods (90 days for screenshots; indefinite for CRM records until owner deletes)
- Owner's rights (access, correction, deletion — exercised via ARIA's Settings)
- Cross-border transfer disclosure (Anthropic, United States)
- Contact information for data-related requests

Action: Legal drafts the full policy; engineering deploys it by replacing the stub content.

---

## Build items completed in Story 0.8 (not launch gates)

- [x] In-product AI-processing privacy notice (one-time modal, `PrivacyNoticeModal.tsx`)
- [x] `settings.ai_processing_notice_acknowledged_at` column (migration `20260626020000_...`)
- [x] Owner-deletable client and deal records (`deleteService.ts`, DELETE API routes)
- [x] Storage screenshot cleanup on deletion (`services/deleteService.ts`)
- [x] 90-day retention policy documented (`supabase/storage-lifecycle.md`)
- [ ] pg_cron screenshot purge job (stub — requires Epic 4 scheduler, see `storage-lifecycle.md`)
