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
		pfv, stat, err := generateProfileView(r.URL.Query().Get("actor"))
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to generate profile view: %w", err.Error()), stat)
		}
		b, err := json.Marshal(pfv)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to marshal profile: %w", err.Error()), 500)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, "%s", b)
	})

	// var r skywell.GetActorFiles_Output

	// returns GetActorFiles_Output
	http.HandleFunc("/xrpc/dev.skywell.getActorFiles", func(w http.ResponseWriter, r *http.Request) {
		// pfv, stat, err := generateProfileView(r.URL.Query().Get("actor"))
	})

	fmt.Println("Server started!")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func generateProfileView(actor string) (profileView *skywell.Defs_ProfileView, httpResponse int, err error) {
	if actor == "" {
		return nil, 400, fmt.Errorf("Required parameter 'actor' missing")
	}

	at, err := syntax.ParseAtIdentifier(actor)
	if err != nil {
		return nil, 400, fmt.Errorf("Invalid 'actor' parameter: %w", err.Error())
	}

	id, err := identity.DefaultDirectory().Lookup(ctx, *at)
	user := User{}
	result := db.First(&user, "did = ?", id.DID.String())
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return nil, 404, fmt.Errorf("Actor not found")
	}
	afc, err := getActorFileCount(id.DID)
	if err != nil {
		return nil, 500, fmt.Errorf("Failed to get actor file count: %s", err.Error())
	}
	profileView = &skywell.Defs_ProfileView{
		Avatar:      (*string)(&user.Avatar),
		Did:         id.DID.String(),
		DisplayName: &user.DisplayName,
		FileCount:   &afc,
		Handle:      id.Handle.String(),
	}

	return profileView, 200, nil
}

func userAgent() *string {
	str := "Skywell AppView v0.1.0"
	return &str
}
