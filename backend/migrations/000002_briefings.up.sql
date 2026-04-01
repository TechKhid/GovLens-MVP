CREATE TABLE briefings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mp_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    zone TEXT,
    published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Spatial index for heatmap queries (lat/lng columns exist already)
-- Using a functional index on point() since we don't have PostGIS
CREATE INDEX idx_issues_location ON issues(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Briefing lookup indexes
CREATE INDEX idx_briefings_zone ON briefings(zone);
CREATE INDEX idx_briefings_published ON briefings(published_at DESC);
