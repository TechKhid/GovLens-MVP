-- name: CreateIssue :one
INSERT INTO issues (user_id, title, description, zone, lat, lng)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: ListIssues :many
SELECT * FROM issues
WHERE (sqlc.narg('zone')::TEXT IS NULL OR zone = sqlc.narg('zone'))
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: GetIssue :one
SELECT * FROM issues WHERE id = $1;

-- name: UpdateIssueStatus :exec
UPDATE issues
SET status = $2, updated_at = NOW()
WHERE id = $1;

-- name: UpvoteIssue :exec
UPDATE issues
SET upvotes = upvotes + 1
WHERE id = $1;

-- name: ToggleUpvote :exec
WITH existing AS (
    SELECT 1 FROM issue_upvotes WHERE issue_upvotes.issue_id = $1 AND issue_upvotes.user_id = $2
),
inserted AS (
    INSERT INTO issue_upvotes (issue_id, user_id)
    SELECT $1, $2
    WHERE NOT EXISTS (SELECT 1 FROM existing)
    RETURNING 1
),
deleted AS (
    DELETE FROM issue_upvotes
    WHERE issue_upvotes.issue_id = $1 AND issue_upvotes.user_id = $2
    AND EXISTS (SELECT 1 FROM existing)
    RETURNING 1
)
UPDATE issues 
SET upvotes = upvotes + (SELECT count(*) FROM inserted) - (SELECT count(*) FROM deleted)
WHERE issues.id = $1;

-- name: ListIssuesWithUpvote :many
SELECT i.*, 
       EXISTS(SELECT 1 FROM issue_upvotes iu WHERE iu.issue_id = i.id AND iu.user_id = $3) AS is_upvoted
FROM issues i
WHERE (sqlc.narg('zone')::TEXT IS NULL OR i.zone = sqlc.narg('zone'))
ORDER BY i.created_at DESC
LIMIT $1 OFFSET $2;

-- name: GetIssueWithUpvote :one
SELECT i.*, 
       EXISTS(SELECT 1 FROM issue_upvotes iu WHERE iu.issue_id = i.id AND iu.user_id = $2) AS is_upvoted
FROM issues i WHERE i.id = $1;
