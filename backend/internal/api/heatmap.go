package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"
)

// GeoJSON types for the heatmap response.
type geoJSONPoint struct {
	Type        string       `json:"type"`
	Coordinates [2]float64   `json:"coordinates"` // [lng, lat] per GeoJSON spec
	Properties  map[string]int `json:"properties"`
}

type geoJSONFeature struct {
	Type       string       `json:"type"`
	Geometry   geoJSONPoint `json:"geometry"`
	Properties map[string]int `json:"properties"`
}

type geoJSONFeatureCollection struct {
	Type     string           `json:"type"`
	Features []geoJSONFeature `json:"features"`
}

// GET /heatmap — cached 5min
// Returns a GeoJSON FeatureCollection of issue locations weighted by upvotes.
func (s *Server) handleHeatmap(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	const cacheKey = "heatmap:geojson"

	if s.Cache != nil {
		if data, err := s.Cache.Get(ctx, cacheKey); err == nil {
			w.Header().Set("Content-Type", "application/geo+json")
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

	points, err := s.Store.ListHeatmapPoints(ctx)
	if err != nil {
		slog.Error("ListHeatmapPoints", slog.Any("err", err))
		http.Error(w, "failed to get heatmap data", http.StatusInternalServerError)
		return
	}

	features := make([]geoJSONFeature, 0, len(points))
	for _, p := range points {
		features = append(features, geoJSONFeature{
			Type: "Feature",
			Geometry: geoJSONPoint{
				Type:        "Point",
				Coordinates: [2]float64{p.Lng, p.Lat}, // GeoJSON: [lng, lat]
			},
			Properties: map[string]int{"weight": p.Weight},
		})
	}

	collection := geoJSONFeatureCollection{
		Type:     "FeatureCollection",
		Features: features,
	}

	data, _ := json.Marshal(collection)

	if s.Cache != nil {
		s.Cache.Set(ctx, cacheKey, data, 5*time.Minute)
	}

	w.Header().Set("Content-Type", "application/geo+json")
	w.Header().Set("X-Cache", "MISS")
	w.Write(data)
}
