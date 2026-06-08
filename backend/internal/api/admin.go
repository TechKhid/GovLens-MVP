package api

import (
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/govlens/govlens-mvp/backend/internal/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/crypto/bcrypt"
)

// sysadminMiddleware ensures only users with the sysadmin role can access these routes.
func (s *Server) sysadminMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		role, ok := r.Context().Value(ctxRole).(string)
		if !ok || (role != "sysadmin" && role != "admin") {
			http.Error(w, "forbidden: requires sysadmin role", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ── GET /admin/stats ──────────────────────────────────────────────────────────

func (s *Server) handleAdminStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	stats, err := s.Store.GetAdminStats(ctx)
	if err != nil {
		http.Error(w, "failed to get stats", http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"total_users":   stats.TotalUsers,
		"active_mps":    stats.ActiveMps,
		"total_issues":  stats.TotalIssues,
		"system_health": "OK", // Basic placeholder, could dynamically ping DB
	})
}

// ── GET /admin/users ──────────────────────────────────────────────────────────

func (s *Server) handleAdminListUsers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	users, err := s.Store.ListAllUsers(ctx)
	if err != nil {
		http.Error(w, "failed to fetch users", http.StatusInternalServerError)
		return
	}
	respondJSON(w, http.StatusOK, users)
}

// ── PATCH /admin/users/{id}/suspend ───────────────────────────────────────────

type SuspendUserRequest struct {
	LoginSuspended bool `json:"login_suspended"`
	ContentHidden  bool `json:"content_hidden"`
}

func (s *Server) handleAdminSuspendUser(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var targetID pgtype.UUID
	if err := targetID.Scan(chi.URLParam(r, "id")); err != nil {
		http.Error(w, "invalid user id", http.StatusBadRequest)
		return
	}

	var req SuspendUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid payload", http.StatusBadRequest)
		return
	}

	// Target flag updates
	updated, err := s.Store.UpdateUserFlags(ctx, db.UpdateUserFlagsParams{
		ID:             targetID,
		LoginSuspended: req.LoginSuspended,
		ContentHidden:  req.ContentHidden,
	})
	if err != nil {
		http.Error(w, "failed to update user flags", http.StatusInternalServerError)
		return
	}

	// Log the action
	actorIDStr, _ := ctx.Value(ctxUserID).(string)
	var actorID pgtype.UUID
	if err := actorID.Scan(actorIDStr); err != nil {
		// Just a fallback if context value isn't purely a UUID string
		actorID = pgtype.UUID{}
	}

	actionDesc := "Updated suspension flags (Login: " + boolToStr(req.LoginSuspended) +
		", Content: " + boolToStr(req.ContentHidden) + ")"

	_, _ = s.Store.InsertAuditLog(ctx, db.InsertAuditLogParams{
		ActorID:  actorID,
		Action:   actionDesc,
		TargetID: targetID,
	})

	respondJSON(w, http.StatusOK, updated)
}

// ── PATCH /admin/users/{id}/role ──────────────────────────────────────────────

type UpdateRoleRequest struct {
	Role string `json:"role"`
}

func normalizeManagedUserRole(role string) (string, error) {
	normalized := strings.ToLower(strings.TrimSpace(role))
	switch normalized {
	case "citizen", "mp", "sysadmin":
		return normalized, nil
	default:
		return "", fmt.Errorf("invalid role type")
	}
}

