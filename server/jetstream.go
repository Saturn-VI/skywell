package main

import (
	"context"
	"encoding/json"
	"fmt"
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
		slog.Error(fmt.Sprintf("Failed to connect to Jetstream (%d): %v", res.StatusCode, err))
		panic(err)
	}
	defer conn.Close()

	for {
		_, r, err := conn.NextReader()
		if err != nil {
			slog.Error(fmt.Sprintf("Error reading from jetstream: %v", err))
			continue
		}

		msg, err := io.ReadAll(r)
		if err != nil {
			slog.Error(fmt.Sprintf("Error reading message: %v", err))
			continue
		}

		var evt jetstream.Event
		err = json.Unmarshal(msg, &evt)
		if err != nil {
			slog.Error(fmt.Sprintf("Failed to unmarshal to event: %v", err))
			continue
		}

		switch evt.Kind {
		case jetstream.EventKindIdentity:
			updateIdentity(evt, db, client, ctx)
		case jetstream.EventKindAccount:
			updateAccount(evt)
		case jetstream.EventKindCommit:
			updateRecord(evt, db, client, ctx)
		}
	}
}
