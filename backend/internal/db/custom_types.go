package db

// AnalyticsOverview represents the high-level dashboard metrics.
type AnalyticsOverview struct {
	TotalIssues    int64 `json:"total_issues"`
	OpenIssues     int64 `json:"open_issues"`
	ResolvedIssues int64 `json:"resolved_issues"`
	InProgress     int64 `json:"in_progress"`
	TotalUsers     int64 `json:"total_users"`
}

// SectorCount represents issue counts grouped by sector.
type SectorCount struct {
	Sector string `json:"sector"`
	Count  int64  `json:"count"`
}

// ZoneCount represents open issue counts grouped by zone.
type ZoneCount struct {
	Zone  string `json:"zone"`
	Count int64  `json:"count"`
}

// HeatmapPoint represents a data point for the frontend HeatMap.
type HeatmapPoint struct {
	Lat    float64 `json:"lat"`
	Lng    float64 `json:"lng"`
	Weight int     `json:"weight"`
}
