package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"
)

// GET /zones — cached 5min
// Returns a distinct list of all constituencies/zones with their open-issue counts.
func (s *Server) handleListZones(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	const cacheKey = "zones:list"

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

	zoneCounts, err := s.Store.ListIssuesByZone(ctx)
	if err != nil {
		slog.Error("ListIssuesByZone", slog.Any("err", err))
		http.Error(w, "failed to get zones", http.StatusInternalServerError)
		return
	}

	type response struct {
		Zones interface{} `json:"zones"`
	}
	resp := response{Zones: zoneCounts}
	if zoneCounts == nil {
		resp.Zones = []struct{}{}
	}

	data, _ := json.Marshal(resp)

	if s.Cache != nil {
		s.Cache.Set(ctx, cacheKey, data, 5*time.Minute)
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Cache", "MISS")
	w.Write(data)
}
