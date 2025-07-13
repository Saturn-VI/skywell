package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/klauspost/compress/zstd"

	jetstream "github.com/bluesky-social/jetstream/pkg/models"
	websocket "github.com/gorilla/websocket"
)

// todo maybe change to using real firehose in the future

var jetstream_uri string = "wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=dev.skywell.file?compress=true"

func read() {
	fmt.Println("initializing zstd dict...")
	zstd.WithDecoderDicts(jetstream.ZSTDDictionary)
	fmt.Println("Reading from Jetstream...")

	conn, _, err := websocket.DefaultDialer.Dial(jetstream_uri, http.Header{})
	if err != nil {
		panic(err)
	}
	defer conn.Close()

	for {
		t, r, err := conn.NextReader()
		if err != nil {
			fmt.Println(fmt.Errorf("Error reading from jetstream: %w", err))
			continue
		}
		if t != websocket.BinaryMessage {
			fmt.Println(fmt.Errorf("Received non-binary message, skipping..."))
			continue
		}
		var buf bytes.Buffer
		if err := Decompress(r, &buf); err != nil {
			fmt.Println(fmt.Errorf("Error decompressing message: %w", err))
			continue
		}

		var evt jetstream.Event
		err = json.Unmarshal(buf.Bytes(), &evt)
		if err != nil {
			fmt.Println(fmt.Errorf("Failed to unmarshal to event: %w", err))
			continue
		}
	}
}

func Decompress(in io.Reader, out io.Writer) error {
	d, err := zstd.NewReader(in)
	if err != nil {
		return err
	}
	defer d.Close()

	_, err = io.Copy(out, d)
	return err
}
