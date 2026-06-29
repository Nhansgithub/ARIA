-- Create private screenshots bucket for owner-scoped image storage (AD-9, AD-2)
INSERT INTO storage.buckets (id, name, public)
VALUES ('screenshots', 'screenshots', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: owner can upload to their own prefix only
CREATE POLICY "owner_screenshots_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS: owner can read their own screenshots
CREATE POLICY "owner_screenshots_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
