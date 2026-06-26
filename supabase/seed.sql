-- ============================================================
-- ARIA Dev Seed — Local only
-- Applied by `supabase db reset` after all migrations
-- Creates two test owners + one client each for RLS verification (AC6)
-- ============================================================

DO $$
DECLARE
  owner_a uuid := '00000000-0000-0000-0000-000000000001';
  owner_b uuid := '00000000-0000-0000-0000-000000000002';
BEGIN
  -- Insert two test identities into auth.users (local dev only)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin
  ) VALUES
    (owner_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'owner-a@test.local', '', NOW(), NOW(), NOW(),
     '{"provider":"email","providers":["email"]}', '{}', false),
    (owner_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'owner-b@test.local', '', NOW(), NOW(), NOW(),
     '{"provider":"email","providers":["email"]}', '{}', false)
  ON CONFLICT (id) DO NOTHING;

  -- Seed one client per owner
  -- Runs as postgres superuser (bypasses RLS) so no JWT context needed
  INSERT INTO clients (id, owner_id, name)
  VALUES
    ('10000000-0000-0000-0000-000000000001', owner_a, 'Owner A - Test Client'),
    ('10000000-0000-0000-0000-000000000002', owner_b, 'Owner B - Test Client')
  ON CONFLICT (id) DO NOTHING;
END $$;
