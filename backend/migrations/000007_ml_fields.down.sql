ALTER TABLE issues
    DROP COLUMN IF EXISTS sentiment_score,
    DROP COLUMN IF EXISTS resolved_at;

DROP INDEX IF EXISTS idx_issues_resolved_at;
