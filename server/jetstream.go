package main

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"

	"gorm.io/gorm"

	"github.com/bluesky-social/indigo/xrpc"
	jetstream "github.com/bluesky-social/jetstream/pkg/models"
	websocket "github.com/gorilla/websocket"
)

// todo maybe change to using real firehose in the future

var jetstream_uri string = "wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=dev.skywell.file&wantedCollections=app.bsky.actor.profile"

func read(db *gorm.DB, client *xrpc.Client, ctx context.Context) {
	conn, res, err := websocket.DefaultDialer.Dial(jetstream_uri, http.Header{})
	if err != nil {
		slog.Error("Failed to connect to Jetstream", "status_code", res.StatusCode, "error", err, "uri", jetstream_uri)
		panic(err)
	}
	defer conn.Close()

	for {
		_, r, err := conn.NextReader()
		if err != nil {
			slog.Error("Error reading from jetstream", "error", err, "uri", jetstream_uri)
			continue
		}

		msg, err := io.ReadAll(r)
		if err != nil {
			slog.Error("Error reading message", "error", err, "uri", jetstream_uri)
			continue
		}

		var evt jetstream.Event
		err = json.Unmarshal(msg, &evt)
		if err != nil {
			slog.Error("Failed to unmarshal to event", "error", err, "message_size", len(msg))
			continue
		}

		switch evt.Kind {
		case jetstream.EventKindIdentity:
			updateIdentity(evt, db, client, ctx)
		case jetstream.EventKindAccount:
			updateAccount(evt)
		case jetstream.EventKindCommit:
			updateRecord(evt, db, client, ctx)
		default:
			slog.Warn("Unknown jetstream event kind", "kind", evt.Kind, "did", evt.Did)
		}
	}
}
