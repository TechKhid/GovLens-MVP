package db

import (
	"context"
	"fmt"
	"log/slog"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Store provides all functions to execute db queries and transactions
type Store struct {
	*Queries
	Primary *pgxpool.Pool
	Replica *pgxpool.Pool
}

// NewStore creates a new Store instance
func NewStore(ctx context.Context) (*Store, error) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return nil, fmt.Errorf("DATABASE_URL not set")
	}

	config, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		return nil, fmt.Errorf("parsing db string: %w", err)
	}

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("creating connection pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("pinging db: %w", err)
	}

	slog.Info("Connected to PostgreSQL database")

	return &Store{
		Queries: New(pool),
		Primary: pool,
		Replica: pool,
	}, nil
}
