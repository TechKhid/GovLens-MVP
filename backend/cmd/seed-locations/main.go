package main

import (
	"context"
	"encoding/json"
	"log"
	"os"

	"github.com/govlens/govlens-mvp/backend/internal/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Region struct {
	Name    string `json:"name"`
	Slug    string `json:"slug"`
	Capital string `json:"capital"`
}

type District struct {
	Name   string `json:"name"`
	Slug   string `json:"slug"`
	Region string `json:"region_slug"`
}

type Constituency struct {
	Name     string `json:"name"`
	Slug     string `json:"slug"`
	District string `json:"district_slug"`
}

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://govlens:password@localhost:5432/govlens?sslmode=disable"
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v\n", err)
	}
	defer pool.Close()

	queries := db.New(pool)

	log.Println("Seeding Regions...")
	seedRegions("data/regions.json", queries, ctx)

	log.Println("Seeding Districts...")
	seedDistricts("data/districts.json", queries, ctx)

	log.Println("Seeding Constituencies...")
	seedConstituencies("data/constituencies.json", queries, ctx)

	log.Println("Database successfully seeded with location configurations!")
}

func seedRegions(path string, q *db.Queries, ctx context.Context) {
	file, err := os.ReadFile(path)
	if err != nil {
		log.Printf("Skipping regions, could not read %s: %v\n", path, err)
		return
	}

	var regions []Region
	if err := json.Unmarshal(file, &regions); err != nil {
		log.Fatalf("Error parsing regions JSON: %v", err)
	}

	for _, r := range regions {
		// check if exists
		_, err := q.GetRegionBySlug(ctx, r.Slug)
		if err != nil {
			_, err = q.InsertRegion(ctx, db.InsertRegionParams{
				Name:    r.Name,
				Slug:    r.Slug,
				Capital: r.Capital,
			})
			if err != nil {
				log.Printf("Failed to insert region %s: %v", r.Name, err)
			}
		}
	}
}

func seedDistricts(path string, q *db.Queries, ctx context.Context) {
	file, err := os.ReadFile(path)
	if err != nil {
		log.Printf("Skipping districts, could not read %s: %v\n", path, err)
		return
	}

	var districts []District
	if err := json.Unmarshal(file, &districts); err != nil {
		log.Fatalf("Error parsing districts JSON: %v", err)
	}

	for _, d := range districts {
		// Try to find the region first
		region, err := q.GetRegionBySlug(ctx, d.Region)
		if err != nil {
			log.Printf("Region slug %s not found for district %s", d.Region, d.Name)
			continue
		}

		_, err = q.GetDistrictBySlug(ctx, d.Slug)
		if err != nil {
			_, err = q.InsertDistrict(ctx, db.InsertDistrictParams{
				Name:     d.Name,
				Slug:     d.Slug,
				RegionID: region.ID,
			})
			if err != nil {
				log.Printf("Failed to insert district %s: %v", d.Name, err)
			}
		}
	}
}

func seedConstituencies(path string, q *db.Queries, ctx context.Context) {
	file, err := os.ReadFile(path)
	if err != nil {
		log.Printf("Skipping constituencies, could not read %s: %v\n", path, err)
		return
	}

	var constituencies []Constituency
	if err := json.Unmarshal(file, &constituencies); err != nil {
		log.Fatalf("Error parsing constituencies JSON: %v", err)
	}

	for _, c := range constituencies {
		district, err := q.GetDistrictBySlug(ctx, c.District)
		if err != nil {
			log.Printf("District slug %s not found for constituency %s", c.District, c.Name)
			continue
		}

		_, err = q.InsertConstituency(ctx, db.InsertConstituencyParams{
			Name:       c.Name,
			Slug:       c.Slug,
			DistrictID: district.ID,
		})
		if err != nil {
			log.Printf("Failed to insert constituency %s: %v", c.Name, err)
		}
	}
}
