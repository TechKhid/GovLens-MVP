package main

import (
	_ "github.com/go-chi/chi/v5"
	_ "github.com/go-chi/chi/v5/middleware"
	_ "github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/redis/go-redis/v9"
	_ "github.com/nats-io/nats.go"
	_ "golang.org/x/crypto/bcrypt"
	_ "github.com/golang-jwt/jwt/v5"
)

func main() {
}
