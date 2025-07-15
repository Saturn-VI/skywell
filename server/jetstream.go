package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	jetstream "github.com/bluesky-social/jetstream/pkg/models"
	websocket "github.com/gorilla/websocket"
)

// todo maybe change to using real firehose in the future

var jetstream_uri string = "wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=dev.skywell.file&wantedCollections=app.bsky.actor.profile"

// var jetstream_uri string = "wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.like"

func read() {
	fmt.Println("Reading from Jetstream...")

	conn, res, err := websocket.DefaultDialer.Dial(jetstream_uri, http.Header{})
	if err != nil {
		fmt.Printf("%s: %d", res.Status, res.StatusCode)
		panic(err)
	}
	defer conn.Close()

	for {
		_, r, err := conn.NextReader()
		if err != nil {
			fmt.Println(fmt.Errorf("Error reading from jetstream: %w", err))
			continue
		}

		msg, err := io.ReadAll(r)
		if err != nil {
			fmt.Println(fmt.Errorf("Error reading message: %w", err))
			continue
		}

		var evt jetstream.Event
		err = json.Unmarshal(msg, &evt)
		if err != nil {
			fmt.Println(fmt.Errorf("Failed to unmarshal to event: %w", err))
			continue
		}

		switch evt.Kind {
		case jetstream.EventKindIdentity:
			updateIdentity(evt)
		case jetstream.EventKindAccount:
			updateAccount(evt)
		case jetstream.EventKindCommit:
			updateRecord(evt)
		}
	}
}
