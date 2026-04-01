package queue

import (
	"fmt"
	"log/slog"
	"os"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
)

type Queue struct {
	Conn *nats.Conn
	JS   jetstream.JetStream
}

func NewQueue() (*Queue, error) {
	natsURL := os.Getenv("NATS_URL")
	if natsURL == "" {
		return nil, fmt.Errorf("NATS_URL not set")
	}

	nc, err := nats.Connect(natsURL)
	if err != nil {
		return nil, fmt.Errorf("connecting to nats: %w", err)
	}

	js, err := jetstream.New(nc)
	if err != nil {
		return nil, fmt.Errorf("creating jetstream context: %w", err)
	}

	slog.Info("Connected to NATS JetStream")

	return &Queue{
		Conn: nc,
		JS:   js,
	}, nil
}
