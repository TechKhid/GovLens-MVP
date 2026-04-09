-- Add ML-enriched columns to issues
ALTER TABLE issues
    ADD COLUMN IF NOT EXISTS sentiment_score DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;

-- Backfill resolved_at from updated_at for already-resolved issues
UPDATE issues
SET resolved_at = updated_at
WHERE status = 'resolved' AND resolved_at IS NULL;

-- Index for response-time trend queries
CREATE INDEX IF NOT EXISTS idx_issues_resolved_at ON issues(resolved_at)
    WHERE resolved_at IS NOT NULL;
