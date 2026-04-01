package api

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/govlens/govlens-mvp/backend/internal/db"
	"github.com/jackc/pgx/v5/pgtype"
)

// GET /issues/{id}/comments
func (s *Server) handleListComments(w http.ResponseWriter, r *http.Request) {
	issueIDStr := chi.URLParam(r, "id")
	var issueID pgtype.UUID
	if err := issueID.Scan(issueIDStr); err != nil {
		http.Error(w, "invalid issue id", http.StatusBadRequest)
		return
	}

	if s.Store == nil {
		http.Error(w, "database unavailable", http.StatusServiceUnavailable)
		return
	}

	comments, err := s.Store.ListCommentsByIssue(r.Context(), issueID)
	if err != nil {
		slog.Error("ListCommentsByIssue", slog.Any("err", err))
		http.Error(w, "failed to get comments", http.StatusInternalServerError)
		return
	}

	if comments == nil {
		comments = []db.ListCommentsByIssueRow{}
	}

	respondJSON(w, http.StatusOK, comments)
}

// POST /issues/{id}/comments — requires auth
func (s *Server) handleCreateComment(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	issueIDStr := chi.URLParam(r, "id")
	var issueID pgtype.UUID
	if err := issueID.Scan(issueIDStr); err != nil {
		http.Error(w, "invalid issue id", http.StatusBadRequest)
		return
	}

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
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if input.Content == "" {
		http.Error(w, "content is required", http.StatusBadRequest)
		return
	}

	if s.Store == nil {
		http.Error(w, "database unavailable", http.StatusServiceUnavailable)
		return
	}

	comment, err := s.Store.CreateComment(ctx, db.CreateCommentParams{
		IssueID: issueID,
		UserID:  userID,
		Content: input.Content,
	})
	if err != nil {
		slog.Error("CreateComment", slog.Any("err", err))
		http.Error(w, "failed to create comment", http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusCreated, comment)
}
