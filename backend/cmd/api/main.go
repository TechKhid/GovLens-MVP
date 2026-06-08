package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/govlens/govlens-mvp/backend/internal/api"
	"github.com/govlens/govlens-mvp/backend/internal/cache"
	"github.com/govlens/govlens-mvp/backend/internal/db"
	"github.com/govlens/govlens-mvp/backend/internal/queue"
)

// retryConnect retries a connection factory with exponential backoff.
// Returns the result of the first successful call, or the last error after
// all attempts are exhausted.
func retryConnect[T any](name string, maxAttempts int, factory func() (T, error)) (T, error) {
	backoff := 1 * time.Second
	const maxBackoff = 30 * time.Second

	var lastErr error
	var zero T

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		result, err := factory()
		if err == nil {
			return result, nil
		}
		lastErr = err
		slog.Warn(
			fmt.Sprintf("%s connection attempt %d/%d failed, retrying in %s", name, attempt, maxAttempts, backoff),
			slog.Any("err", err),
		)
		time.Sleep(backoff)
		backoff = backoff * 2
		if backoff > maxBackoff {
			backoff = maxBackoff
		}
	}

	return zero, fmt.Errorf("%s: all %d attempts exhausted: %w", name, maxAttempts, lastErr)
}

func main() {
	// 1. Initialize structured logger
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}

	ctx := context.Background()

	// 2. Initialize infrastructure with retry logic
	// Database is critical — retry up to 10 times (~8.5 min total with backoff)
	store, err := retryConnect("PostgreSQL", 10, func() (*db.Store, error) {
		return db.NewStore(ctx)
	})
	if err != nil {
		slog.Error("CRITICAL: Failed to connect to database after retries — exiting", slog.Any("err", err))
		os.Exit(1)
	}

	// Redis is optional — retry up to 5 times, then degrade gracefully
	redisCache, err := retryConnect("Redis", 5, func() (*cache.Cache, error) {
		return cache.NewCache(ctx)
	})
	if err != nil {
		slog.Warn("Redis unavailable — running without cache", slog.Any("err", err))
		redisCache = nil
	}

	// NATS is optional — retry up to 5 times, then degrade gracefully
	natsQueue, err := retryConnect("NATS", 5, func() (*queue.Queue, error) {
		return queue.NewQueue()
	})
	if err != nil {
		slog.Warn("NATS unavailable — running without event queue", slog.Any("err", err))
		natsQueue = nil
	}

	// 3. Build the root router with global middleware
	root := chi.NewRouter()
	root.Use(middleware.RequestID)
	root.Use(middleware.RealIP)
	root.Use(middleware.Logger)
	root.Use(middleware.Recoverer)
	root.Use(middleware.Timeout(60 * time.Second))
	root.Use(corsMiddleware)

	// 4. Create API server and mount its sub-router
	apiServer := api.NewServer(store, redisCache, natsQueue)

	// Health route at root level (used by nginx + k8s probes)
	root.Get("/health", apiServer.HandleHealth)
	root.Handle("/api/v1/uploads/*", apiServer.UploadsHandler())

	// Mount all /api/v1/* routes
	root.Mount("/api/v1", apiServer.Router)

	// 5. HTTP server with graceful shutdown
	server := &http.Server{
		Addr:         ":" + port,
		Handler:      root,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		slog.Info("Starting GovLens API server", slog.String("port", port))
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server error", slog.Any("err", err))
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	slog.Info("Shutting down server...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("Server forced to shutdown", slog.Any("err", err))
		os.Exit(1)
	}

	slog.Info("Server exited cleanly")
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Authorization, Content-Type, X-CSRF-Token")
		w.Header().Set("Access-Control-Expose-Headers", "Link")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}
