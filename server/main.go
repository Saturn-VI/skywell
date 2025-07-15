package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"

	"gorm.io/gorm"

	identity "github.com/bluesky-social/indigo/atproto/identity"
	syntax "github.com/bluesky-social/indigo/atproto/syntax"
	skywell "github.com/saturn-vi/skywell/api/skywell"
)

func main() {
	fmt.Println("Initializing database...")
	err := initializeDB()
	if err != nil {
		panic("Failed to initialize database: " + err.Error())
	}

	go read()

	// returns ProfileView
	http.HandleFunc("/xrpc/dev.skywell.getActorProfile", func(w http.ResponseWriter, r *http.Request) {
		actor := r.URL.Query().Get("actor")

		if actor == "" {
			http.Error(w, "Required parameter 'actor' missing", 400)
			return
		}

		at, err := syntax.ParseAtIdentifier(actor)
		if err != nil {
			http.Error(w, "Invalid 'actor' parameter: "+err.Error(), 400)
			return
		}
		id, err := identity.DefaultDirectory().Lookup(ctx, *at)
		user := User{}
		result := db.First(&user, "did = ?", id.DID.String())
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			http.Error(w, "Actor not found", 404)
			return
		}
		afc, err := getActorFileCount(id.DID)
		if err != nil {
			http.Error(w, "Failed to get actor file count: "+err.Error(), 500)
			return
		}
		profile := skywell.Defs_ProfileView{
			Avatar:      (*string)(&user.Avatar),
			Did:         id.DID.String(),
			DisplayName: &user.DisplayName,
			FileCount:   &afc,
			Handle:      id.Handle.String(),
		}
		b, err := json.Marshal(profile)
		if err != nil {
			http.Error(w, "Failed to marshal profile: "+err.Error(), 500)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, "%s", b)
	})

	// returns GetActorFiles_Output
	http.HandleFunc("/xrpc/dev.skywell.getActorFiles", func(w http.ResponseWriter, r *http.Request) {
		// TODO implement
	})

	fmt.Println("Server started!")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func userAgent() *string {
	str := "Skywell AppView v0.1.0"
	return &str
}
