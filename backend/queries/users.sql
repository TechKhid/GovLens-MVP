-- name: CreateUser :one
INSERT INTO users (name, email, password_hash, role, constituency)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = $1;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1;

-- name: CreateMPProfile :one
INSERT INTO mp_profiles (user_id, party, term_start, term_end, bio, phone, office_addr, photo_url)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;
