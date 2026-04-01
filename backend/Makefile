# GovLens MVP — Backend Makefile
# Run everything from this directory: make <target>

BINARY     := govlens-api
BUILD_DIR  := ./bin
CMD_DIR    := ./cmd/api
MIGRATE    := migrate
MIGRATE_DB ?= $(DATABASE_URL)
MIGRATE_PATH := ./migrations

.PHONY: all build run test lint generate migrate migrate-down migrate-status seed tidy clean

## ── Build ──────────────────────────────────────────────────────────────────

all: build

build:
	@echo "→ Building $(BINARY)..."
	@mkdir -p $(BUILD_DIR)
	go build -o $(BUILD_DIR)/$(BINARY) $(CMD_DIR)

run: build
	$(BUILD_DIR)/$(BINARY)

## ── Testing ────────────────────────────────────────────────────────────────

test:
	go test ./... -v -race -timeout 30s

lint:
	@which golangci-lint > /dev/null || (echo "Install golangci-lint: https://golangci-lint.run/usage/install/" && exit 1)
	golangci-lint run ./...

## ── Code generation ────────────────────────────────────────────────────────

generate:
	@which sqlc > /dev/null || (echo "Install sqlc: https://docs.sqlc.dev/en/stable/overview/install.html" && exit 1)
	sqlc generate

## ── Database migrations ────────────────────────────────────────────────────

migrate:
	@echo "→ Running migrations UP..."
	$(MIGRATE) -path $(MIGRATE_PATH) -database "$(MIGRATE_DB)" up

migrate-down:
	@echo "→ Rolling back one migration..."
	$(MIGRATE) -path $(MIGRATE_PATH) -database "$(MIGRATE_DB)" down 1

migrate-status:
	$(MIGRATE) -path $(MIGRATE_PATH) -database "$(MIGRATE_DB)" version

migrate-drop:
	@echo "⚠  Dropping all tables (use with care)..."
	$(MIGRATE) -path $(MIGRATE_PATH) -database "$(MIGRATE_DB)" drop -f

## ── Seed data ──────────────────────────────────────────────────────────────
# Seeds sample data directly into PostgreSQL using psql.
# Requires psql to be installed. Override DATABASE_URL as needed.

seed:
	@echo "→ Seeding sample data..."
	psql "$(MIGRATE_DB)" -c "\
	INSERT INTO users (name, email, password_hash, role, constituency) VALUES \
	  ('Alice Citizen', 'alice@example.com', '\$$2a\$$10\$$placeholder', 'citizen', 'Ampang'), \
	  ('MP rahman', 'mp@example.com', '\$$2a\$$10\$$placeholder', 'mp', 'Ampang') \
	ON CONFLICT DO NOTHING; \
	INSERT INTO issues (user_id, title, description, zone, lat, lng) \
	SELECT id, 'Pothole on Jalan Ampang', 'Large pothole causing accidents', 'Ampang', 3.158, 101.718 \
	FROM users WHERE email='alice@example.com' LIMIT 1 ON CONFLICT DO NOTHING;"

## ── Docker ─────────────────────────────────────────────────────────────────

docker-up:
	docker compose up --build

docker-down:
	docker compose down -v

## ── Cleanup ────────────────────────────────────────────────────────────────

tidy:
	go mod tidy

clean:
	rm -rf $(BUILD_DIR)
