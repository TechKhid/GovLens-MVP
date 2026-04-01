package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/govlens/govlens-mvp/backend/internal/db"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/redis/go-redis/v9"
)

// GET /briefings — cached 60s
// Returns the latest MP briefings, paginated.
func (s *Server) handleListBriefings(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	const cacheKey = "briefings:list"

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

	briefings, err := s.Store.ListBriefings(ctx, db.ListBriefingsParams{
		Limit:  20,
		Offset: 0,
	})
	if err != nil {
		slog.Error("ListBriefings", slog.Any("err", err))
		http.Error(w, "failed to get briefings", http.StatusInternalServerError)
		return
	}

	if briefings == nil {
		briefings = []db.Briefing{}
	}

	data, _ := json.Marshal(briefings)

	if s.Cache != nil {
		s.Cache.Set(ctx, cacheKey, data, 60*time.Second)
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Cache", "MISS")
	w.Write(data)
}

// POST /briefings — MP or Admin only
// Creates a new briefing and busts the cache.
func (s *Server) handleCreateBriefing(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	role, _ := ctx.Value(ctxRole).(string)
	if role != "admin" && role != "mp" {
		http.Error(w, "forbidden: MP or admin only", http.StatusForbidden)
		return
	}

	userIDStr, _ := ctx.Value(ctxUserID).(string)
	var mpID pgtype.UUID
	if err := mpID.Scan(userIDStr); err != nil {
		http.Error(w, "invalid user context", http.StatusInternalServerError)
		return
	}

	var input struct {
		Title   string `json:"title"`
		Content string `json:"content"`
		Zone    string `json:"zone"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if s.Store == nil {
		http.Error(w, "database unavailable", http.StatusServiceUnavailable)
		return
	}

	briefing, err := s.Store.CreateBriefing(ctx, db.CreateBriefingParams{
		MpID:    mpID,
		Title:   input.Title,
		Content: input.Content,
		Zone:    pgtype.Text{String: input.Zone, Valid: input.Zone != ""},
	})
	if err != nil {
		slog.Error("CreateBriefing", slog.Any("err", err))
		http.Error(w, "failed to create briefing", http.StatusInternalServerError)
		return
	}

	// Bust briefings cache
	if s.Cache != nil {
		s.Cache.Delete(ctx, "briefings:list")
	}

	respondJSON(w, http.StatusCreated, briefing)
}
