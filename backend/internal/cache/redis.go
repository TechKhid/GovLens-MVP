package cache

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

type Cache struct {
	Client *redis.Client
}

func NewCache(ctx context.Context) (*Cache, error) {
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		return nil, fmt.Errorf("REDIS_URL not set")
	}

	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		// fallback to plain addr (e.g. "redis:6379")
		opts = &redis.Options{
			Addr: redisURL,
		}
	}

	client := redis.NewClient(opts)

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("pinging redis: %w", err)
	}

	slog.Info("Connected to Redis")
	return &Cache{Client: client}, nil
}

// Set stores a value with a TTL. Use 0 for no expiry.
func (c *Cache) Set(ctx context.Context, key string, value []byte, ttl time.Duration) error {
	return c.Client.Set(ctx, key, value, ttl).Err()
}

// Get retrieves a value. Returns redis.Nil if the key does not exist.
func (c *Cache) Get(ctx context.Context, key string) ([]byte, error) {
	return c.Client.Get(ctx, key).Bytes()
}

// Delete removes one or more exact keys.
func (c *Cache) Delete(ctx context.Context, keys ...string) error {
	return c.Client.Del(ctx, keys...).Err()
}

// DeletePattern removes all keys matching a glob pattern (e.g. "issues:list:*").
// Use with care on large keyspaces — uses SCAN to avoid blocking.
func (c *Cache) DeletePattern(ctx context.Context, pattern string) error {
	var cursor uint64
	for {
		keys, newCursor, err := c.Client.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			return fmt.Errorf("scan: %w", err)
		}
		if len(keys) > 0 {
			if err := c.Client.Del(ctx, keys...).Err(); err != nil {
				return fmt.Errorf("del: %w", err)
			}
		}
		cursor = newCursor
		if cursor == 0 {
			break
		}
	}
	return nil
}

// Ping checks liveness of the Redis connection.
func (c *Cache) Ping(ctx context.Context) error {
	return c.Client.Ping(ctx).Err()
}
