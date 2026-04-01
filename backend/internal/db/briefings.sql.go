package db

import (
	"context"

	"github.com/jackc/pgx/v5/pgtype"
)

const listBriefings = `-- name: ListBriefings :many
SELECT id, mp_id, title, content, zone, published_at, created_at
FROM briefings
ORDER BY published_at DESC
LIMIT $1 OFFSET $2
`

type ListBriefingsParams struct {
	Limit  int32 `json:"limit"`
	Offset int32 `json:"offset"`
}

func (q *Queries) ListBriefings(ctx context.Context, arg ListBriefingsParams) ([]Briefing, error) {
	rows, err := q.db.Query(ctx, listBriefings, arg.Limit, arg.Offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []Briefing
	for rows.Next() {
		var b Briefing
		if err := rows.Scan(
			&b.ID,
			&b.MpID,
			&b.Title,
			&b.Content,
			&b.Zone,
			&b.PublishedAt,
			&b.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, b)
	}
	return items, rows.Err()
}

const createBriefing = `-- name: CreateBriefing :one
INSERT INTO briefings (mp_id, title, content, zone)
VALUES ($1, $2, $3, $4)
RETURNING id, mp_id, title, content, zone, published_at, created_at
`

type CreateBriefingParams struct {
	MpID    pgtype.UUID `json:"mp_id"`
	Title   string      `json:"title"`
	Content string      `json:"content"`
	Zone    pgtype.Text `json:"zone"`
}

func (q *Queries) CreateBriefing(ctx context.Context, arg CreateBriefingParams) (Briefing, error) {
	row := q.db.QueryRow(ctx, createBriefing,
		arg.MpID,
		arg.Title,
		arg.Content,
		arg.Zone,
	)
	var b Briefing
	err := row.Scan(
		&b.ID,
		&b.MpID,
		&b.Title,
		&b.Content,
		&b.Zone,
		&b.PublishedAt,
		&b.CreatedAt,
	)
	return b, err
}