func (s *Server) handleAdminUpdateRole(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if s.Store == nil {
		http.Error(w, "database unavailable", http.StatusServiceUnavailable)
		return
	}

	var targetID pgtype.UUID
	if err := targetID.Scan(chi.URLParam(r, "id")); err != nil {
		http.Error(w, "invalid user id", http.StatusBadRequest)
		return
	}

	var req UpdateRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid payload", http.StatusBadRequest)
		return
	}

	role, err := normalizeManagedUserRole(req.Role)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	updated, err := s.Store.ChangeUserRoleWithLifecycle(ctx, db.ChangeUserRoleWithLifecycleParams{
		ID:   targetID,
		Role: role,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, "user not found", http.StatusNotFound)
			return
		}
		if errors.Is(err, db.ErrMPRoleRequiresConstituency) {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		http.Error(w, "failed to update user role", http.StatusInternalServerError)
		return
	}

	// Log the action
	actorIDStr, _ := ctx.Value(ctxUserID).(string)
	var actorID pgtype.UUID
	_ = actorID.Scan(actorIDStr)

	_, _ = s.Store.InsertAuditLog(ctx, db.InsertAuditLogParams{
		ActorID:  actorID,
		Action:   "Changed user role to " + role,
		TargetID: targetID,
	})

	respondJSON(w, http.StatusOK, updated)
}

// ── GET /admin/audit-logs ─────────────────────────────────────────────────────

func (s *Server) handleAdminAuditLogs(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	logs, err := s.Store.ListAuditLogs(ctx)
	if err != nil {
		http.Error(w, "failed to get audit logs", http.StatusInternalServerError)
		return
	}
	respondJSON(w, http.StatusOK, logs)
}

// ── POST /admin/users/bulk-import ─────────────────────────────────────────────

// Expects a multipart form submission with a "file" field containing CSV data
// Columns: name,email,role,constituency
func (s *Server) handleAdminBulkImport(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if s.Store == nil {
		http.Error(w, "database unavailable", http.StatusServiceUnavailable)
		return
	}

	err := r.ParseMultipartForm(10 << 20) // 10 MB limit
	if err != nil {
		http.Error(w, "file too large or invalid multipart", http.StatusBadRequest)
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "missing file in request", http.StatusBadRequest)
		return
	}
	defer file.Close()

	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		http.Error(w, "failed to parse csv", http.StatusBadRequest)
		return
	}

	if len(records) < 2 {
		http.Error(w, "csv must contain at least a header row and one data row", http.StatusBadRequest)
		return
	}

	// Assuming default generic password for imported users
	dummyPasswordHash, _ := bcrypt.GenerateFromPassword([]byte("Welcome123!"), bcrypt.DefaultCost)

	successCount := 0
	for i, row := range records {
		if i == 0 {
			continue // skip header
		}
		if len(row) < 4 {
			continue // skip malformed rows
		}

		name := strings.TrimSpace(row[0])
		email := strings.TrimSpace(row[1])
		role, err := normalizeManagedUserRole(row[2])
		if err != nil {
			continue
		}
		constituency := strings.TrimSpace(row[3])

		constiPtr := &constituency
		if constituency == "" {
			constiPtr = nil
		}
		if role == "mp" && constiPtr == nil {
			continue
		}

		var mpProfile *db.MPProfileSeed
		if role == "mp" {
			mpProfile = &db.MPProfileSeed{
				Bio: "Member of Parliament for " + constituency,
			}
		}

		_, err = s.Store.RegisterUserWithOptionalMPProfile(ctx, db.RegisterUserWithOptionalMPProfileParams{
			Name:         name,
			Email:        email,
			PasswordHash: string(dummyPasswordHash),
			Role:         role,
			Constituency: constiPtr,
			MPProfile:    mpProfile,
		})

		if err == nil {
			successCount++
		}
	}

	// Log the batch action
	actorIDStr, _ := ctx.Value(ctxUserID).(string)
	var actorID pgtype.UUID
	_ = actorID.Scan(actorIDStr)

	_, _ = s.Store.InsertAuditLog(ctx, db.InsertAuditLogParams{
		ActorID:  actorID,
		Action:   "Bulk imported users",
		TargetID: pgtype.UUID{}, // general target, valid=false
	})

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message":              "Bulk import completed",
		"success_count":        successCount,
		"total_rows_processed": len(records) - 1,
	})
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// boolToStr converts boolean to string for logging
func boolToStr(b bool) string {
	if b {
		return "true"
	}
	return "false"
}
