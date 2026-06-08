ALTER TABLE mp_profiles
    DROP CONSTRAINT IF EXISTS mp_profiles_profile_status_check;

ALTER TABLE mp_profiles
    DROP COLUMN IF EXISTS archive_reason,
    DROP COLUMN IF EXISTS archived_at,
    DROP COLUMN IF EXISTS profile_status;
