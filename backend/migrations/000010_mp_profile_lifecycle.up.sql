ALTER TABLE mp_profiles
    ADD COLUMN profile_status TEXT NOT NULL DEFAULT 'active',
    ADD COLUMN archived_at TIMESTAMPTZ,
    ADD COLUMN archive_reason TEXT NOT NULL DEFAULT '';

ALTER TABLE mp_profiles
    ADD CONSTRAINT mp_profiles_profile_status_check
    CHECK (profile_status IN ('active', 'archived'));
