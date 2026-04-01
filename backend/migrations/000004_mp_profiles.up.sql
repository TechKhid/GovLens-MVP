CREATE TABLE mp_profiles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    party       TEXT NOT NULL DEFAULT '',
    term_start  TEXT NOT NULL DEFAULT '',
    term_end    TEXT NOT NULL DEFAULT '',
    bio         TEXT NOT NULL DEFAULT '',
    phone       TEXT NOT NULL DEFAULT '',
    office_addr TEXT NOT NULL DEFAULT '',
    photo_url   TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_mp_profiles_user_id ON mp_profiles(user_id);
