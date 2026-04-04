package api

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func (s *Server) mountLocationsRoutes(r chi.Router) {
	r.Get("/regions", s.handleListRegions)
	r.Get("/regions/{region_id}/districts", s.handleListDistricts)
	r.Get("/districts/{district_id}/constituencies", s.handleListConstituencies)
}

func (s *Server) handleListRegions(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	regions, err := s.Store.ListRegions(ctx)
	if err != nil {
		http.Error(w, "Error fetching regions", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(regions)
}

func (s *Server) handleListDistricts(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	regionIDStr := chi.URLParam(r, "region_id")

	var regionID pgtype.UUID
	if err := regionID.Scan(regionIDStr); err != nil {
		http.Error(w, "Invalid region ID", http.StatusBadRequest)
		return
	}

	districts, err := s.Store.ListDistrictsByRegion(ctx, regionID)
	if err != nil {
		http.Error(w, "Error fetching districts", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(districts)
}

func (s *Server) handleListConstituencies(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	districtIDStr := chi.URLParam(r, "district_id")

	var districtID pgtype.UUID
	if err := districtID.Scan(districtIDStr); err != nil {
		http.Error(w, "Invalid district ID", http.StatusBadRequest)
		return
	}

	constituencies, err := s.Store.ListConstituenciesByDistrict(ctx, districtID)
	if err != nil {
		http.Error(w, "Error fetching constituencies", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(constituencies)
}
