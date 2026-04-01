-- name: CreateComment :one
INSERT INTO comments (issue_id, user_id, content)
VALUES ($1, $2, $3)
RETURNING *;

-- name: ListCommentsByIssue :many
SELECT c.*, u.name as user_name
FROM comments c
JOIN users u ON c.user_id = u.id
WHERE c.issue_id = $1
ORDER BY c.created_at ASC;
