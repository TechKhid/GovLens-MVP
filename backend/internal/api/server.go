package api

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/govlens/govlens-mvp/backend/internal/cache"
	"github.com/govlens/govlens-mvp/backend/internal/db"
	"github.com/govlens/govlens-mvp/backend/internal/queue"
	"github.com/govlens/govlens-mvp/backend/internal/service"
)

// contextKey is an unexported type for context keys to avoid collisions.
type contextKey string

const (
	ctxUserID contextKey = "user_id"
	ctxRole   contextKey = "role"
)

// Server holds all server dependencies.
type Server struct {
	Router *chi.Mux
	Store  *db.Store
	Cache  *cache.Cache
	Queue  *queue.Queue
}

func NewServer(store *db.Store, c *cache.Cache, q *queue.Queue) *Server {
	s := &Server{
		Router: chi.NewRouter(),
		Store:  store,
		Cache:  c,
		Queue:  q,
	}
	s.setupRoutes()
	return s
}

func (s *Server) setupRoutes() {
	r := s.Router

	// ── Auth (public) ──────────────────────────────────────────────
	r.Post("/auth/register", s.handleRegister)
	r.Post("/auth/login", s.handleLogin)
	r.Post("/auth/refresh", s.handleRefresh)
	r.Delete("/auth/logout", s.handleLogout)

	// ── MP Public Profile (no auth needed — citizens can view) ─────
	r.Get("/mp/public-profile", s.handleMPPublicProfile)

	// ── Issues ────────────────────────────────────────────────────
	r.Route("/issues", func(r chi.Router) {
		// Public reads
		r.Get("/", s.handleListIssues)
		r.Get("/{id}", s.handleGetIssue)
		r.Get("/{id}/comments", s.handleListComments)

		// Authenticated writes
		r.Group(func(r chi.Router) {
			r.Use(s.authMiddleware)
			r.Post("/", s.handleCreateIssue)
			r.Post("/{id}/upvote", s.handleUpvote)
			r.Patch("/{id}/status", s.handleUpdateStatus)
			r.Post("/{id}/comments", s.handleCreateComment)
		})
	})

	// ── Briefings ─────────────────────────────────────────────────
	r.Get("/briefings", s.handleListBriefings)
	r.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)
		r.Post("/briefings", s.handleCreateBriefing)
	})

	// ── Analytics ─────────────────────────────────────────────────
	r.Get("/analytics/overview", s.handleAnalyticsOverview)

	// ── MP Profile ────────────────────────────────────────────────
	r.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)
		r.Get("/mp/profile", s.handleMPProfile)
	})

	// ── Admin ─────────────────────────────────────────────────────
	r.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)
		r.Use(s.sysadminMiddleware) // New middleware
		
		r.Get("/admin/stats", s.handleAdminStats)
		r.Get("/admin/users", s.handleAdminListUsers)
		r.Patch("/admin/users/{id}/suspend", s.handleAdminSuspendUser)
		r.Patch("/admin/users/{id}/role", s.handleAdminUpdateRole)
		r.Get("/admin/audit-logs", s.handleAdminAuditLogs)
		r.Post("/admin/users/bulk-import", s.handleAdminBulkImport)
	})

	// ── Zones ─────────────────────────────────────────────────────
	r.Get("/zones", s.handleListZones)

	// ── Locations ─────────────────────────────────────────────────
	r.Route("/locations", s.mountLocationsRoutes)

	// ── Heatmap ───────────────────────────────────────────────────
	r.Get("/heatmap", s.handleHeatmap)

	// ── ML Proxy ──────────────────────────────────────────────────
	r.Get("/ml/sentiment", s.handleMLSentiment)
	r.Get("/ml/insights", s.handleMLInsights)
	r.Post("/ml/classify", s.handleMLClassify)
}

// respondJSON writes a JSON payload with the given HTTP status code.
func respondJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(payload)
}

// authMiddleware validates the JWT Bearer token and injects user_id + role into context.
func (s *Server) authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		claims, err := service.ParseToken(tokenStr)
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), ctxUserID, claims.Subject)
		ctx = context.WithValue(ctx, ctxRole, claims.Role)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
