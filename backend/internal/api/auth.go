package api

import (
	"bytes"
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/govlens/govlens-mvp/backend/internal/db"
	"github.com/govlens/govlens-mvp/backend/internal/service"
	"github.com/google/uuid"
)

const (
	maxMPAvatarSize    = 5 << 20
	maxRegisterFormBytes = 16 << 20
)

var allowedMPAvatarTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

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
	InviteCode   string `json:"invite_code"`
	Constituency string `json:"constituency"`
	Party        string `json:"party"`
	TermStart    string `json:"term_start"`
	TermEnd      string `json:"term_end"`
	Bio          string `json:"bio"`
	Phone        string `json:"phone"`
	OfficeAddr   string `json:"office_addr"`
	PhotoURL     string `json:"photo_url"`
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

func sanitizeRegisterRequest(req RegisterRequest) RegisterRequest {
	req.Name = strings.TrimSpace(req.Name)
	req.Email = strings.TrimSpace(req.Email)
	req.Role = strings.ToLower(strings.TrimSpace(req.Role))
	req.InviteCode = strings.TrimSpace(req.InviteCode)
	req.Constituency = strings.TrimSpace(req.Constituency)
	req.Party = strings.TrimSpace(req.Party)
	req.TermStart = strings.TrimSpace(req.TermStart)
	req.TermEnd = strings.TrimSpace(req.TermEnd)
	req.Bio = strings.TrimSpace(req.Bio)
	req.Phone = strings.TrimSpace(req.Phone)
	req.OfficeAddr = strings.TrimSpace(req.OfficeAddr)
	req.PhotoURL = strings.TrimSpace(req.PhotoURL)
	return req
}

func (s *Server) parseRegisterRequest(w http.ResponseWriter, r *http.Request) (RegisterRequest, func(), error) {
	contentType := r.Header.Get("Content-Type")
	if strings.HasPrefix(contentType, "multipart/form-data") {
		return s.parseMultipartRegisterRequest(w, r)
	}

	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return RegisterRequest{}, nil, fmt.Errorf("invalid request")
	}
	return sanitizeRegisterRequest(req), nil, nil
}

func (s *Server) parseMultipartRegisterRequest(w http.ResponseWriter, r *http.Request) (RegisterRequest, func(), error) {
	r.Body = http.MaxBytesReader(w, r.Body, maxRegisterFormBytes)
	if err := r.ParseMultipartForm(maxRegisterFormBytes); err != nil {
		return RegisterRequest{}, nil, fmt.Errorf("file upload too large or invalid multipart form")
	}

	req := sanitizeRegisterRequest(RegisterRequest{
		Name:         r.FormValue("name"),
		Email:        r.FormValue("email"),
		Password:     r.FormValue("password"),
		Role:         r.FormValue("role"),
		InviteCode:   r.FormValue("invite_code"),
		Constituency: r.FormValue("constituency"),
		Party:        r.FormValue("party"),
		TermStart:    r.FormValue("term_start"),
		TermEnd:      r.FormValue("term_end"),
		Bio:          r.FormValue("bio"),
		Phone:        r.FormValue("phone"),
		OfficeAddr:   r.FormValue("office_addr"),
	})

	files := r.MultipartForm.File["avatar"]
	if len(files) == 0 {
		return req, nil, nil
	}
	if len(files) > 1 {
		return RegisterRequest{}, nil, fmt.Errorf("upload only one avatar image")
	}
	if req.Role != "mp" {
		return RegisterRequest{}, nil, fmt.Errorf("avatar upload is only available for MP registration")
	}
	if err := s.ensureUploadsRoot(); err != nil {
		return RegisterRequest{}, nil, fmt.Errorf("failed to prepare upload directory")
	}

	avatarID := uuid.NewString()
	avatarDir := filepath.Join(s.uploadsRoot(), "mps", avatarID)
	if err := os.MkdirAll(avatarDir, 0o755); err != nil {
		return RegisterRequest{}, nil, fmt.Errorf("failed to prepare avatar directory")
	}

	cleanup := func() {
		_ = os.RemoveAll(avatarDir)
	}

	avatarURL, err := s.saveMPAvatar(avatarDir, avatarID, files[0])
	if err != nil {
		cleanup()
		return RegisterRequest{}, nil, err
	}
	req.PhotoURL = avatarURL
	return req, cleanup, nil
}

