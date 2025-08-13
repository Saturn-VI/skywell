package main

import (
	"context"
	"encoding/json"
	"io"
	"net/http"

	"gorm.io/gorm"

	"github.com/bluesky-social/indigo/xrpc"
	jetstream "github.com/bluesky-social/jetstream/pkg/models"
	"github.com/gorilla/websocket"
)

// todo maybe change to using real firehose in the future

var jetstreamUri = "wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=dev.skywell.file&wantedCollections=app.bsky.actor.profile"

func read(db *gorm.DB, client *xrpc.Client, ctx context.Context) {
	conn, res, err := websocket.DefaultDialer.Dial(jetstreamUri, http.Header{})
	if err != nil {
		jetstreamLogger.Error("Failed to connect to Jetstream", "status_code", res.StatusCode, "error", err, "uri", jetstreamUri)
		panic(err)
	}
	defer func(conn *websocket.Conn) {
		err := conn.Close()
		if err != nil {
			jetstreamLogger.Error("Failed to close connection", "error", err)
		}
	}(conn)

	for {
		_, r, err := conn.NextReader()
		if err != nil {
			jetstreamLogger.Error("Error reading from jetstream", "error", err, "uri", jetstreamUri)
			continue
		}

		msg, err := io.ReadAll(r)
		if err != nil {
			jetstreamLogger.Error("Error reading message", "error", err, "uri", jetstreamUri)
			continue
		}

		var evt jetstream.Event
		err = json.Unmarshal(msg, &evt)
		if err != nil {
			jetstreamLogger.Error("Failed to unmarshal to event", "error", err, "message_size", len(msg))
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
			jetstreamLogger.Warn("Unknown jetstream event kind", "kind", evt.Kind, "did", evt.Did)
		}
	}
}
