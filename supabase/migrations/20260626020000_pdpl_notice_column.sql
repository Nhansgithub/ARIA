-- Story 0.8 (AD-10): PDPL privacy notice acknowledgement timestamp
-- NULL = owner has not yet acknowledged the AI-processing privacy notice
-- non-null = timestamp of explicit acknowledgement; notice is suppressed thereafter
ALTER TABLE settings
  ADD COLUMN ai_processing_notice_acknowledged_at timestamptz DEFAULT NULL;