func (s *Server) saveMPAvatar(avatarDir, avatarID string, header *multipart.FileHeader) (string, error) {
	if header.Size > maxMPAvatarSize {
		return "", fmt.Errorf("avatar image must be 5MB or smaller")
	}

	src, err := header.Open()
	if err != nil {
		return "", fmt.Errorf("failed to read uploaded avatar")
	}
	defer src.Close()

	sniffBuf := make([]byte, 512)
	n, readErr := io.ReadFull(src, sniffBuf)
	if readErr != nil && readErr != io.ErrUnexpectedEOF {
		return "", fmt.Errorf("failed to inspect uploaded avatar")
	}

	contentType := http.DetectContentType(sniffBuf[:n])
	ext, ok := allowedMPAvatarTypes[contentType]
	if !ok {
		return "", fmt.Errorf("unsupported avatar format; use JPG, PNG, or WebP")
	}

	fileName := "avatar-" + uuid.NewString() + ext
	dstPath := filepath.Join(avatarDir, fileName)
	dst, err := os.OpenFile(dstPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644)
	if err != nil {
		return "", fmt.Errorf("failed to store uploaded avatar")
	}
	defer dst.Close()

	reader := io.MultiReader(bytes.NewReader(sniffBuf[:n]), src)
	if _, err := io.Copy(dst, reader); err != nil {
		return "", fmt.Errorf("failed to store uploaded avatar")
	}

	return s.uploadedFileURL(filepath.Join("mps", avatarID, fileName)), nil
}

func parseMPWhitelist(raw string) map[string]struct{} {
	whitelist := make(map[string]struct{})
	for _, item := range strings.Split(raw, ",") {
		email := strings.ToLower(strings.TrimSpace(item))
		if email == "" {
			continue
		}
		whitelist[email] = struct{}{}
	}
	return whitelist
}

func resolveRegistrationRole(
	requestedRole string,
	email string,
	inviteCode string,
	configuredInviteCode string,
	whitelist map[string]struct{},
) (string, error) {
	role := strings.ToLower(strings.TrimSpace(requestedRole))
	if role == "" || role == "citizen" {
		return "citizen", nil
	}
	if role != "mp" {
		return "citizen", nil
	}

	normalizedEmail := strings.ToLower(strings.TrimSpace(email))
	if _, ok := whitelist[normalizedEmail]; ok {
		return "mp", nil
	}

	trimmedInviteCode := strings.TrimSpace(inviteCode)
	if configuredInviteCode != "" &&
		subtle.ConstantTimeCompare([]byte(configuredInviteCode), []byte(trimmedInviteCode)) == 1 {
		return "mp", nil
	}

	return "", fmt.Errorf("MP onboarding is invite-only. Please contact GovLens for verification")
}

// POST /auth/register
func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	req, cleanupUploads, err := s.parseRegisterRequest(w, r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	keepUploads := false
	if cleanupUploads != nil {
		defer func() {
			if !keepUploads {
				cleanupUploads()
			}
		}()
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

	role, err := resolveRegistrationRole(
		req.Role,
		req.Email,
		req.InviteCode,
		strings.TrimSpace(os.Getenv("MP_INVITE_CODE")),
		parseMPWhitelist(os.Getenv("MP_WHITELIST_EMAILS")),
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
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
			PhotoUrl:   req.PhotoURL,
		})
		if err != nil {
			slog.Error("Failed to create MP Profile during registration", slog.Any("err", err))
		} else {
			keepUploads = true
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
