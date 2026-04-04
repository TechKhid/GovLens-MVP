package api

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/govlens/govlens-mvp/backend/internal/db"
	"github.com/govlens/govlens-mvp/backend/internal/service"
)

// LoginRequest is the JSON body for POST /auth/login.
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// RegisterRequest is the JSON body for POST /auth/register.
type RegisterRequest struct {
	Name         string `json:"name"`
	Email        string `json:"email"`
	Password     string `json:"password"`
	Role         string `json:"role"`
	Constituency string `json:"constituency"`
	Party        string `json:"party"`
	TermStart    string `json:"term_start"`
	TermEnd      string `json:"term_end"`
	Bio          string `json:"bio"`
	Phone        string `json:"phone"`
	OfficeAddr   string `json:"office_addr"`
}

// UserResponse is the public-facing representation of a user.
type UserResponse struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Email        string `json:"email"`
	Role         string `json:"role"`
	Constituency string `json:"constituency"`
}

// formatUUID converts a pgtype.UUID into a standard hyphenated UUID string.
func formatUUID(id pgtype.UUID) string {
	b := id.Bytes
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// POST /auth/register
func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	if req.Email == "" || req.Password == "" || req.Name == "" {
		http.Error(w, "name, email and password are required", http.StatusBadRequest)
		return
	}

	hashedPassword, err := service.HashPassword(req.Password)
	if err != nil {
		http.Error(w, "could not process password", http.StatusInternalServerError)
		return
	}

	if s.Store == nil {
		http.Error(w, "database unavailable", http.StatusServiceUnavailable)
		return
	}

	var constituencyPtr *string
	if req.Constituency != "" {
		constituencyPtr = &req.Constituency
	}

	role := req.Role
	if role != "mp" {
		role = "citizen"
	}

	user, err := s.Store.CreateUser(r.Context(), db.CreateUserParams{
		Name:         req.Name,
		Email:        req.Email,
		PasswordHash: hashedPassword,
		Role:         role,
		Constituency: constituencyPtr,
	})
	if err != nil {
		http.Error(w, "could not create user: "+err.Error(), http.StatusConflict)
		return
	}

	if role == "mp" {
		termStart := req.TermStart
		if termStart == "" {
			termStart = "2025"
		}
		termEnd := req.TermEnd
		if termEnd == "" {
			termEnd = "2029"
		}
		bio := req.Bio
		if bio == "" {
			bio = "Member of Parliament for " + req.Constituency
		}

		_, err := s.Store.CreateMPProfile(r.Context(), db.CreateMPProfileParams{
			UserID:     user.ID,
			Party:      req.Party,
			TermStart:  termStart,
			TermEnd:    termEnd,
			Bio:        bio,
			Phone:      req.Phone,
			OfficeAddr: req.OfficeAddr,
			PhotoUrl:   "", // Left blank, to be updated later
		})
		if err != nil {
			slog.Error("Failed to create MP Profile during registration", slog.Any("err", err))
		}
	}

	var connStr string
	if user.Constituency != nil {
		connStr = *user.Constituency
	}

	respondJSON(w, http.StatusCreated, UserResponse{
		ID:           formatUUID(user.ID),
		Name:         user.Name,
		Email:        user.Email,
		Role:         user.Role,
		Constituency: connStr,
	})
}

// POST /auth/login
func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	if s.Store == nil {
		http.Error(w, "database unavailable", http.StatusServiceUnavailable)
		return
	}

	user, err := s.Store.GetUserByEmail(r.Context(), req.Email)
	if err != nil {
		if err == pgx.ErrNoRows {
			http.Error(w, "invalid credentials", http.StatusUnauthorized)
			return
		}
		slog.Error("GetUserByEmail returned error", slog.Any("err", err))
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}

	if !service.CheckPasswordHash(req.Password, user.PasswordHash) {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	var connStr string
	if user.Constituency != nil {
		connStr = *user.Constituency
	}

	accessToken, err := service.GenerateAccessToken(formatUUID(user.ID), user.Name, user.Email, user.Role, connStr)
	if err != nil {
		http.Error(w, "could not generate token", http.StatusInternalServerError)
		return
	}

	refreshToken, err := service.GenerateRefreshToken()
	if err != nil {
		http.Error(w, "could not generate refresh token", http.StatusInternalServerError)
		return
	}

	// Store refresh token → user ID mapping in Redis (7-day TTL)
	if s.Cache != nil {
		if err := s.Cache.Set(r.Context(), "refresh:"+refreshToken, []byte(formatUUID(user.ID)), 168*time.Hour); err != nil {
			slog.Error("Failed to store refresh token", slog.Any("err", err))
			http.Error(w, "could not save session", http.StatusInternalServerError)
			return
		}
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    refreshToken,
		HttpOnly: true,
		Secure:   true,
		Path:     "/",
		SameSite: http.SameSiteStrictMode,
		MaxAge:   7 * 24 * 3600,
	})

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"access_token": accessToken,
		"user": UserResponse{
			ID:           formatUUID(user.ID),
			Name:         user.Name,
			Email:        user.Email,
			Role:         user.Role,
			Constituency: connStr,
		},
	})
}

// DELETE /auth/logout
// Clears the refresh-token cookie and removes the session from Redis.
func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	// Expire the httpOnly refresh-token cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    "",
		HttpOnly: true,
		Secure:   true,
		Path:     "/",
		SameSite: http.SameSiteStrictMode,
		MaxAge:   -1,
	})

	// Best-effort: remove refresh token from Redis
	if cookie, err := r.Cookie("refresh_token"); err == nil && s.Cache != nil {
		_ = s.Cache.Delete(r.Context(), "refresh:"+cookie.Value)
	}

	w.WriteHeader(http.StatusNoContent)
}

// POST /auth/refresh
// Exchanges a valid refresh token cookie for a new access token.
// Fetches the user from DB to embed the correct current role.
func (s *Server) handleRefresh(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("refresh_token")
	if err != nil {
		http.Error(w, "no refresh token", http.StatusUnauthorized)
		return
	}

	if s.Cache == nil {
		http.Error(w, "session store unavailable", http.StatusServiceUnavailable)
		return
	}

	userIDBytes, err := s.Cache.Get(r.Context(), "refresh:"+cookie.Value)
	if err != nil {
		http.Error(w, "invalid or expired refresh token", http.StatusUnauthorized)
		return
	}
	userIDStr := string(userIDBytes)

	// Fetch the real role and claims from DB so changes take effect on next refresh
	var role, name, email, constituency string
	if s.Store != nil {
		var uid pgtype.UUID
		if err := uid.Scan(userIDStr); err == nil {
			if user, err := s.Store.GetUserByID(r.Context(), uid); err == nil {
				role = user.Role
				name = user.Name
				email = user.Email
				if user.Constituency != nil {
					constituency = *user.Constituency
				}
			}
		}
	}
	if role == "" {
		role = "citizen" // safe fallback
	}

	newToken, err := service.GenerateAccessToken(userIDStr, name, email, role, constituency)
	if err != nil {
		http.Error(w, "could not generate token", http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"access_token": newToken,
	})
}
