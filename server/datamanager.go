package main

import (
	"encoding/json"
	"fmt"

	jetstream "github.com/bluesky-social/jetstream/pkg/models"
	skywell "github.com/saturn-vi/skywell/api/skywell"
)

func updateIdentity(evt jetstream.Event) {
	if evt.Kind != jetstream.EventKindIdentity {
		return
	}
	// TODO implement
}

func updateAccount (evt jetstream.Event) {
	if evt.Kind != jetstream.EventKindAccount {
		return
	}
	// TODO implement
}

func updateRecord (evt jetstream.Event) {
	if evt.Kind != jetstream.EventKindCommit {
		return
	}
	// TODO implement

	var r skywell.File
	err := json.Unmarshal(evt.Commit.Record, &r)
	if err != nil {
		fmt.Println(fmt.Errorf("Failed to unmarshal to file: %w", err))
		return
	}

}
