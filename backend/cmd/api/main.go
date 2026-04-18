package main

import (
	"context"
	"errors"
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

	// 2. Initialize infrastructure — soft-fail so container starts even if deps are slow
	store, err := db.NewStore(ctx)
	if err != nil {
		slog.Error("Failed to connect to database", slog.Any("err", err))
	}

	redisCache, err := cache.NewCache(ctx)
	if err != nil {
		slog.Error("Failed to connect to redis", slog.Any("err", err))
	}

	natsQueue, err := queue.NewQueue()
	if err != nil {
		slog.Error("Failed to connect to NATS", slog.Any("err", err))
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
