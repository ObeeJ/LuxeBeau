-- Migration 0002: a social handle is unique only when it is set.
--
-- Many people have no handle (stored as ''). A plain unique index treated '' as
-- one shared value, so the second person to save a profile without a handle was
-- told "that handle is already taken". AutoMigrate creates the partial index on
-- new databases from the struct tag in domain/social.go; this migration fixes a
-- database where the table was created earlier with the plain unique index.
--
-- ROLLBACK (restores the old behaviour; fails if two profiles have no handle):
--   DROP INDEX IF EXISTS idx_user_profiles_social_handle;
--   CREATE UNIQUE INDEX idx_user_profiles_social_handle ON user_profiles (social_handle);

DO $$
BEGIN
  IF to_regclass('public.user_profiles') IS NOT NULL THEN
    DROP INDEX IF EXISTS idx_user_profiles_social_handle;
    CREATE UNIQUE INDEX idx_user_profiles_social_handle
      ON user_profiles (social_handle)
      WHERE social_handle <> '';
  END IF;
END $$;
