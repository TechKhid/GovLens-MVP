package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"
)

// GET /analytics/overview — cached 60s
// Returns aggregate issue counts + user count for the dashboard.
func (s *Server) handleAnalyticsOverview(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	const cacheKey = "analytics:overview"

	// Try cache first
	if s.Cache != nil {
		if data, err := s.Cache.Get(ctx, cacheKey); err == nil {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-Cache", "HIT")
			w.Write(data)
			return
		} else if err != redis.Nil {
			slog.Warn("Cache get error", slog.String("key", cacheKey), slog.Any("err", err))
		}
	}

	if s.Store == nil {
		http.Error(w, "database unavailable", http.StatusServiceUnavailable)
		return
	}

	overview, err := s.Store.GetAnalyticsOverview(ctx)
	if err != nil {
		slog.Error("GetAnalyticsOverview", slog.Any("err", err))
		http.Error(w, "failed to get analytics", http.StatusInternalServerError)
		return
	}

	sectors, _ := s.Store.ListIssuesBySector(ctx)
	zones, _ := s.Store.ListIssuesByZone(ctx)

	response := map[string]interface{}{
		"overview": overview,
		"sectors":  sectors,
		"zones":    zones,
	}

	data, _ := json.Marshal(response)

	// Store in cache
	if s.Cache != nil {
		if err := s.Cache.Set(ctx, cacheKey, data, 60*time.Second); err != nil {
			slog.Warn("Cache set error", slog.String("key", cacheKey), slog.Any("err", err))
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Cache", "MISS")
	w.Write(data)
}
