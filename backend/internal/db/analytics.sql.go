package db

import (
	"context"
)

const getAnalyticsOverview = `-- name: GetAnalyticsOverview :one
SELECT
    COUNT(*) AS total_issues,
    COUNT(*) FILTER (WHERE status = 'open') AS open_issues,
    COUNT(*) FILTER (WHERE status = 'resolved') AS resolved_issues,
    COUNT(*) FILTER (WHERE status = 'in-progress') AS in_progress,
    (SELECT COUNT(*) FROM users) AS total_users
FROM issues
`

func (q *Queries) GetAnalyticsOverview(ctx context.Context) (AnalyticsOverview, error) {
	row := q.db.QueryRow(ctx, getAnalyticsOverview)
	var a AnalyticsOverview
	err := row.Scan(
		&a.TotalIssues,
		&a.OpenIssues,
		&a.ResolvedIssues,
		&a.InProgress,
		&a.TotalUsers,
	)
	return a, err
}

const listIssuesBySector = `-- name: ListIssuesBySector :many
SELECT COALESCE(sector, 'unclassified') AS sector, COUNT(*) AS count
FROM issues
GROUP BY sector
ORDER BY count DESC
`

func (q *Queries) ListIssuesBySector(ctx context.Context) ([]SectorCount, error) {
	rows, err := q.db.Query(ctx, listIssuesBySector)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []SectorCount
	for rows.Next() {
		var s SectorCount
		if err := rows.Scan(&s.Sector, &s.Count); err != nil {
			return nil, err
		}
		items = append(items, s)
	}
	return items, rows.Err()
}

const listIssuesByZone = `-- name: ListIssuesByZone :many
SELECT COALESCE(zone, 'unknown') AS zone, COUNT(*) AS count
FROM issues
WHERE status = 'open' AND zone IS NOT NULL
GROUP BY zone
ORDER BY count DESC
LIMIT 20
`

func (q *Queries) ListIssuesByZone(ctx context.Context) ([]ZoneCount, error) {
	rows, err := q.db.Query(ctx, listIssuesByZone)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []ZoneCount
	for rows.Next() {
		var z ZoneCount
		if err := rows.Scan(&z.Zone, &z.Count); err != nil {
			return nil, err
		}
		items = append(items, z)
	}
	return items, rows.Err()
}

const listHeatmapPoints = `-- name: ListHeatmapPoints :many
SELECT lat, lng, COALESCE(upvotes, 0) AS weight
FROM issues
WHERE lat IS NOT NULL AND lng IS NOT NULL
`

func (q *Queries) ListHeatmapPoints(ctx context.Context) ([]HeatmapPoint, error) {
	rows, err := q.db.Query(ctx, listHeatmapPoints)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []HeatmapPoint
	for rows.Next() {
		var h HeatmapPoint
		if err := rows.Scan(&h.Lat, &h.Lng, &h.Weight); err != nil {
			return nil, err
		}
		items = append(items, h)
	}
	return items, rows.Err()
}
