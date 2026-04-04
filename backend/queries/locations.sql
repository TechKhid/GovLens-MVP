-- name: ListRegions :many
SELECT id, name, slug, capital FROM regions ORDER BY name ASC;

-- name: ListDistrictsByRegion :many
SELECT id, name, slug, region_id FROM districts WHERE region_id = $1 ORDER BY name ASC;

-- name: ListConstituenciesByDistrict :many
SELECT id, name, slug, district_id FROM constituencies WHERE district_id = $1 ORDER BY name ASC;

-- name: GetRegionBySlug :one
SELECT * FROM regions WHERE slug = $1 LIMIT 1;

-- name: GetDistrictBySlug :one
SELECT * FROM districts WHERE slug = $1 LIMIT 1;

-- name: InsertRegion :one
INSERT INTO regions (name, slug, capital) VALUES ($1, $2, $3) RETURNING id, name, slug;

-- name: InsertDistrict :one
INSERT INTO districts (name, slug, region_id) VALUES ($1, $2, $3) RETURNING id, name, slug;

-- name: InsertConstituency :one
INSERT INTO constituencies (name, slug, district_id) VALUES ($1, $2, $3) RETURNING id, name, slug;
