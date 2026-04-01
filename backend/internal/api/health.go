package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"
)

// GET /health
// Returns liveness status of the Go API, database, and Redis.
func (s *Server) HandleHealth(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	status := map[string]string{
		"status": "ok",
		"db":     "ok",
		"redis":  "ok",
	}
	httpStatus := http.StatusOK

	// Check DB
	if s.Store == nil {
		status["db"] = "unavailable"
		httpStatus = http.StatusServiceUnavailable
	} else if err := s.Store.Primary.Ping(ctx); err != nil {
		slog.Warn("Health: DB ping failed", slog.Any("err", err))
		status["db"] = "error"
		httpStatus = http.StatusServiceUnavailable
	}

	// Check Redis
	if s.Cache == nil {
		status["redis"] = "unavailable"
		httpStatus = http.StatusServiceUnavailable
	} else if err := s.Cache.Ping(ctx); err != nil {
		slog.Warn("Health: Redis ping failed", slog.Any("err", err))
		status["redis"] = "error"
		httpStatus = http.StatusServiceUnavailable
	}

	status["timestamp"] = time.Now().UTC().Format(time.RFC3339)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(httpStatus)
	json.NewEncoder(w).Encode(status)
}
