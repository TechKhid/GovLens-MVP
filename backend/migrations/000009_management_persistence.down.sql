DROP INDEX IF EXISTS idx_briefings_pinned;
DROP INDEX IF EXISTS idx_briefings_post_type;

ALTER TABLE briefings
    DROP COLUMN IF EXISTS views,
    DROP COLUMN IF EXISTS pinned,
    DROP COLUMN IF EXISTS sectors,
    DROP COLUMN IF EXISTS post_type;

ALTER TABLE issues
    DROP COLUMN IF EXISTS internal_notes,
    DROP COLUMN IF EXISTS assignee;
