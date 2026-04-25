package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/govlens/govlens-mvp/backend/internal/db"
	"github.com/govlens/govlens-mvp/backend/internal/service"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/redis/go-redis/v9"
)

const (
	maxIssueImageCount = 6
	maxIssueImageSize  = 10 << 20
	maxIssueFormBytes  = 64 << 20
)

var allowedIssueImageTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

func normalizeIssueStatusInput(input string) string {
	normalized := strings.ToLower(strings.TrimSpace(input))
	normalized = strings.ReplaceAll(normalized, "_", "-")
	normalized = strings.ReplaceAll(normalized, " ", "-")

	aliases := map[string]string{
		"reported":             "open",
		"open":                 "open",
		"acknowledged":         "acknowledged",
		"in-progress":          "in-progress",
		"pending-verification": "pending-verification",
		"verified-resolved":    "verified-resolved",
		"resolved":             "verified-resolved",
		"reopened":             "reopened",
	}

	if resolved, ok := aliases[normalized]; ok {
		return resolved
	}
	return normalized
}

func validateIssueStatusChange(role string, requestedStatus string, note string) (string, error) {
	status := normalizeIssueStatusInput(requestedStatus)
	allowedByRole := map[string]map[string]bool{
		"mp": {
			"acknowledged":         true,
			"in-progress":          true,
			"pending-verification": true,
		},
		"admin": {
			"open":                 true,
			"acknowledged":         true,
			"in-progress":          true,
			"pending-verification": true,
			"verified-resolved":    true,
			"reopened":             true,
		},
	}

	allowedStatuses, ok := allowedByRole[role]
	if !ok || !allowedStatuses[status] {
		return "", fmt.Errorf("status transition not allowed for role")
	}

	if status == "pending-verification" && strings.TrimSpace(note) == "" {
		return "", fmt.Errorf("resolution note is required before pending verification")
	}

	return status, nil
}

func validateIssueVerificationAction(action string) (string, error) {
	normalized := strings.ToLower(strings.TrimSpace(action))
	if normalized == "confirm" || normalized == "dispute" {
		return normalized, nil
	}
	return "", fmt.Errorf("verification action must be one of: confirm, dispute")
}

func normalizeIssueSeverityInput(input string) (string, error) {
	normalized := strings.ToLower(strings.TrimSpace(input))
	switch normalized {
	case "low", "medium", "high", "critical":
		return normalized, nil
	default:
		return "", fmt.Errorf("severity must be one of: low, medium, high, critical")
	}
}

type createIssueInput struct {
	Title       string
	Description string
	Sector      string
	Severity    string
	Zone        string
	Lat         float64
	Lng         float64
	ImageURLs   []string
}

// issuesCacheKey returns a deterministic cache key for the issues list.
func issuesCacheKey(zone string) string {
	if zone == "" {
		return "issues:list:all"
	}
	return fmt.Sprintf("issues:list:zone:%s", zone)
}

func (s *Server) issueVisibleToConstituency(
	ctx context.Context,
	constituency string,
	zone *string,
	reporterID pgtype.UUID,
	reporterScopes map[string]bool,
) bool {
	if zoneMatchesConstituency(constituency, zone) {
		return true
	}

	reporterKey := formatUUID(reporterID)
	if matches, ok := reporterScopes[reporterKey]; ok {
		return matches
	}

	user, err := s.Store.GetUserByID(ctx, reporterID)
	if err != nil {
		reporterScopes[reporterKey] = false
		return false
	}

	matches := user.Constituency != nil && normalizeScope(*user.Constituency) == normalizeScope(constituency)
	reporterScopes[reporterKey] = matches
	return matches
}

