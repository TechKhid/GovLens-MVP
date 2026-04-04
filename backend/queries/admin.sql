-- name: GetAdminStats :one
SELECT 
  (SELECT count(*) FROM users) as total_users,
  (SELECT count(*) FROM users WHERE role = 'mp') as active_mps,
  (SELECT count(*) FROM issues) as total_issues;

-- name: ListAllUsers :many
SELECT id, name, email, role, constituency, login_suspended, content_hidden, created_at 
FROM users 
ORDER BY created_at DESC;

-- name: UpdateUserFlags :one
UPDATE users 
SET login_suspended = $2, content_hidden = $3
WHERE id = $1
RETURNING id, name, email, role, constituency, login_suspended, content_hidden, created_at;

-- name: UpdateUserRole :one
UPDATE users 
SET role = $2
WHERE id = $1
RETURNING id, name, email, role, constituency, login_suspended, content_hidden, created_at;

-- name: InsertAuditLog :one
INSERT INTO audit_logs (actor_id, action, target_id)
VALUES ($1, $2, $3)
RETURNING *;

-- name: ListAuditLogs :many
SELECT a.id, a.action, a.created_at, 
       u1.name as actor_name, u1.email as actor_email,
       u2.name as target_name, u2.email as target_email
FROM audit_logs a
LEFT JOIN users u1 ON a.actor_id = u1.id
LEFT JOIN users u2 ON a.target_id = u2.id
ORDER BY a.created_at DESC
LIMIT 50;
