# Supabase Storage — Screenshots Bucket Lifecycle Policy

## Bucket configuration

- **Bucket name:** `screenshots`
- **Public:** `false` (owner-scoped; requires authenticated session to access)
- **Path convention:** `{owner_id}/screenshots/{uuid}-{original_filename}`
- **Column reference:** `deals.file_url` stores the full Storage path (not a signed URL)

### One-time bucket setup (run once per environment)

```bash
supabase storage create screenshots --no-public
```

Or via the Supabase dashboard: Storage → New bucket → name: `screenshots`, Public: off.

## Retention policy — 90 days

Screenshots are disposable after AI extraction. The durable record is the extracted CRM data
written to the `deals` table. Raw images should be purged after 90 days.

### Target configuration

Set a lifecycle rule on the `screenshots` bucket to expire objects 90 days after upload.

As of mid-2026, Supabase Storage does not expose a native object-lifecycle API (comparable to
S3 lifecycle rules). The policy is therefore enforced via a scheduled database job.

### Fallback: pg_cron cleanup job (stub — requires Epic 4 scheduler)

The cleanup job will be implemented in Epic 4 alongside the other `pg_cron` schedulers.
The job logic when implemented:

```sql
-- Run daily. Deletes Storage objects older than 90 days via the Supabase Storage API.
-- Requires the pg_net extension and the service-role key (Epic 4 Edge Function scope).
SELECT cron.schedule(
  'purge-old-screenshots',
  '0 2 * * *',  -- 02:00 UTC daily
  $$
    -- Identify expired screenshot paths
    -- Then call storage delete for each (via pg_net HTTP or Edge Function)
    -- Implementation: see supabase/functions/purge-screenshots/ (Epic 4)
  $$
);
```

Until Epic 4 is shipped, screenshots older than 90 days are cleaned up on owner-triggered
deletion (via `deleteService.ts`) but NOT automatically purged. This is acceptable for pre-launch
scale; document as a known gap in `PDPL-LAUNCH-CHECKLIST.md`.

## Manual cleanup (interim)

If a bulk purge is needed before the scheduler is live:

```sql
-- Query Storage metadata (requires service-role access in psql)
SELECT name, created_at
FROM storage.objects
WHERE bucket_id = 'screenshots'
  AND created_at < now() - interval '90 days';
-- Then delete via Supabase dashboard or Storage API
```
