package api

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/govlens/govlens-mvp/backend/internal/db"
	"github.com/govlens/govlens-mvp/backend/internal/service"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/redis/go-redis/v9"
)

// issuesCacheKey returns a deterministic cache key for the issues list.
func issuesCacheKey(zone string) string {
	if zone == "" {
		return "issues:list:all"
	}
	return fmt.Sprintf("issues:list:zone:%s", zone)
}

// GET /issues — cached 30s, filterable by ?zone=
func (s *Server) handleListIssues(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	zone := r.URL.Query().Get("zone")
	
	userIDStr := ""
	authHeader := r.Header.Get("Authorization")
	if strings.HasPrefix(authHeader, "Bearer ") {
		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		if claims, err := service.ParseToken(tokenStr); err == nil {
			userIDStr = claims.Subject
		}
	}

	var zonePtr *string
	if zone != "" {
		zonePtr = &zone
	}

	if s.Store == nil {
		http.Error(w, "database unavailable", http.StatusServiceUnavailable)
		return
	}

	cacheKey := issuesCacheKey(zone)
	if userIDStr == "" && s.Cache != nil {
		if data, err := s.Cache.Get(ctx, cacheKey); err == nil {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-Cache", "HIT")
			w.Write(data)
			return
		} else if err != redis.Nil {
			slog.Warn("Cache get error", slog.String("key", cacheKey), slog.Any("err", err))
		}
	}

	var payload []byte

	if userIDStr != "" {
		var userID pgtype.UUID
		if err := userID.Scan(userIDStr); err == nil {
			issues, err := s.Store.ListIssuesWithUpvote(ctx, db.ListIssuesWithUpvoteParams{
				Limit:  50,
				Offset: 0,
				Zone:   zonePtr,
				UserID: userID,
			})
			if err != nil {
				slog.Error("ListIssuesWithUpvote", slog.Any("err", err))
				http.Error(w, "failed to get issues", http.StatusInternalServerError)
				return
			}
			if issues == nil {
				issues = []db.ListIssuesWithUpvoteRow{}
			}
			payload, _ = json.Marshal(issues)
		}
	}
	
	if len(payload) == 0 {
		issues, err := s.Store.ListIssues(ctx, db.ListIssuesParams{
			Limit:  50,
			Offset: 0,
			Zone:   zonePtr,
		})
		if err != nil {
			slog.Error("ListIssues", slog.Any("err", err))
			http.Error(w, "failed to get issues", http.StatusInternalServerError)
			return
		}
		if issues == nil {
			issues = []db.Issue{}
		}
		payload, _ = json.Marshal(issues)

		if s.Cache != nil {
			s.Cache.Set(ctx, cacheKey, payload, 30*time.Second)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	if userIDStr == "" {
		w.Header().Set("X-Cache", "MISS")
	} else {
		w.Header().Set("X-Cache", "SKIP-AUTHED")
	}
	w.Write(payload)
}

// GET /issues/{id}
func (s *Server) handleGetIssue(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	var id pgtype.UUID
	if err := id.Scan(idStr); err != nil {
		http.Error(w, "invalid issue id", http.StatusBadRequest)
		return
	}

	if s.Store == nil {
		http.Error(w, "database unavailable", http.StatusServiceUnavailable)
		return
	}

	userIDStr := ""
	authHeader := r.Header.Get("Authorization")
	if strings.HasPrefix(authHeader, "Bearer ") {
		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		if claims, err := service.ParseToken(tokenStr); err == nil {
			userIDStr = claims.Subject
		}
	}

	if userIDStr != "" {
		var userID pgtype.UUID
		if err := userID.Scan(userIDStr); err == nil {
			issue, err := s.Store.GetIssueWithUpvote(r.Context(), db.GetIssueWithUpvoteParams{
				ID:     id,
				UserID: userID,
			})
			if err != nil {
				http.Error(w, "issue not found", http.StatusNotFound)
				return
			}
			respondJSON(w, http.StatusOK, issue)
			return
		}
	}

	issue, err := s.Store.GetIssue(r.Context(), id)
	if err != nil {
		http.Error(w, "issue not found", http.StatusNotFound)
		return
	}
	respondJSON(w, http.StatusOK, issue)
}

// POST /issues — requires auth
func (s *Server) handleCreateIssue(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userIDStr, ok := ctx.Value(ctxUserID).(string)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var userID pgtype.UUID
	if err := userID.Scan(userIDStr); err != nil {
		http.Error(w, "invalid user id in context", http.StatusInternalServerError)
		return
	}

	var input struct {
		Title       string  `json:"title"`
		Description string  `json:"description"`
		Zone        string  `json:"zone"`
		Lat         float64 `json:"lat"`
		Lng         float64 `json:"lng"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if input.Title == "" || input.Description == "" {
		http.Error(w, "title and description are required", http.StatusBadRequest)
		return
	}

	if s.Store == nil {
		http.Error(w, "database unavailable", http.StatusServiceUnavailable)
		return
	}

	var zonePtr *string
	if input.Zone != "" {
		zonePtr = &input.Zone
	}
	var latPtr, lngPtr *float64
	if input.Lat != 0 {
		latPtr = &input.Lat
	}
	if input.Lng != 0 {
		lngPtr = &input.Lng
	}

	issue, err := s.Store.CreateIssue(ctx, db.CreateIssueParams{
		UserID:      userID,
		Title:       input.Title,
		Description: input.Description,
		Zone:        zonePtr,
		Lat:         latPtr,
		Lng:         lngPtr,
	})
	if err != nil {
		slog.Error("CreateIssue", slog.Any("err", err))
		http.Error(w, "failed to create issue", http.StatusInternalServerError)
		return
	}

	if s.Cache != nil {
		s.Cache.DeletePattern(ctx, "issues:list:*")
	}

	if s.Queue != nil && s.Queue.JS != nil {
		payload, _ := json.Marshal(issue)
		if _, err := s.Queue.JS.Publish(ctx, "issue.created", payload); err != nil {
			slog.Warn("NATS publish failed", slog.Any("err", err))
		}
	}

	respondJSON(w, http.StatusCreated, issue)
}

// POST /issues/{id}/upvote — requires auth
func (s *Server) handleUpvote(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userIDStr, ok := ctx.Value(ctxUserID).(string)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var userID pgtype.UUID
	if err := userID.Scan(userIDStr); err != nil {
		http.Error(w, "invalid user id in context", http.StatusInternalServerError)
		return
	}

	idStr := chi.URLParam(r, "id")
	var id pgtype.UUID
	if err := id.Scan(idStr); err != nil {
		http.Error(w, "invalid issue id", http.StatusBadRequest)
		return
	}

	if s.Store == nil {
		http.Error(w, "database unavailable", http.StatusServiceUnavailable)
		return
	}

	if err := s.Store.ToggleUpvote(ctx, db.ToggleUpvoteParams{
		ID:     id,
		UserID: userID,
	}); err != nil {
		slog.Error("ToggleUpvote", slog.Any("err", err))
		http.Error(w, "failed to toggle upvote", http.StatusInternalServerError)
		return
	}

	if s.Cache != nil {
		s.Cache.Delete(ctx, "heatmap:geojson")
		s.Cache.DeletePattern(ctx, "issues:list:*")
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "success"})
}

// PATCH /issues/{id}/status — requires auth (admin or mp only)
func (s *Server) handleUpdateStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	role, _ := ctx.Value(ctxRole).(string)
	if role != "admin" && role != "mp" {
		http.Error(w, "forbidden: admin or mp only", http.StatusForbidden)
		return
	}

	idStr := chi.URLParam(r, "id")
	var id pgtype.UUID
	if err := id.Scan(idStr); err != nil {
		http.Error(w, "invalid issue id", http.StatusBadRequest)
		return
	}

	var input struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	allowed := map[string]bool{"open": true, "in-progress": true, "resolved": true}
	if !allowed[input.Status] {
		http.Error(w, "status must be one of: open, in-progress, resolved", http.StatusBadRequest)
		return
	}

	if s.Store == nil {
		http.Error(w, "database unavailable", http.StatusServiceUnavailable)
		return
	}

	if err := s.Store.UpdateIssueStatus(ctx, db.UpdateIssueStatusParams{
		ID:     id,
		Status: input.Status,
	}); err != nil {
		slog.Error("UpdateIssueStatus", slog.Any("err", err))
		http.Error(w, "failed to update status", http.StatusInternalServerError)
		return
	}

	if s.Cache != nil {
		s.Cache.DeletePattern(ctx, "issues:list:*")
		s.Cache.Delete(ctx, "analytics:overview")
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "success"})
}
