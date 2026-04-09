package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

func mlSidecarURL() string {
	u := os.Getenv("ML_SIDECAR_URL")
	if u == "" {
		u = "http://ml-sidecar:8001"
	}
	return u
}

func buildMLPath(endpoint string, query map[string]string) string {
	values := url.Values{}
	for key, value := range query {
		if value != "" {
			values.Set(key, value)
		}
	}
	if encoded := values.Encode(); encoded != "" {
		return endpoint + "?" + encoded
	}
	return endpoint
}

// proxyML is a helper that forwards a request to the ML sidecar, handles caching,
// and writes the response back to the client.
func (s *Server) proxyML(w http.ResponseWriter, r *http.Request, path string, cacheKey string, cacheTTL time.Duration) {
	ctx := r.Context()

	// Try cache for GET requests
	if r.Method == http.MethodGet && s.Cache != nil && cacheKey != "" {
		if data, err := s.Cache.Get(ctx, cacheKey); err == nil {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-Cache", "HIT")
			w.Write(data)
			return
		} else if err != redis.Nil {
			slog.Warn("ML cache get error", slog.String("key", cacheKey), slog.Any("err", err))
		}
	}

	var body io.Reader
	if r.Body != nil {
		bodyBytes, _ := io.ReadAll(r.Body)
		body = bytes.NewReader(bodyBytes)
	}

	req, err := http.NewRequestWithContext(ctx, r.Method, mlSidecarURL()+path, body)
	if err != nil {
		slog.Error("ML proxy: build request", slog.Any("err", err))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		slog.Error("ML proxy: upstream error", slog.String("path", path), slog.Any("err", err))
		http.Error(w, fmt.Sprintf("ML sidecar unavailable: %v", err), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)

	// Cache successful GET responses
	if r.Method == http.MethodGet && resp.StatusCode == http.StatusOK && s.Cache != nil && cacheKey != "" {
		if err := s.Cache.Set(ctx, cacheKey, respBytes, cacheTTL); err != nil {
			slog.Warn("ML cache set error", slog.String("key", cacheKey), slog.Any("err", err))
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Cache", "MISS")
	w.WriteHeader(resp.StatusCode)
	w.Write(respBytes)
}

// GET /ml/sentiment — proxy → ML sidecar; cached 10min
func (s *Server) handleMLSentiment(w http.ResponseWriter, r *http.Request) {
	zone := r.URL.Query().Get("zone")
	cacheKey := "ml:sentiment"
	if zone != "" {
		cacheKey += ":" + zone
	}
	s.proxyML(w, r, buildMLPath("/sentiment", map[string]string{"zone": zone}), cacheKey, 10*time.Minute)
}

// GET /ml/insights — proxy → ML sidecar; cached 10min
func (s *Server) handleMLInsights(w http.ResponseWriter, r *http.Request) {
	zone := r.URL.Query().Get("zone")
	days := r.URL.Query().Get("days")
	if days == "" {
		days = "7"
	}
	cacheKey := "ml:insights:" + zone + ":" + days
	s.proxyML(w, r, buildMLPath("/insights", map[string]string{
		"zone": zone,
		"days": days,
	}), cacheKey, 10*time.Minute)
}

// POST /ml/classify — proxy → ML sidecar; not cached
func (s *Server) handleMLClassify(w http.ResponseWriter, r *http.Request) {
	s.proxyML(w, r, "/classify", "", 0)
}

// GET /ml/sector-insights — proxy → ML sidecar; cached 10min
func (s *Server) handleMLSectorInsights(w http.ResponseWriter, r *http.Request) {
	zone := r.URL.Query().Get("zone")
	cacheKey := "ml:sector-insights"
	if zone != "" {
		cacheKey += ":" + zone
	}
	s.proxyML(w, r, buildMLPath("/sector-insights", map[string]string{"zone": zone}), cacheKey, 10*time.Minute)
}

// GET /ml/recurring — proxy → ML sidecar; cached 10min
func (s *Server) handleMLRecurring(w http.ResponseWriter, r *http.Request) {
	zone := r.URL.Query().Get("zone")
	threshold := r.URL.Query().Get("threshold")
	if threshold == "" {
		threshold = "2"
	}
	cacheKey := "ml:recurring:" + zone
	s.proxyML(w, r, buildMLPath("/recurring", map[string]string{
		"zone":      zone,
		"threshold": threshold,
	}), cacheKey, 10*time.Minute)
}

// GET /ml/response-trend — proxy → ML sidecar; cached 10min
func (s *Server) handleMLResponseTrend(w http.ResponseWriter, r *http.Request) {
	zone := r.URL.Query().Get("zone")
	cacheKey := "ml:response-trend"
	if zone != "" {
		cacheKey += ":" + zone
	}
	s.proxyML(w, r, buildMLPath("/response-trend", map[string]string{"zone": zone}), cacheKey, 10*time.Minute)
}

// respondError sends a JSON-formatted error response with consistent structure.
func respondError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
