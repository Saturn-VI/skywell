package main

import (
	jetstream "github.com/bluesky-social/jetstream/pkg/models"
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
}