// GET /issues — cached 30s, filterable by ?zone=
func (s *Server) authorizeIssueManagement(ctx context.Context, role string, issue db.Issue) (pgtype.UUID, int, error) {
	userIDStr, _ := ctx.Value(ctxUserID).(string)
	var actorID pgtype.UUID
	if userIDStr != "" {
		if err := actorID.Scan(userIDStr); err != nil {
			return actorID, http.StatusInternalServerError, fmt.Errorf("invalid user id in context")
		}
	}

	if role == "mp" {
		user, err := s.Store.GetUserByID(ctx, actorID)
		if err != nil {
			return actorID, http.StatusInternalServerError, fmt.Errorf("failed to load MP profile")
		}
		if user.Constituency == nil || !s.issueVisibleToConstituency(ctx, *user.Constituency, issue.Zone, issue.UserID, map[string]bool{}) {
			return actorID, http.StatusForbidden, fmt.Errorf("forbidden: issue outside your constituency")
		}
	}

	return actorID, 0, nil
}

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
	constituencyScope := ""

	if s.Store == nil {
		http.Error(w, "database unavailable", http.StatusServiceUnavailable)
		return
	}

	// For authenticated users, enforce boundaries
	var userID pgtype.UUID
	isAuthenticated := false

	if userIDStr != "" {
		if err := userID.Scan(userIDStr); err == nil {
			isAuthenticated = true

			// Check user role to enforce visibility boundaries
			user, err := s.Store.GetUserByID(ctx, userID)
			if err == nil {
				// Apply constituency scoping for authenticated non-admin users.
				if user.Role != "sysadmin" && user.Role != "admin" && user.Constituency != nil && *user.Constituency != "" {
					constituencyScope = *user.Constituency
					zonePtr = nil
				}
			}
		}
	}

	// Recompute zone for cache key in case we overrode it
	finalZone := ""
	if zonePtr != nil {
		finalZone = *zonePtr
	}
	cacheKey := issuesCacheKey(finalZone)

	// We only cache if unauthenticated, or the user has no upvote-specific data requirements
	// Note: Because we use 'ListIssuesWithUpvote' for auth'd users, we shouldn't use the generic cache
	if !isAuthenticated && s.Cache != nil {
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

	if isAuthenticated {
		limit := int32(50)
		if constituencyScope != "" {
			limit = 500
		}

		issues, err := s.Store.ListIssuesWithUpvote(ctx, db.ListIssuesWithUpvoteParams{
			Limit:  limit,
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
		if constituencyScope != "" {
			reporterScopes := make(map[string]bool)
			filtered := make([]db.ListIssuesWithUpvoteRow, 0, len(issues))
			for _, issue := range issues {
				if s.issueVisibleToConstituency(ctx, constituencyScope, issue.Zone, issue.UserID, reporterScopes) {
					filtered = append(filtered, issue)
				}
			}
			issues = filtered
		}
		payload, _ = json.Marshal(issues)
	}

	if len(payload) == 0 {
		limit := int32(50)
		if constituencyScope != "" {
			limit = 500
		}

		issues, err := s.Store.ListIssues(ctx, db.ListIssuesParams{
			Limit:  limit,
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
		if constituencyScope != "" {
			reporterScopes := make(map[string]bool)
			filtered := make([]db.Issue, 0, len(issues))
			for _, issue := range issues {
				if s.issueVisibleToConstituency(ctx, constituencyScope, issue.Zone, issue.UserID, reporterScopes) {
					filtered = append(filtered, issue)
				}
			}
			issues = filtered
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

	input, cleanupUploads, err := s.parseCreateIssueInput(w, r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if input.Title == "" || input.Description == "" {
		if cleanupUploads != nil {
			cleanupUploads()
		}
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
	var sectorPtr, severityPtr *string
	if input.Sector != "" {
		sector := strings.TrimSpace(input.Sector)
		sectorPtr = &sector
	}
	if input.Severity != "" {
		severity := strings.TrimSpace(input.Severity)
		severityPtr = &severity
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
		Sector:      sectorPtr,
		Severity:    severityPtr,
		Zone:        zonePtr,
		Lat:         latPtr,
		Lng:         lngPtr,
		ImageUrls:   input.ImageURLs,
	})
	if err != nil {
		if cleanupUploads != nil {
			cleanupUploads()
		}
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

func (s *Server) parseCreateIssueInput(w http.ResponseWriter, r *http.Request) (createIssueInput, func(), error) {
	contentType := r.Header.Get("Content-Type")
	if strings.HasPrefix(contentType, "multipart/form-data") {
		return s.parseMultipartCreateIssueInput(w, r)
	}

	var input struct {
		Title       string  `json:"title"`
		Description string  `json:"description"`
		Sector      string  `json:"sector"`
		Severity    string  `json:"severity"`
		Zone        string  `json:"zone"`
		Lat         float64 `json:"lat"`
		Lng         float64 `json:"lng"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		return createIssueInput{}, nil, fmt.Errorf("invalid request body")
	}

	severity := strings.TrimSpace(input.Severity)
	if severity != "" {
		normalizedSeverity, err := normalizeIssueSeverityInput(severity)
		if err != nil {
			return createIssueInput{}, nil, err
		}
		severity = normalizedSeverity
	}

	return createIssueInput{
		Title:       strings.TrimSpace(input.Title),
		Description: strings.TrimSpace(input.Description),
		Sector:      strings.TrimSpace(input.Sector),
		Severity:    severity,
		Zone:        strings.TrimSpace(input.Zone),
		Lat:         input.Lat,
		Lng:         input.Lng,
		ImageURLs:   []string{},
	}, nil, nil
}

func (s *Server) parseMultipartCreateIssueInput(w http.ResponseWriter, r *http.Request) (createIssueInput, func(), error) {
	r.Body = http.MaxBytesReader(w, r.Body, maxIssueFormBytes)
	if err := r.ParseMultipartForm(maxIssueFormBytes); err != nil {
		return createIssueInput{}, nil, fmt.Errorf("file upload too large or invalid multipart form")
	}

	input := createIssueInput{
		Title:       strings.TrimSpace(r.FormValue("title")),
		Description: strings.TrimSpace(r.FormValue("description")),
		Sector:      strings.TrimSpace(r.FormValue("sector")),
		Zone:        strings.TrimSpace(r.FormValue("zone")),
		ImageURLs:   []string{},
	}
	if value := strings.TrimSpace(r.FormValue("severity")); value != "" {
		severity, err := normalizeIssueSeverityInput(value)
		if err != nil {
			return createIssueInput{}, nil, err
		}
		input.Severity = severity
	}

	if value := strings.TrimSpace(r.FormValue("lat")); value != "" {
		lat, err := strconv.ParseFloat(value, 64)
		if err != nil {
			return createIssueInput{}, nil, fmt.Errorf("invalid latitude")
		}
		input.Lat = lat
	}
	if value := strings.TrimSpace(r.FormValue("lng")); value != "" {
		lng, err := strconv.ParseFloat(value, 64)
		if err != nil {
			return createIssueInput{}, nil, fmt.Errorf("invalid longitude")
		}
		input.Lng = lng
	}

	files := r.MultipartForm.File["images"]
	if len(files) == 0 {
		return input, nil, nil
	}
	if len(files) > maxIssueImageCount {
		return createIssueInput{}, nil, fmt.Errorf("maximum %d images allowed", maxIssueImageCount)
	}
	if err := s.ensureUploadsRoot(); err != nil {
		return createIssueInput{}, nil, fmt.Errorf("failed to prepare upload directory")
	}

	batchID := uuid.NewString()
	batchDir := filepath.Join(s.uploadsRoot(), "issues", batchID)
	if err := os.MkdirAll(batchDir, 0o755); err != nil {
		return createIssueInput{}, nil, fmt.Errorf("failed to prepare issue image directory")
	}

	cleanup := func() {
		_ = os.RemoveAll(batchDir)
	}

	imageURLs, err := s.saveIssueImages(batchDir, batchID, files)
	if err != nil {
		cleanup()
		return createIssueInput{}, nil, err
	}
	input.ImageURLs = imageURLs
	return input, cleanup, nil
}

func (s *Server) saveIssueImages(batchDir, batchID string, files []*multipart.FileHeader) ([]string, error) {
	imageURLs := make([]string, 0, len(files))

	for index, header := range files {
		if header.Size > maxIssueImageSize {
			return nil, fmt.Errorf("each image must be 10MB or smaller")
		}

		src, err := header.Open()
		if err != nil {
			return nil, fmt.Errorf("failed to read uploaded image")
		}

		sniffBuf := make([]byte, 512)
		n, readErr := io.ReadFull(src, sniffBuf)
		if readErr != nil && readErr != io.ErrUnexpectedEOF {
			src.Close()
			return nil, fmt.Errorf("failed to inspect uploaded image")
		}

		contentType := http.DetectContentType(sniffBuf[:n])
		ext, ok := allowedIssueImageTypes[contentType]
		if !ok {
			src.Close()
			return nil, fmt.Errorf("unsupported image format; use JPG, PNG, or WebP")
		}

		fileName := fmt.Sprintf("%02d-%s%s", index+1, uuid.NewString(), ext)
		dstPath := filepath.Join(batchDir, fileName)
		dst, err := os.OpenFile(dstPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644)
		if err != nil {
			src.Close()
			return nil, fmt.Errorf("failed to store uploaded image")
		}

		reader := io.MultiReader(bytes.NewReader(sniffBuf[:n]), src)
		if _, err := io.Copy(dst, reader); err != nil {
			dst.Close()
			src.Close()
			return nil, fmt.Errorf("failed to store uploaded image")
		}

		dst.Close()
		src.Close()

		relativePath := filepath.Join("issues", batchID, fileName)
		imageURLs = append(imageURLs, s.issueImageURL(relativePath))
	}

	return imageURLs, nil
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
		Note   string `json:"note"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	status, err := validateIssueStatusChange(role, input.Status, input.Note)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if s.Store == nil {
		http.Error(w, "database unavailable", http.StatusServiceUnavailable)
		return
	}

	issue, err := s.Store.GetIssue(ctx, id)
	if err != nil {
		http.Error(w, "issue not found", http.StatusNotFound)
		return
	}

	actorID, statusCode, err := s.authorizeIssueManagement(ctx, role, issue)
	if err != nil {
		http.Error(w, err.Error(), statusCode)
		return
	}

	if err := s.Store.UpdateIssueStatus(ctx, db.UpdateIssueStatusParams{
		ID:     id,
		Status: status,
	}); err != nil {
		slog.Error("UpdateIssueStatus", slog.Any("err", err))
		http.Error(w, "failed to update status", http.StatusInternalServerError)
		return
	}

	if strings.TrimSpace(input.Note) != "" {
		if _, err := s.Store.CreateComment(ctx, db.CreateCommentParams{
			IssueID: id,
			UserID:  actorID,
			Content: strings.TrimSpace(input.Note),
		}); err != nil {
			slog.Warn("status note comment creation failed", slog.Any("err", err))
		}
	}

	// Write resolved_at timestamp only when citizens/admin fully verify resolution.
	if status == "verified-resolved" {
		if _, err := s.Store.Primary.Exec(
			ctx,
			"UPDATE issues SET resolved_at = NOW() WHERE id = $1 AND resolved_at IS NULL",
			id,
		); err != nil {
			slog.Warn("resolved_at update failed", slog.Any("err", err))
		}
	} else {
		if _, err := s.Store.Primary.Exec(
			ctx,
			"UPDATE issues SET resolved_at = NULL WHERE id = $1",
			id,
		); err != nil {
			slog.Warn("resolved_at clear failed", slog.Any("err", err))
		}
	}

	if s.Cache != nil {
		s.Cache.DeletePattern(ctx, "issues:list:*")
		s.Cache.Delete(ctx, "analytics:overview")
		s.Cache.DeletePattern(ctx, "ml:*")
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "success"})
}

// PATCH /issues/{id}/manage — requires auth (admin or mp only)
func (s *Server) handleManageIssue(w http.ResponseWriter, r *http.Request) {
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
		Severity     string `json:"severity"`
		Assignee     string `json:"assignee"`
		InternalNote string `json:"internal_note"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	severity, err := normalizeIssueSeverityInput(input.Severity)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if s.Store == nil {
		http.Error(w, "database unavailable", http.StatusServiceUnavailable)
		return
	}

	issue, err := s.Store.GetIssue(ctx, id)
	if err != nil {
		http.Error(w, "issue not found", http.StatusNotFound)
		return
	}

	if _, statusCode, err := s.authorizeIssueManagement(ctx, role, issue); err != nil {
		http.Error(w, err.Error(), statusCode)
		return
	}

	var severityPtr, assigneePtr, internalNotePtr *string
	severityPtr = &severity
	if trimmed := strings.TrimSpace(input.Assignee); trimmed != "" {
		assigneePtr = &trimmed
	}
	if trimmed := strings.TrimSpace(input.InternalNote); trimmed != "" {
		internalNotePtr = &trimmed
	}

	updatedIssue, err := s.Store.UpdateIssueManagement(ctx, db.UpdateIssueManagementParams{
		ID:            id,
		Severity:      severityPtr,
		Assignee:      assigneePtr,
		InternalNotes: internalNotePtr,
	})
	if err != nil {
		slog.Error("UpdateIssueManagement", slog.Any("err", err))
		http.Error(w, "failed to update issue management fields", http.StatusInternalServerError)
		return
	}

	if s.Cache != nil {
		s.Cache.DeletePattern(ctx, "issues:list:*")
		s.Cache.Delete(ctx, "analytics:overview")
	}

	respondJSON(w, http.StatusOK, updatedIssue)
}

func (s *Server) handleVerifyIssue(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	userIDStr, ok := ctx.Value(ctxUserID).(string)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	var id pgtype.UUID
	if err := id.Scan(idStr); err != nil {
		http.Error(w, "invalid issue id", http.StatusBadRequest)
		return
	}

	var actorID pgtype.UUID
	if err := actorID.Scan(userIDStr); err != nil {
		http.Error(w, "invalid user id in context", http.StatusInternalServerError)
		return
	}

	var input struct {
		Action  string `json:"action"`
		Comment string `json:"comment"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	action, err := validateIssueVerificationAction(input.Action)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if s.Store == nil {
		http.Error(w, "database unavailable", http.StatusServiceUnavailable)
		return
	}

	issue, err := s.Store.GetIssue(ctx, id)
	if err != nil {
		http.Error(w, "issue not found", http.StatusNotFound)
		return
	}

	if formatUUID(issue.UserID) != formatUUID(actorID) {
		http.Error(w, "forbidden: only the original reporter can verify this issue", http.StatusForbidden)
		return
	}

	if issue.Status != "pending-verification" {
		http.Error(w, "issue is not awaiting citizen verification", http.StatusConflict)
		return
	}

	nextStatus := "verified-resolved"
	comment := strings.TrimSpace(input.Comment)
	if action == "dispute" {
		nextStatus = "reopened"
		if comment == "" {
			comment = "Reporter disputed the claimed resolution."
		}
	}

	if err := s.Store.UpdateIssueStatus(ctx, db.UpdateIssueStatusParams{
		ID:     id,
		Status: nextStatus,
	}); err != nil {
		slog.Error("VerifyIssue UpdateIssueStatus", slog.Any("err", err))
		http.Error(w, "failed to update issue verification", http.StatusInternalServerError)
		return
	}

	if nextStatus == "verified-resolved" {
		if _, err := s.Store.Primary.Exec(
			ctx,
			"UPDATE issues SET resolved_at = NOW() WHERE id = $1 AND resolved_at IS NULL",
			id,
		); err != nil {
			slog.Warn("verify issue resolved_at update failed", slog.Any("err", err))
		}
	} else {
		if _, err := s.Store.Primary.Exec(
			ctx,
			"UPDATE issues SET resolved_at = NULL WHERE id = $1",
			id,
		); err != nil {
			slog.Warn("verify issue resolved_at clear failed", slog.Any("err", err))
		}
	}

	if comment != "" {
		if _, err := s.Store.CreateComment(ctx, db.CreateCommentParams{
			IssueID: id,
			UserID:  actorID,
			Content: comment,
		}); err != nil {
			slog.Warn("verification comment creation failed", slog.Any("err", err))
		}
	}

	if s.Cache != nil {
		s.Cache.DeletePattern(ctx, "issues:list:*")
		s.Cache.Delete(ctx, "analytics:overview")
		s.Cache.DeletePattern(ctx, "ml:*")
	}

	respondJSON(w, http.StatusOK, map[string]string{
		"status": nextStatus,
		"result": action,
	})
}
