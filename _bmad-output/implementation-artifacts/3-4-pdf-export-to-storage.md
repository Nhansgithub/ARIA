---
story: 3-4
title: PDF Export to Storage
status: done
epic: 3
sprint: 1
implemented: 2026-06-29
---

# Story 3-4: PDF Export to Storage

## Summary

Implemented PDF export for documents, generating a PDF using `@react-pdf/renderer`, uploading to Supabase Storage in an owner-scoped path, updating the `file_url` column, logging the activity, and streaming the PDF back to the browser as a download.

## Files Created / Modified

- `lib/pdf/generatePdf.tsx` — Server-only PDF generation using `@react-pdf/renderer`. Renders teal ARIA header, document title, version/type subheader, and raw markdown body text. Exports `generatePdf(contentMd, meta): Promise<Buffer>`.
- `app/api/documents/[id]/export/route.ts` — POST route. Auth guard (AD-13), owner-scoped document fetch (AD-2), PDF generation, Supabase Storage upload with upsert, `file_url` update, activity log (`pdf_exported`), PDF download response.
- `components/documents/DocumentViewer.tsx` — Added `exporting` and `exportError` state, `handleExport()` function with programmatic blob download, "Export PDF" toolbar button (always enabled), and exportError banner.
- `lib/__tests__/pdfExport34.test.ts` — 12 static tests verifying file existence and source content.
- `package.json` — Added `test:pdf-export34` script.

## Architecture Decisions Honoured

- AD-2: Storage path and DB update both scoped with `owner_id`
- AD-11: `import 'server-only'` at line 1 of `generatePdf.tsx`
- AD-13: `createServerClient()` used exclusively (no service role)
- AD-14: Activity log append-only (`pdf_exported` action)
- AD-1: No `@anthropic-ai/sdk` in the export path

## CI Results

- `npx tsc --noEmit` — clean
- `npx next lint` — clean (pre-existing warnings in unrelated files only)
- `npm run test:pdf-export34` — 12/12 passed
