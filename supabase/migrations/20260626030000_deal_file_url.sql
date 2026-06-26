-- Story 0.8 corrective: add file_url to deals for screenshot Storage paths (AD-9)
-- Screenshots uploaded for deal intelligence analysis are stored at:
--   {owner_id}/screenshots/{uuid}-{filename}
-- This path is written to deals.file_url by the vision pipeline (Story 1.9).
-- The deleteService reads this column to clean up Storage on deal deletion.
ALTER TABLE deals
  ADD COLUMN file_url text DEFAULT NULL;
