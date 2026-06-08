package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/redis/go-redis/v9"
)

// MPPublicProfileResponse is the full public MP profile, served to any visitor.
type MPPublicProfileResponse struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Constituency string `json:"constituency"`
	Party        string `json:"party"`
	TermStart    string `json:"term_start"`
	TermEnd      string `json:"term_end"`
	Bio          string `json:"bio"`
	Phone        string `json:"phone"`
	OfficeAddr   string `json:"office_addr"`
	PhotoURL     string `json:"photo_url"`
}

// GET /mp/profile — cached 5min per user
// Returns the authenticated MP's full profile from DB.
func (s *Server) handleMPProfile(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	userIDStr, ok := ctx.Value("user_id").(string)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	cacheKey := "mp:profile:" + userIDStr

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

	var uid pgtype.UUID
	if err := uid.Scan(userIDStr); err != nil {
		http.Error(w, "invalid user id", http.StatusBadRequest)
		return
	}

	user, err := s.Store.GetUserByID(ctx, uid)
	if err != nil {
		slog.Error("GetUserByID for MP profile", slog.Any("err", err))
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}

	var connStr string
	if user.Constituency != nil {
		connStr = *user.Constituency
	}

	profile := UserResponse{
		ID:           formatUUID(user.ID),
		Name:         user.Name,
		Email:        user.Email,
		Role:         user.Role,
		Constituency: connStr,
	}

	data, _ := json.Marshal(profile)

	if s.Cache != nil {
		s.Cache.Set(ctx, cacheKey, data, 5*time.Minute)
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Cache", "MISS")
	w.Write(data)
}

// GET /mp/public-profile?constituency=... — cached 5 min, no authentication required.
// Joins users + mp_profiles to return the full constituency MP profile matching the param.
func (s *Server) handleMPPublicProfile(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	reqConstituency := r.URL.Query().Get("constituency")
	if reqConstituency == "" {
		// Fallback to Ayawaso West Wuogon for backwards-compatibility or empty params
		reqConstituency = "Ayawaso West Wuogon"
	}

	cacheKey := "mp:public-profile:" + reqConstituency

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

	const q = `
		SELECT
			u.id, u.name, COALESCE(u.constituency,'') AS constituency,
			COALESCE(p.party,'')       AS party,
			COALESCE(p.term_start,'')  AS term_start,
			COALESCE(p.term_end,'')    AS term_end,
			COALESCE(p.bio,'')         AS bio,
			COALESCE(p.phone,'')       AS phone,
			COALESCE(p.office_addr,'') AS office_addr,
			COALESCE(p.photo_url,'')   AS photo_url
		FROM users u
		LEFT JOIN mp_profiles p ON p.user_id = u.id AND p.profile_status = 'active'
		WHERE u.role = 'mp' AND u.constituency = $1
		LIMIT 1`

	row := s.Store.Primary.QueryRow(ctx, q, reqConstituency)

	var (
		uid                              pgtype.UUID
		name, constituency               string
		party, termStart, termEnd        string
		bio, phone, officeAddr, photoURL string
	)
	if err := row.Scan(&uid, &name, &constituency, &party, &termStart, &termEnd, &bio, &phone, &officeAddr, &photoURL); err != nil {
		slog.Error("handleMPPublicProfile scan", slog.Any("err", err))
		http.Error(w, "MP profile not found", http.StatusNotFound)
		return
	}

	profile := MPPublicProfileResponse{
		ID:           formatUUID(uid),
		Name:         name,
		Constituency: constituency,
		Party:        party,
		TermStart:    termStart,
		TermEnd:      termEnd,
		Bio:          bio,
		Phone:        phone,
		OfficeAddr:   officeAddr,
		PhotoURL:     photoURL,
	}

	data, _ := json.Marshal(profile)

	if s.Cache != nil {
		s.Cache.Set(ctx, cacheKey, data, 5*time.Minute)
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Cache", "MISS")
	w.Write(data)
}
