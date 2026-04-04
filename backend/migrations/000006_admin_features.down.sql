DROP TABLE IF EXISTS audit_logs;

ALTER TABLE users
DROP COLUMN IF EXISTS login_suspended,
DROP COLUMN IF EXISTS content_hidden;
